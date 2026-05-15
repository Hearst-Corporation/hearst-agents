/**
 * F-079 — Daily caps fail-closed en production
 *
 * Vérifie que checkDailyCap retourne allowed:false si Redis est indisponible
 * en NODE_ENV=production, et allowed:true en dev/test (comportement existant).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// On mock le module Redis pour simuler l'indisponibilité.
vi.mock("@/lib/platform/redis/client", () => ({
  getRedis: vi.fn(),
}));

import { getRedis } from "@/lib/platform/redis/client";

const mockGetRedis = getRedis as ReturnType<typeof vi.fn>;

describe("F-079 — checkDailyCap fail-closed en production", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("retourne allowed:false avec reason='rate_limiter_unavailable' si Redis absent en prod", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockGetRedis.mockReturnValue(null);

    const { checkDailyCap } = await import("@/lib/credits/daily-caps");
    const result = await checkDailyCap("user-prod", "daily-brief", 5);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("rate_limiter_unavailable");
  });

  it("retourne allowed:true si Redis absent en développement (bypass dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockGetRedis.mockReturnValue(null);

    const { checkDailyCap } = await import("@/lib/credits/daily-caps");
    const result = await checkDailyCap("user-dev", "daily-brief", 5);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("retourne allowed:true si Redis absent en test (bypass test)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockGetRedis.mockReturnValue(null);

    const { checkDailyCap } = await import("@/lib/credits/daily-caps");
    const result = await checkDailyCap("user-test", "simulations", 10);

    expect(result.allowed).toBe(true);
  });

  it("respecte le quota quand Redis est disponible et fonctionnel", async () => {
    mockGetRedis.mockReturnValue({
      incr: vi.fn().mockResolvedValue(3),
      expire: vi.fn().mockResolvedValue(1),
    });

    const { checkDailyCap } = await import("@/lib/credits/daily-caps");
    const result = await checkDailyCap("user-a", "daily-brief", 5);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(3);
    expect(result.max).toBe(5);
  });

  it("bloque quand le quota est dépassé (current > max)", async () => {
    mockGetRedis.mockReturnValue({
      incr: vi.fn().mockResolvedValue(6),
      expire: vi.fn().mockResolvedValue(1),
    });

    const { checkDailyCap } = await import("@/lib/credits/daily-caps");
    const result = await checkDailyCap("user-a", "daily-brief", 5);

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(6);
  });

  it("fail-closed si Redis.incr() throw (erreur réseau)", async () => {
    mockGetRedis.mockReturnValue({
      incr: vi.fn().mockRejectedValue(new Error("ECONNRESET")),
      expire: vi.fn(),
    });

    const { checkDailyCap } = await import("@/lib/credits/daily-caps");
    const result = await checkDailyCap("user-a", "daily-brief", 5);

    // Le catch existant dans checkDailyCap retourne allowed:false
    expect(result.allowed).toBe(false);
  });
});
