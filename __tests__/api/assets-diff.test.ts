/**
 * @vitest-environment node
 *
 * /api/v2/assets/diff — migration F002 + budget tenant F-NEW-P5-01.
 * Vérifie : getProvider("kimi"), guardAndReserveCredits, fallback naiveDiff.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: vi.fn(async () => ({
    scope: { tenantId: "t", workspaceId: "w", userId: "u" },
    error: null,
  })),
}));

vi.mock("@/lib/assets/types", () => ({
  loadAssetById: vi.fn(),
}));

vi.mock("@/lib/credits/client", () => ({
  guardAndReserveCredits: vi.fn(async () => ({
    allowed: true,
    availableUsd: 10,
    estimatedCostUsd: 0.05,
  })),
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: vi.fn(() => false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock("@/lib/llm/router", () => ({
  getProvider: vi.fn(),
}));

import { POST } from "@/app/api/v2/assets/diff/route";
import { loadAssetById } from "@/lib/assets/types";
import { guardAndReserveCredits } from "@/lib/credits/client";
import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";
import { getProvider } from "@/lib/llm/router";

const mockAssetA = {
  id: "a",
  threadId: "t",
  kind: "report",
  title: "Asset A",
  provenance: { providerId: "system", modelUsed: "kimi-k2.5" },
  createdAt: 0,
  contentRef: "abcdef",
};
const mockAssetB = {
  id: "b",
  threadId: "t",
  kind: "brief",
  title: "Asset B",
  provenance: { providerId: "system", modelUsed: "kimi-k2.5" },
  createdAt: 0,
  contentRef: "abcdefghij",
};

describe("POST /api/v2/assets/diff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KIMI_API_KEY = "test-key";
    (defaultCircuitBreaker.isOpen as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (guardAndReserveCredits as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      availableUsd: 10,
      estimatedCostUsd: 0.05,
    });
  });

  it("retourne 404 si un asset est introuvable", async () => {
    (loadAssetById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request("http://x/api/v2/assets/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIdA: "a", assetIdB: "b" }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
  });

  it("retourne un diff naïf déterministe quand KIMI_API_KEY absent", async () => {
    delete process.env.KIMI_API_KEY;
    (loadAssetById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockAssetA)
      .mockResolvedValueOnce(mockAssetB);
    const req = new Request("http://x/api/v2/assets/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIdA: "a", assetIdB: "b" }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toContain("Asset A");
    expect(json.differences.some((d: { kind: string }) => d.kind === "title")).toBe(true);
    expect(json.differences.some((d: { kind: string }) => d.kind === "kind")).toBe(true);
    expect(json.differences.some((d: { kind: string }) => d.kind === "content_size")).toBe(true);
  });

  it("retourne 400 sur body invalide", async () => {
    const req = new Request("http://x/api/v2/assets/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("appelle getProvider('kimi') et guardAndReserveCredits avant le LLM", async () => {
    (loadAssetById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockAssetA)
      .mockResolvedValueOnce(mockAssetB);

    const mockChat = vi.fn().mockResolvedValue({
      content: '{"summary":"delta mineur","differences":[{"kind":"title","description":"A → B"}]}',
      tokens_in: 100,
      tokens_out: 50,
      cost_usd: 0.01,
      latency_ms: 200,
      provider: "kimi",
      model: "kimi-k2.5",
    });
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({ chat: mockChat });

    const req = new Request("http://x/api/v2/assets/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIdA: "a", assetIdB: "b" }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect(getProvider).toHaveBeenCalledWith("kimi");
    expect(guardAndReserveCredits).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedCostUsd: 0.05, tenantId: "t", userId: "u" }),
    );
    expect(defaultCircuitBreaker.recordSuccess).toHaveBeenCalledWith("kimi", "t");
  });

  it("retourne fallback naiveDiff si LLM lève une erreur", async () => {
    (loadAssetById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockAssetA)
      .mockResolvedValueOnce(mockAssetB);

    const mockChat = vi.fn().mockRejectedValue(new Error("503 service unavailable"));
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({ chat: mockChat });

    const req = new Request("http://x/api/v2/assets/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIdA: "a", assetIdB: "b" }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toContain("LLM indisponible");
    expect(defaultCircuitBreaker.recordFailure).toHaveBeenCalledWith(
      "kimi",
      expect.any(Error),
      "t",
    );
  });

  it("retourne 402 si credits insuffisants", async () => {
    (loadAssetById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockAssetA)
      .mockResolvedValueOnce(mockAssetB);
    (guardAndReserveCredits as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      availableUsd: 0.001,
      estimatedCostUsd: 0.05,
      reason: "insufficient_credits",
    });

    const req = new Request("http://x/api/v2/assets/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIdA: "a", assetIdB: "b" }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(402);
  });
});
