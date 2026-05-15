/**
 * Assets invariants — storage key normalization, upsertEmbedding idempotence,
 * cleanup after enqueue failure, DELETE endpoint cache eviction.
 *
 * Couvre :
 *  1. normalizeStorageKey : "../" → rejeté (throw)
 *  2. normalizeStorageKey : chemin absolu "/absolute" → rejeté (throw)
 *  3. upsertEmbedding idempotent : 2 appels identiques → UPSERT (pas de duplicate)
 *  4. cleanupAfterEnqueueFailure appelé si enqueueJob throw
 *  5. DELETE /api/v2/assets/[id] → evictAssetById appelé
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks hoistés — UN seul bloc par module mocké dans le fichier
// ─────────────────────────────────────────────────────────────────────────────

const m = vi.hoisted(() => ({
  // auth
  requireScope: vi.fn(),
  // assets/types
  loadAssetById: vi.fn(),
  evictAssetById: vi.fn(),
  storeAsset: vi.fn(),
  loadAssetsForScope: vi.fn(),
  // assets/variants
  getVariantsForAsset: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  // embeddings
  getServerSupabase: vi.fn(),
  embedText: vi.fn(),
  // credits
  requireCreditsForJob: vi.fn(),
  settleCredits: vi.fn(),
  formatInsufficientCreditsMessage: vi.fn(),
  // jobs
  enqueueJob: vi.fn(),
  // elevenlabs
  estimateSpeechCost: vi.fn(),
  // adapter
  deleteAssetById: vi.fn(),
}));

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: m.requireScope,
}));

vi.mock("@/lib/assets/types", () => ({
  loadAssetById: m.loadAssetById,
  evictAssetById: m.evictAssetById,
  storeAsset: m.storeAsset,
  loadAssetsForScope: m.loadAssetsForScope,
}));

vi.mock("@/lib/assets/variants", () => ({
  getVariantsForAsset: m.getVariantsForAsset,
  createVariant: m.createVariant,
  updateVariant: m.updateVariant,
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: m.getServerSupabase,
}));

vi.mock("@/lib/embeddings/embed", () => ({
  embedText: m.embedText,
  EmbeddingsUnavailableError: class EmbeddingsUnavailableError extends Error {},
}));

vi.mock("@/lib/credits/middleware", () => ({
  requireCreditsForJob: m.requireCreditsForJob,
  formatInsufficientCreditsMessage: m.formatInsufficientCreditsMessage,
}));

vi.mock("@/lib/credits/client", () => ({
  settleCredits: m.settleCredits,
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: m.enqueueJob,
}));

vi.mock("@/lib/capabilities/providers/elevenlabs", () => ({
  estimateSpeechCost: m.estimateSpeechCost,
}));

vi.mock("@/lib/engine/runtime/assets/adapter", () => ({
  deleteAssetById: m.deleteAssetById,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports après mocks
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/v2/assets/[id]/route";
import { POST } from "@/app/api/v2/assets/[id]/variants/route";
import { upsertEmbedding } from "@/lib/embeddings/store";
import { normalizeStorageKey } from "@/lib/engine/runtime/assets/storage/types";

// ─────────────────────────────────────────────────────────────────────────────
// Tests 1-2 : normalizeStorageKey
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeStorageKey", () => {
  it("path contenant '../' → throw (path traversal rejeté)", () => {
    expect(() => normalizeStorageKey("runs/../../../etc/passwd")).toThrow();
  });

  it("path absolu '/absolute/path' → throw", () => {
    expect(() => normalizeStorageKey("/absolute/path/file.pdf")).toThrow();
  });

  it("path valide → retourné normalisé", () => {
    const result = normalizeStorageKey("runs/abc123/report.pdf");
    expect(result).toBe("runs/abc123/report.pdf");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 : upsertEmbedding idempotent (UPSERT onConflict)
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertEmbedding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("2 appels avec même (userId, tenantId, source_kind, source_id) → UPSERT (pas de duplicate)", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });

    m.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
    m.getServerSupabase.mockReturnValue({
      from: () => ({ upsert: upsertFn }),
    });

    const input = {
      userId: "user-1",
      tenantId: "tenant-1",
      sourceKind: "asset" as const,
      sourceId: "asset-abc",
      textExcerpt: "Rapport Q2 : croissance de 12%",
    };

    const r1 = await upsertEmbedding(input);
    const r2 = await upsertEmbedding(input);

    expect(r1).toBe(true);
    expect(r2).toBe(true);

    // Les 2 appels passent via upsert avec onConflict → pas de duplicate en DB
    expect(upsertFn).toHaveBeenCalledTimes(2);
    const opts = (upsertFn.mock.calls[0] as [unknown, { onConflict: string }])[1];
    expect(opts.onConflict).toBe("user_id,tenant_id,source_kind,source_id");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 : cleanupAfterEnqueueFailure appelé si enqueueJob throw
// ─────────────────────────────────────────────────────────────────────────────

describe("variants route — cleanup après échec enqueueJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.requireScope.mockResolvedValue({
      scope: { userId: "u1", tenantId: "t1", workspaceId: "w1" },
      error: null,
    });

    m.loadAssetById.mockResolvedValue({
      id: "asset-1",
      title: "Mon rapport",
      summary: "Un résumé court",
      kind: "report",
    });

    m.getVariantsForAsset.mockResolvedValue([]);

    // estimateSpeechCost retourne un coût (pas un objet credits)
    m.estimateSpeechCost.mockReturnValue(0.003);

    m.requireCreditsForJob.mockResolvedValue({
      allowed: true,
      reservationId: "res-1",
      availableUsd: 10,
      estimatedCostUsd: 0.003,
    });

    // createVariant retourne un string (variantId) — pas un objet
    m.createVariant.mockResolvedValue("variant-1");

    // enqueueJob throw → cleanupAfterEnqueueFailure doit être appelé
    m.enqueueJob.mockRejectedValue(new Error("Queue unavailable"));

    m.updateVariant.mockResolvedValue(undefined);
    m.settleCredits.mockResolvedValue(undefined);
  });

  it("enqueueJob throw → updateVariant appelé avec status 'failed' (cleanup)", async () => {
    const req = new NextRequest(new URL("http://localhost/api/v2/assets/asset-1/variants"), {
      method: "POST",
      body: JSON.stringify({ kind: "audio", text: "Test synthesis" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "asset-1" }),
    });

    // La route gère l'erreur proprement, pas un crash 500
    expect(res.status).not.toBe(500);

    // cleanup : variant marqué comme failed
    expect(m.updateVariant).toHaveBeenCalledWith(
      "variant-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 : DELETE /api/v2/assets/[id] → evictAssetById appelé
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/v2/assets/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.requireScope.mockResolvedValue({
      scope: { userId: "u1", tenantId: "t1", workspaceId: "w1" },
      error: null,
    });

    m.deleteAssetById.mockResolvedValue({ ok: true, deletedCount: 1 });
    m.evictAssetById.mockReturnValue(undefined);
  });

  it("DELETE réussi → evictAssetById appelé avec l'id de l'asset", async () => {
    const req = new NextRequest(new URL("http://localhost/api/v2/assets/asset-42"), {
      method: "DELETE",
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "asset-42" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Le cache in-memory doit être invalidé après suppression
    expect(m.evictAssetById).toHaveBeenCalledWith("asset-42");
  });
});
