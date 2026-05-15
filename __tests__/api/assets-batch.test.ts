/**
 * POST /api/v2/assets/batch — Q3-A : génération vidéo batch (1..4 variants).
 *
 * Couvre :
 *  - 401 si pas de scope
 *  - 400 sur validation Zod (0 variants, 5 variants, prompt vide)
 *  - 400 si JSON body invalide
 *  - 402 + refund des réservations précédentes si crédits insuffisants
 *  - 201 happy path : 3 variants → 3 jobs créés + 1 asset shell
 *  - 201 partiel : 1 enqueue échoue → refund + variant marquée failed,
 *    autres variants restent en succès
 *  - 503 si toutes les enqueues échouent (jobs.length === 0)
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireScope,
  storeAsset,
  createVariant,
  updateVariant,
  enqueueJob,
  requireCreditsForJob,
  settleCredits,
} = vi.hoisted(() => ({
  requireScope: vi.fn(),
  storeAsset: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  enqueueJob: vi.fn(),
  requireCreditsForJob: vi.fn(),
  settleCredits: vi.fn(),
}));

vi.mock("@/lib/platform/auth/scope", () => ({ requireScope }));
vi.mock("@/lib/assets/types", () => ({ storeAsset }));
vi.mock("@/lib/assets/variants", () => ({ createVariant, updateVariant }));
vi.mock("@/lib/jobs/queue", () => ({ enqueueJob }));
vi.mock("@/lib/credits/middleware", () => ({
  requireCreditsForJob,
  formatInsufficientCreditsMessage: () => "Solde insuffisant",
}));
vi.mock("@/lib/credits/client", () => ({ settleCredits }));

const SCOPE = {
  userId: "user-1",
  tenantId: "tenant-1",
  workspaceId: "ws-1",
  isDevFallback: false,
};

function makeReq(body: unknown, opts?: { rawBody?: string }): NextRequest {
  return new NextRequest(new URL("http://localhost/api/v2/assets/batch"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: opts?.rawBody ?? JSON.stringify(body),
  });
}

const validVariant = (prompt: string) => ({
  prompt,
  provider: "runway" as const,
  durationSeconds: 5 as const,
  ratio: "1280:720" as const,
});

describe("POST /api/v2/assets/batch", () => {
  beforeEach(() => {
    requireScope.mockReset();
    storeAsset.mockReset();
    createVariant.mockReset();
    updateVariant.mockReset();
    enqueueJob.mockReset();
    requireCreditsForJob.mockReset();
    settleCredits.mockReset();

    requireScope.mockResolvedValue({ scope: SCOPE, error: null });
    requireCreditsForJob.mockResolvedValue({
      allowed: true,
      availableUsd: 100,
      estimatedCostUsd: 0.25,
    });
    storeAsset.mockResolvedValue(undefined);
    let variantSeq = 0;
    createVariant.mockImplementation(async () => `variant-${++variantSeq}`);
    updateVariant.mockResolvedValue(undefined);
    let jobSeq = 0;
    enqueueJob.mockImplementation(async () => ({
      jobId: `job-${++jobSeq}`,
      jobKind: "video-gen",
    }));
    settleCredits.mockResolvedValue(undefined);
  });

  it("401 si scope absent", async () => {
    requireScope.mockResolvedValue({
      scope: null,
      error: { message: "not_authenticated", status: 401 },
    });
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(makeReq({ variants: [validVariant("test")] }));
    expect(res.status).toBe(401);
  });

  it("400 si JSON body invalide", async () => {
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(makeReq(undefined, { rawBody: "{not json" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_json");
  });

  it("400 sur validation : 0 variants", async () => {
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(makeReq({ variants: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("400 sur validation : 5 variants (au-delà de la limite max=4)", async () => {
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const five = [1, 2, 3, 4, 5].map((i) => validVariant(`prompt ${i}`));
    const res = await POST(makeReq({ variants: five }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("400 sur validation : prompt vide dans un variant", async () => {
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(
      makeReq({
        variants: [{ ...validVariant("ok"), prompt: "" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("happy path 3 variants → 201 avec 3 jobs + 1 asset shell", async () => {
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(
      makeReq({
        variants: [validVariant("prompt A"), validVariant("prompt B"), validVariant("prompt C")],
        threadId: "thread-42",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assetId).toBeTruthy();
    expect(body.jobs).toHaveLength(3);
    expect(body.errors).toBeUndefined();

    // 1 asset shell, 3 createVariant, 3 enqueueJob.
    expect(storeAsset).toHaveBeenCalledTimes(1);
    expect(createVariant).toHaveBeenCalledTimes(3);
    expect(enqueueJob).toHaveBeenCalledTimes(3);

    // Chaque job descriptor expose kind/variantId/jobId/index.
    for (const job of body.jobs) {
      expect(job.kind).toBe("video-gen");
      expect(job.variantId).toBeTruthy();
      expect(job.jobId).toBeTruthy();
      expect(typeof job.index).toBe("number");
    }
    // index 0..2 couverts.
    const indices = (body.jobs as Array<{ index: number }>).map((j) => j.index).sort();
    expect(indices).toEqual([0, 1, 2]);

    // L'asset shell est typé "report" avec metadata batch.
    const assetCall = storeAsset.mock.calls[0][0];
    expect(assetCall.kind).toBe("report");
    expect(assetCall.threadId).toBe("thread-42");
    expect(assetCall.provenance.metadata.origin).toBe("video-quick-launch-batch");
    expect(assetCall.provenance.metadata.variantCount).toBe(3);
  });

  it("402 + refund des réservations précédentes si crédits insuffisants au 2e variant", async () => {
    // Premier appel passe, deuxième non.
    let call = 0;
    requireCreditsForJob.mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return { allowed: true, availableUsd: 0.5, estimatedCostUsd: 0.25 };
      }
      return { allowed: false, availableUsd: 0.1, estimatedCostUsd: 0.25 };
    });

    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(
      makeReq({
        variants: [validVariant("A"), validVariant("B")],
      }),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("insufficient_credits");
    expect(body.variantIndex).toBe(1);

    // Aucun asset / variant créé (on bail avant storeAsset).
    expect(storeAsset).not.toHaveBeenCalled();
    expect(createVariant).not.toHaveBeenCalled();

    // Refund de la 1re réservation (avant l'échec).
    expect(settleCredits).toHaveBeenCalledTimes(1);
    const settleArgs = settleCredits.mock.calls[0][0];
    expect(settleArgs.actualUsd).toBe(0);
    expect(settleArgs.description).toBe("batch_aborted_insufficient_credits");
  });

  it("201 partiel : 1 enqueue échoue → refund + variant marquée failed, autres OK", async () => {
    // 3 variants, le 2e enqueue throw.
    let calls = 0;
    enqueueJob.mockImplementation(async () => {
      calls += 1;
      if (calls === 2) throw new Error("redis down");
      return { jobId: `job-${calls}`, jobKind: "video-gen" };
    });

    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(
      makeReq({
        variants: [validVariant("A"), validVariant("B"), validVariant("C")],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobs).toHaveLength(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].index).toBe(1);
    expect(body.errors[0].message).toContain("redis down");

    // Refund une seule fois (pour le variant échoué).
    expect(settleCredits).toHaveBeenCalledTimes(1);

    // Variant marqué failed (cleanup individuel).
    const failedCalls = updateVariant.mock.calls.filter(
      ([, patch]) => (patch as { status?: string }).status === "failed",
    );
    expect(failedCalls).toHaveLength(1);
  });

  it("503 si toutes les enqueues échouent (aucun job survivant)", async () => {
    enqueueJob.mockRejectedValue(new Error("queue offline"));
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    const res = await POST(
      makeReq({
        variants: [validVariant("A"), validVariant("B")],
      }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.jobs).toHaveLength(0);
    expect(body.errors).toHaveLength(2);
    // 2 refunds, 2 variants marquées failed.
    expect(settleCredits).toHaveBeenCalledTimes(2);
  });

  it("payload enqueueJob conforme au contrat VideoGenInput", async () => {
    const { POST } = await import("@/app/api/v2/assets/batch/route");
    await POST(
      makeReq({
        variants: [validVariant("un chat")],
      }),
    );
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    const payload = enqueueJob.mock.calls[0][0];
    expect(payload.jobKind).toBe("video-gen");
    expect(payload.userId).toBe(SCOPE.userId);
    expect(payload.tenantId).toBe(SCOPE.tenantId);
    expect(payload.workspaceId).toBe(SCOPE.workspaceId);
    expect(payload.prompt).toBe("un chat");
    expect(payload.scriptText).toBe("un chat");
    expect(payload.provider).toBe("runway");
    expect(payload.durationSeconds).toBe(5);
    expect(payload.variantKind).toBe("video");
    expect(payload.variantId).toBeTruthy();
    expect(payload.assetId).toBeTruthy();
    expect(payload.estimatedCostUsd).toBeGreaterThan(0);
    expect(payload.ratio).toBe("1280:720");
  });
});
