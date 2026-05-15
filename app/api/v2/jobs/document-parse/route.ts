/**
 * POST /api/v2/jobs/document-parse
 *
 * Lance un parsing LlamaParse (worker `document-parse`). Crée un asset
 * placeholder + variant document pending immédiatement. Le client poll
 * GET /api/v2/jobs/[jobId]/status?kind=document-parse.
 *
 * Body : { fileUrl: string, mimeType?, fileName?, threadId? }
 * Return : { jobId, assetId, variantId, status: "pending" }
 *
 * Sans LLAMA_CLOUD_API_KEY → 503.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { storeAsset } from "@/lib/assets/types";
import { createVariant, updateVariant } from "@/lib/assets/variants";
import { documentParseSchema } from "@/lib/contracts/jobs";
import { settleCredits } from "@/lib/credits/client";
import { formatInsufficientCreditsMessage, requireCreditsForJob } from "@/lib/credits/middleware";
import { enqueueJob } from "@/lib/jobs/queue";
import type { DocumentParseInput } from "@/lib/jobs/types";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { protectLlmJob } from "@/lib/security/arcjet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = withRoute("POST /api/v2/jobs/document-parse");

const ESTIMATED_COST_USD = 0.005;

export async function POST(req: NextRequest) {
  // Défense en profondeur : Arcjet est déjà appliqué dans `proxy.ts`
  // mais on re-vérifie ici pour couvrir les appels hors-proxy. No-op
  // si ARCJET_KEY absente.
  const denied = await protectLlmJob(req);
  if (denied) return denied;

  if (!process.env.LLAMA_CLOUD_API_KEY) {
    return NextResponse.json(
      {
        error: "llamaparse_unavailable",
        message: "LLAMA_CLOUD_API_KEY non configuré côté serveur — parsing document désactivé.",
      },
      { status: 503 },
    );
  }

  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/jobs/document-parse",
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

  const parsed = documentParseSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { fileUrl, mimeType, fileName, threadId } = parsed.data;
  const placeholderJobId = `pending-doc-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const guard = await requireCreditsForJob({
    userId: scope.userId,
    tenantId: scope.tenantId,
    jobKind: "document-parse",
    estimatedCostUsd: ESTIMATED_COST_USD,
    jobId: placeholderJobId,
  });
  if (!guard.allowed) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message: formatInsufficientCreditsMessage(guard, "document-parse"),
        availableUsd: guard.availableUsd,
        estimatedCostUsd: guard.estimatedCostUsd,
      },
      { status: 402 },
    );
  }

  const resolvedMime = mimeType ?? "application/pdf";
  const resolvedName = fileName ?? fileUrl.split("/").pop() ?? "document";

  const assetId = randomUUID();
  await storeAsset({
    id: assetId,
    threadId: threadId ?? scope.workspaceId,
    kind: "document",
    title: resolvedName.slice(0, 80),
    summary: `Parsing en cours · ${resolvedMime}`,
    contentRef: fileUrl,
    createdAt: Date.now(),
    provenance: {
      providerId: "system",
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      modelUsed: "document-parse",
      costUsd: ESTIMATED_COST_USD,
    },
  });

  const variantId = await createVariant({
    assetId,
    kind: "text",
    status: "pending",
    provider: "llamaparse",
  });

  const payload: DocumentParseInput & { variantId: string | null } = {
    jobKind: "document-parse",
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    assetId,
    estimatedCostUsd: ESTIMATED_COST_USD,
    fileUrl,
    fileName: resolvedName,
    mimeType: resolvedMime,
    provider: "llamaparse",
    variantId,
  };

  try {
    const enqueued = await enqueueJob(payload);
    return NextResponse.json(
      {
        jobId: enqueued.jobId,
        jobKind: "document-parse",
        assetId,
        variantId,
        status: "pending",
        estimatedCostUsd: ESTIMATED_COST_USD,
      },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: redactedError(err), placeholderJobId, assetId }, "enqueue_failed");

    await settleCredits({
      userId: scope.userId,
      tenantId: scope.tenantId,
      reservedUsd: ESTIMATED_COST_USD,
      actualUsd: 0,
      jobId: placeholderJobId,
      jobKind: "document-parse",
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

    return NextResponse.json({ error: "enqueue_failed", message }, { status: 503 });
  }
}
