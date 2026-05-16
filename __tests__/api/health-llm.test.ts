/**
 * Smoke test pour GET /api/health/llm.
 *
 * Vérifie :
 *   - 200 OK
 *   - structure JSON conforme (ok, checked_at, providers, langfuse)
 *   - chaque provider tracké (anthropic, openai, gemini) a les champs requis
 *
 * Mocks Langfuse pour éviter de devoir set des env vars en test.
 */

import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/langfuse", () => ({
  getLangfuseClient: vi.fn(() => null),
}));

// Bypass admin guard pour ce test smoke (la garde elle-même est testée
// ailleurs). On retourne un objet AdminGuardResult-like mais le helper
// `isError` regarde uniquement si c'est une NextResponse — donc un objet
// nu suffit.
vi.mock("@/app/api/admin/_helpers", () => ({
  requireAdmin: vi.fn(async () => ({ scope: {}, db: {} })),
  isError: (result: unknown): result is NextResponse => result instanceof NextResponse,
}));

describe("GET /api/health/llm", () => {
  it("retourne 200 + structure JSON conforme", async () => {
    const { GET } = await import("@/app/api/health/llm/route");
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);

    expect(res.status).toBe(200);
    const body = await res.json();

    // Top-level shape
    expect(body).toHaveProperty("ok");
    expect(typeof body.ok).toBe("boolean");
    expect(body).toHaveProperty("checked_at");
    expect(typeof body.checked_at).toBe("string");
    expect(body).toHaveProperty("providers");
    expect(body).toHaveProperty("langfuse");

    // Providers — les 3 trackés sont présents
    expect(body.providers).toHaveProperty("anthropic");
    expect(body.providers).toHaveProperty("openai");
    expect(body.providers).toHaveProperty("gemini");

    // Forme d'un provider (anthropic)
    const a = body.providers.anthropic;
    expect(["ok", "degraded", "down"]).toContain(a.status);
    expect(["CLOSED", "HALF_OPEN", "OPEN"]).toContain(a.breaker_state);
    expect(a).toHaveProperty("latency_ms");
    expect(a).toHaveProperty("cache_hit_ratio_24h");
    expect(a).toHaveProperty("headroom");
    expect(a.headroom).toHaveProperty("requests_remaining");
    expect(a.headroom).toHaveProperty("tokens_remaining");
    expect(a.headroom).toHaveProperty("reset_at");

    // Langfuse
    expect(body.langfuse).toHaveProperty("enabled");
    expect(body.langfuse).toHaveProperty("flushable");
    expect(typeof body.langfuse.enabled).toBe("boolean");
  });

  it("cache_hit_ratio_24h est null pour openai et gemini (Anthropic-only)", async () => {
    const { GET } = await import("@/app/api/health/llm/route");
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    const body = await res.json();

    expect(body.providers.openai.cache_hit_ratio_24h).toBeNull();
    expect(body.providers.gemini.cache_hit_ratio_24h).toBeNull();
  });
});
