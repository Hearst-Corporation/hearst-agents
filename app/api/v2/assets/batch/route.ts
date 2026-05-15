/**
 * POST /api/v2/assets/batch — Q3-A : génération vidéo en N variants parallèles.
 *
 * Crée 1 asset shell parent + jusqu'à 4 variants vidéo enqueués en parallèle
 * dans la même queue BullMQ `video-gen`. Le worker pickup en concurrence native
 * (pas de queue dédiée — la concurrency settings du worker suffit).
 *
 * Flow :
 *  1. Auth via requireScope()
 *  2. Validation : 1..4 variants, chaque variant a au moins un prompt non-vide
 *  3. Estimate cost (somme des estimates par variant)
 *  4. Reserve credits **par variant** (atomic via SQL fn) — chaque enqueue
 *     a son propre placeholderJobId pour pouvoir refund individuellement
 *  5. storeAsset() — asset shell de type "report" (le wrapper "batch")
 *  6. Pour chaque variant : createVariant + enqueueJob(video-gen)
 *  7. Retourne { assetId, jobs: [{ kind, jobId, variantId }] }
 *
 * En cas d'échec partiel (ex : variant 3/4 échoue à enqueue) :
 *   - Les variants déjà enqueués restent — l'utilisateur verra N-1 cards
 *   - Le crédit reservé pour le variant 3 est refund
 *   - Le variantId 3 est marqué "failed"
 *   - La response contient `errors: [{ index, message }]`
 *
 * Limit : MAX_BATCH_VARIANTS = 4 (cost cap + UI grid 2×2 max).
 */

import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type Asset, storeAsset } from "@/lib/assets/types";
import { createVariant, updateVariant } from "@/lib/assets/variants";
import { settleCredits } from "@/lib/credits/client";
import { formatInsufficientCreditsMessage, requireCreditsForJob } from "@/lib/credits/middleware";
import { enqueueJob } from "@/lib/jobs/queue";
import type { VideoGenInput } from "@/lib/jobs/types";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BATCH_VARIANTS = 4;

const variantSchema = z.object({
  prompt: z.string().min(1, "prompt requis").max(4000),
  provider: z.enum(["runway", "heygen"]).default("runway"),
  durationSeconds: z.union([z.literal(5), z.literal(10)]).default(5),
  ratio: z.enum(["1280:720", "720:1280"]).optional(),
  avatarId: z.string().optional(),
});

const batchSchema = z.object({
  variants: z
    .array(variantSchema)
    .min(1, "Au moins 1 variant requis")
    .max(MAX_BATCH_VARIANTS, `Maximum ${MAX_BATCH_VARIANTS} variants par batch`),
  /** Nom optionnel pour l'asset shell. Défaut : dérivé du premier prompt. */
  name: z.string().min(1).max(200).optional(),
  /** Thread courant — utilisé pour scoper l'asset shell. */
  threadId: z.string().optional(),
});

type VariantInput = z.infer<typeof variantSchema>;

function estimateVariantCostUsd(v: VariantInput): number {
  // Mêmes estimates que /assets/[id]/variants pour cohérence :
  //  - Runway : 0.05 USD/sec (5s → 0.25 ; 10s → 0.50)
  //  - HeyGen : 0.50 USD fixe
  if (v.provider === "heygen") return 0.5;
  return v.durationSeconds === 10 ? 0.5 : 0.25;
}

interface JobDescriptor {
  kind: "video-gen";
  variantId: string;
  jobId: string;
  index: number;
}

export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/assets/batch",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { variants, name, threadId } = parsed.data;

  // 1. Reserve credits pour chaque variant (atomic). Si un seul échoue
  //    par insufficient credits, on refund tous les precedents et 402.
  const reservations: Array<{
    index: number;
    estimatedCostUsd: number;
    placeholderJobId: string;
  }> = [];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const estimatedCostUsd = estimateVariantCostUsd(v);
    const placeholderJobId = `batch-pending-${randomUUID()}`;

    const guard = await requireCreditsForJob({
      userId: scope.userId,
      tenantId: scope.tenantId,
      jobKind: "video-gen",
      estimatedCostUsd,
      jobId: placeholderJobId,
    });
    if (!guard.allowed) {
      // Refund toutes les réservations précédentes.
      await Promise.all(
        reservations.map((r) =>
          settleCredits({
            userId: scope.userId,
            tenantId: scope.tenantId,
            reservedUsd: r.estimatedCostUsd,
            actualUsd: 0,
            jobId: r.placeholderJobId,
            jobKind: "video-gen",
            description: "batch_aborted_insufficient_credits",
          }).catch((err) => console.error("[Batch] refund failed:", err)),
        ),
      );
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: formatInsufficientCreditsMessage(guard, "video-gen"),
          availableUsd: guard.availableUsd,
          estimatedCostUsd: guard.estimatedCostUsd,
          variantIndex: i,
        },
        { status: 402 },
      );
    }
    reservations.push({ index: i, estimatedCostUsd, placeholderJobId });
  }

  // 2. Crée l'asset shell parent.
  const firstPrompt = variants[0].prompt.trim();
  const shellName = (name ?? firstPrompt).slice(0, 80) || "Batch vidéo";

  const asset: Asset = {
    id: randomUUID(),
    threadId: threadId ?? "default",
    kind: "report",
    title: shellName,
    summary: `Batch de ${variants.length} variant${variants.length > 1 ? "s" : ""} vidéo`,
    provenance: {
      providerId: "system",
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      runArtifact: false,
      type: "report",
      metadata: {
        origin: "video-quick-launch-batch",
        variantCount: variants.length,
      },
    },
    createdAt: Date.now(),
  };

  await storeAsset(asset);

  // 3. Enqueue chaque variant. On collecte les succès et erreurs en
  //    parallèle (Promise.allSettled) pour ne pas bloquer sur un échec.
  const enqueueResults = await Promise.all(
    variants.map(
      async (
        v,
        i,
      ): Promise<
        | { ok: true; job: JobDescriptor }
        | { ok: false; index: number; message: string; reservation: (typeof reservations)[number] }
      > => {
        const reservation = reservations[i];
        const variantId = await createVariant({
          assetId: asset.id,
          kind: "video",
          status: "pending",
          provider: v.provider,
        });
        if (!variantId) {
          return {
            ok: false,
            index: i,
            message: "variant_create_failed",
            reservation,
          };
        }

        const ratio = v.provider === "runway" ? (v.ratio ?? "1280:720") : undefined;

        // Persiste prompt + ratio + duration dans metadata pour qu'AssetCompareStage
        // puisse les afficher en header de pane même avant que le worker termine.
        await updateVariant(variantId, {
          metadata: {
            prompt: v.prompt,
            duration: v.durationSeconds,
            ...(ratio ? { ratio } : {}),
            batchIndex: i,
          },
        }).catch((err) => console.warn("[Batch] persist metadata failed:", err));

        const payload: VideoGenInput & {
          variantId: string;
          ratio?: string;
        } = {
          jobKind: "video-gen",
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          assetId: asset.id,
          estimatedCostUsd: reservation.estimatedCostUsd,
          prompt: v.prompt,
          scriptText: v.prompt,
          provider: v.provider,
          avatarId: v.avatarId,
          durationSeconds: v.durationSeconds,
          variantKind: "video",
          variantId,
          ...(ratio ? { ratio } : {}),
        };

        try {
          const result = await enqueueJob(payload);
          return {
            ok: true,
            job: {
              kind: "video-gen",
              variantId,
              jobId: result.jobId,
              index: i,
            },
          };
        } catch (err) {
          // Enqueue échoué : refund + mark variant failed.
          const message = err instanceof Error ? err.message : String(err);
          await settleCredits({
            userId: scope.userId,
            tenantId: scope.tenantId,
            reservedUsd: reservation.estimatedCostUsd,
            actualUsd: 0,
            jobId: reservation.placeholderJobId,
            jobKind: "video-gen",
            description: `enqueue_failed: ${message.slice(0, 200)}`,
          }).catch((settleErr) => console.error("[Batch] refund failed:", settleErr));

          await updateVariant(variantId, {
            status: "failed",
            error: `enqueue_failed: ${message.slice(0, 500)}`,
            metadata: { reason: "enqueue_failed", message },
          }).catch((updateErr) => console.error("[Batch] mark variant failed:", updateErr));

          return {
            ok: false,
            index: i,
            message,
            reservation,
          };
        }
      },
    ),
  );

  const jobs = enqueueResults
    .filter((r): r is { ok: true; job: JobDescriptor } => r.ok)
    .map((r) => r.job);
  const errors = enqueueResults
    .filter(
      (
        r,
      ): r is {
        ok: false;
        index: number;
        message: string;
        reservation: (typeof reservations)[number];
      } => !r.ok,
    )
    .map((r) => ({ index: r.index, message: r.message }));

  return NextResponse.json(
    {
      assetId: asset.id,
      jobs,
      errors: errors.length > 0 ? errors : undefined,
    },
    { status: jobs.length > 0 ? 201 : 503 },
  );
}
