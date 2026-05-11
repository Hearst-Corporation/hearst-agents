/**
 * POST /api/v2/jobs/audio-gen
 *
 * Lance une synthèse TTS ElevenLabs (worker `audio-gen`). Crée un asset
 * placeholder + variant audio pending immédiatement. Le client poll
 * GET /api/v2/jobs/[jobId]/status?kind=audio-gen pour récupérer le résultat.
 *
 * Body : { text: string, voiceId?, modelId?, threadId? }
 * Return : { jobId, assetId, variantId, status: "pending" }
 *
 * Sans ELEVENLABS_API_KEY → 503 explicite.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { storeAsset } from "@/lib/assets/types";
import { createVariant, updateVariant } from "@/lib/assets/variants";
import { enqueueJob } from "@/lib/jobs/queue";
import { requireCreditsForJob, formatInsufficientCreditsMessage } from "@/lib/credits/middleware";
import { settleCredits } from "@/lib/credits/client";
import { estimateSpeechCost } from "@/lib/capabilities/providers/elevenlabs";
import { protectLlmJob } from "@/lib/security/arcjet";
import { audioGenSchema } from "@/lib/contracts/jobs";
import type { AudioGenInput } from "@/lib/jobs/types";
import { withRoute, redactedError } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = withRoute("POST /api/v2/jobs/audio-gen");

export async function POST(req: NextRequest) {
  // Défense en profondeur : Arcjet est déjà appliqué dans `proxy.ts`
  // mais on re-vérifie ici pour couvrir les appels hors-proxy. No-op
  // si ARCJET_KEY absente.
  const denied = await protectLlmJob(req);
  if (denied) return denied;

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      {
        error: "elevenlabs_unavailable",
        message: "ELEVENLABS_API_KEY non configuré côté serveur — synthèse audio désactivée.",
      },
      { status: 503 },
    );
  }

  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/jobs/audio-gen",
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

  const parsed = audioGenSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { text, voiceId, modelId, threadId, tone, personaId } = parsed.data;

  // Vérifier que la persona appartient au scope.userId — empêche l'impersonation (F-118)
  if (personaId) {
    try {
      const sb = requireServerSupabase();
      const { data: persona } = await sb
        .from("personas")
        .select("id")
        .eq("id", personaId)
        .eq("user_id", scope.userId)
        .single();
      if (!persona) {
        return NextResponse.json({ error: "persona_not_found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "persona_check_failed" }, { status: 500 });
    }
  }

  const estimatedCostUsd = Math.max(estimateSpeechCost(text, modelId), 0.001);
  const placeholderJobId = `pending-audio-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const guard = await requireCreditsForJob({
    userId: scope.userId,
    tenantId: scope.tenantId,
    jobKind: "audio-gen",
    estimatedCostUsd,
    jobId: placeholderJobId,
  });
  if (!guard.allowed) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message: formatInsufficientCreditsMessage(guard, "audio-gen"),
        availableUsd: guard.availableUsd,
        estimatedCostUsd: guard.estimatedCostUsd,
      },
      { status: 402 },
    );
  }

  const assetId = randomUUID();
  await storeAsset({
    id: assetId,
    threadId: threadId ?? scope.workspaceId,
    kind: "report",
    title: text.slice(0, 80),
    summary: text.slice(0, 200),
    contentRef: "",
    createdAt: Date.now(),
    provenance: {
      providerId: "system",
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      modelUsed: "elevenlabs",
      costUsd: estimatedCostUsd,
    },
  });

  const variantId = await createVariant({
    assetId,
    kind: "audio",
    status: "pending",
    provider: "elevenlabs",
  });

  const payload: AudioGenInput & { variantId: string | null; variantKind: string } = {
    jobKind: "audio-gen",
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    assetId,
    estimatedCostUsd,
    text,
    voiceId,
    modelId,
    tone,
    personaId,
    provider: "elevenlabs",
    variantId,
    variantKind: "audio",
  };

  try {
    const enqueued = await enqueueJob(payload);
    return NextResponse.json(
      {
        jobId: enqueued.jobId,
        jobKind: "audio-gen",
        assetId,
        variantId,
        status: "pending",
        estimatedCostUsd,
      },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: redactedError(err), placeholderJobId, assetId }, "enqueue_failed");

    await settleCredits({
      userId: scope.userId,
      tenantId: scope.tenantId,
      reservedUsd: estimatedCostUsd,
      actualUsd: 0,
      jobId: placeholderJobId,
      jobKind: "audio-gen",
      description: `enqueue_failed: ${message.slice(0, 200)}`,
    }).catch((settleErr) => {
      log.error({ err: redactedError(settleErr), placeholderJobId }, "credit_refund_failed");
    });

    if (variantId) {
      await updateVariant(variantId, {
        status: "failed",
        error: `enqueue_failed: ${message.slice(0, 500)}`,
        metadata: { reason: "enqueue_failed" },
      }).catch(() => {});
    }

    return NextResponse.json(
      { error: "enqueue_failed", message },
      { status: 503 },
    );
  }
}
