/**
 * Tests — endpoint A/B test personas.
 * Migration F002 + budget tenant F-NEW-P5-01.
 *
 * Vérifie : validation, auth, getProvider("kimi"), guardAndReserveCredits,
 * circuit breaker, 503 si KIMI_API_KEY absent, multi-tenant pA/pB intact.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: vi.fn(async () => ({
    scope: {
      userId: "user-test",
      tenantId: "tenant-test",
      workspaceId: "ws-test",
      isDevFallback: false,
    },
    error: null,
  })),
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: vi.fn(() => null),
}));

vi.mock("@/lib/credits/client", () => ({
  guardAndReserveCredits: vi.fn(async () => ({
    allowed: true,
    availableUsd: 10,
    estimatedCostUsd: 0.1,
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

vi.mock("@/lib/personas/store", () => ({
  getPersonaById: vi.fn(async (id: string) => {
    if (id === "builtin:default" || id === "builtin:formal") {
      return { id, name: id, tenantId: "tenant-test" };
    }
    return null;
  }),
}));

vi.mock("@/lib/personas/system-prompt-addon", () => ({
  buildPersonaAddonOrNull: vi.fn(() => null),
}));

import { guardAndReserveCredits } from "@/lib/credits/client";
import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";
import { getProvider } from "@/lib/llm/router";

describe("POST /api/v2/personas/ab-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KIMI_API_KEY = "test-key";
    (defaultCircuitBreaker.isOpen as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (guardAndReserveCredits as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      availableUsd: 10,
      estimatedCostUsd: 0.1,
    });
  });

  it("retourne 400 si message absent", async () => {
    const { POST } = await import("@/app/api/v2/personas/ab-test/route");
    const req = new Request("http://t/api/v2/personas/ab-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personaIdA: "builtin:default", personaIdB: "builtin:formal" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si personaIdA/B manquants", async () => {
    const { POST } = await import("@/app/api/v2/personas/ab-test/route");
    const req = new Request("http://t/api/v2/personas/ab-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "salut" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("retourne 503 quand KIMI_API_KEY n'est pas configuré", async () => {
    delete process.env.KIMI_API_KEY;
    const { POST } = await import("@/app/api/v2/personas/ab-test/route");
    const req = new Request("http://t/api/v2/personas/ab-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "salut",
        personaIdA: "builtin:default",
        personaIdB: "builtin:formal",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(503);
  });

  it("appelle guardAndReserveCredits avec estimatedCostUsd=0.10 (2 appels)", async () => {
    const mockChat = vi.fn().mockResolvedValue({
      content: "Réponse de test.",
      tokens_in: 100,
      tokens_out: 50,
      cost_usd: 0.01,
      latency_ms: 150,
      provider: "kimi",
      model: "kimi-k2.5",
    });
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({ chat: mockChat });

    const { POST } = await import("@/app/api/v2/personas/ab-test/route");
    const req = new Request("http://t/api/v2/personas/ab-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Quel est ton style ?",
        personaIdA: "builtin:default",
        personaIdB: "builtin:formal",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(guardAndReserveCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedCostUsd: 0.1,
        userId: "user-test",
        tenantId: "tenant-test",
      }),
    );
    expect(getProvider).toHaveBeenCalledWith("kimi");
    expect(defaultCircuitBreaker.recordSuccess).toHaveBeenCalledWith("kimi", "tenant-test");
  });

  it("appelle recordSuccess après succès des 2 appels parallèles", async () => {
    const mockChat = vi
      .fn()
      .mockResolvedValueOnce({
        content: "Réponse A.",
        tokens_in: 80,
        tokens_out: 40,
        cost_usd: 0.008,
        latency_ms: 120,
        provider: "kimi",
        model: "kimi-k2.5",
      })
      .mockResolvedValueOnce({
        content: "Réponse B.",
        tokens_in: 90,
        tokens_out: 45,
        cost_usd: 0.009,
        latency_ms: 130,
        provider: "kimi",
        model: "kimi-k2.5",
      });
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({ chat: mockChat });

    const { POST } = await import("@/app/api/v2/personas/ab-test/route");
    const req = new Request("http://t/api/v2/personas/ab-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Compare nos styles.",
        personaIdA: "builtin:default",
        personaIdB: "builtin:formal",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Vérifie que pA et pB sont bien présents (multi-tenant scope V1-A2 intact)
    expect(json.a.persona).toBeDefined();
    expect(json.b.persona).toBeDefined();
    expect(json.a.persona.id).toBe("builtin:default");
    expect(json.b.persona.id).toBe("builtin:formal");
    expect(mockChat).toHaveBeenCalledTimes(2);
    expect(defaultCircuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
  });

  it("retourne 402 si credits insuffisants", async () => {
    (guardAndReserveCredits as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      availableUsd: 0.005,
      estimatedCostUsd: 0.1,
      reason: "insufficient_credits",
    });

    const { POST } = await import("@/app/api/v2/personas/ab-test/route");
    const req = new Request("http://t/api/v2/personas/ab-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "test",
        personaIdA: "builtin:default",
        personaIdB: "builtin:formal",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(402);
  });
});
