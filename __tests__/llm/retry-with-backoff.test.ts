/**
 * Tests : comportement de retryWithBackoff — fix hardDelay → actualDelay
 *
 * Objectif : prévenir la régression silencieuse (3e occurrence historique) où
 * le router utilisait le backoff exponentiel à la place du délai retry-after
 * explicite fourni par le provider.
 *
 * Cas A : retry-after court (< HARD_CAP) → setTimeout appelé avec hardDelay exact
 * Cas B : retry-after long (> HARD_CAP) → setTimeout capé à HARD_THROTTLE_CAP_MS + warn log
 * Cas C : pas de retry-after → setTimeout utilise backoff exponentiel ~1000ms
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HARD_THROTTLE_CAP_MS, retryWithBackoff } from "../../lib/llm/router";

// Mock du logger avant tout import dynamique
vi.mock("../../lib/observability/logger", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock minimal des dépendances lourdes du router
vi.mock("../../lib/llm/rate-limiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/llm/rate-limiter")>();
  return {
    ...actual,
    defaultRateLimiter: {
      checkLimit: vi.fn(),
      recordCall: vi.fn(),
      // getNextDelayDetailed retourne delay=0 → pas de throttle proactif qui polluerait setTimeout
      getNextDelayDetailed: vi.fn().mockReturnValue({ delay: 0, kind: "soft" }),
    },
  };
});

vi.mock("../../lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getState: vi.fn().mockReturnValue("CLOSED"),
  },
}));

vi.mock("../../lib/llm/metrics", () => ({
  defaultMetrics: {
    incrementCounter: vi.fn(),
    recordCall: vi.fn(),
    recordError: vi.fn(),
  },
}));

vi.mock("../../lib/llm/persist-run", () => ({
  persistRun: vi.fn(),
}));

vi.mock("../../lib/decisions/model-selector", () => ({
  scoreModels: vi.fn().mockResolvedValue([]),
  selectModel: vi.fn().mockReturnValue({
    selected: {
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      score: 0.9,
      reliability: "stable",
    },
    reason: "test",
    fallbacks: [],
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Filtre les appels setTimeout pertinents (>100ms) pour isoler les sleeps
 * du router des microtasks internes de vitest fake timers.
 */
function getRelevantSetTimeoutCalls(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter(([, ms]: [unknown, unknown]) => typeof ms === "number" && ms > 100);
}

// ---------------------------------------------------------------------------
// Cas A — retry-after court (< HARD_CAP) → délai exact respecté
// ---------------------------------------------------------------------------

describe("retryWithBackoff — Cas A : retry-after court (< HARD_CAP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("respecte le délai hard provider (5s) et non le backoff exponentiel (~1000ms)", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      // 429 déclenche isTransientError + "retry-after: 5" déclenche extractRetryAfterMs
      if (attempt === 1) throw new Error("429 rate_limited retry-after: 5");
      return "success";
    });

    const promise = retryWithBackoff(fn, 3, "anthropic");

    // Avance les timers de 5000ms pour débloquer le setTimeout(r, 5000)
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);

    const sleepCalls = getRelevantSetTimeoutCalls(setTimeoutSpy);
    expect(sleepCalls.length).toBeGreaterThanOrEqual(1);

    // AC2 : le délai effectif doit être 5000ms (hardDelay), PAS ~1000ms (backoff exponentiel)
    const actualDelay = sleepCalls[0][1] as number;
    expect(actualDelay).toBe(5_000);
    // Garantit qu'on n'a PAS utilisé le backoff classique (qui serait entre 800 et 1200ms)
    expect(actualDelay).toBeGreaterThan(1_200);
  });
});

// ---------------------------------------------------------------------------
// Cas B — retry-after long (> HARD_CAP) → cap + warn log
// ---------------------------------------------------------------------------

describe("retryWithBackoff — Cas B : retry-after long (> HARD_CAP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cap le délai à HARD_THROTTLE_CAP_MS et loggue un warning", async () => {
    const { logger } = await import("../../lib/observability/logger");
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      // retry-after: 120 → 120_000ms > HARD_THROTTLE_CAP_MS (60_000ms)
      if (attempt === 1) throw new Error("429 rate_limited retry-after: 120");
      return "success";
    });

    const promise = retryWithBackoff(fn, 3, "anthropic");

    // Avance de HARD_THROTTLE_CAP_MS pour débloquer (capé à 60s, pas 120s)
    await vi.advanceTimersByTimeAsync(HARD_THROTTLE_CAP_MS);
    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);

    const sleepCalls = getRelevantSetTimeoutCalls(setTimeoutSpy);
    expect(sleepCalls.length).toBeGreaterThanOrEqual(1);

    // AC3a : setTimeout appelé avec HARD_THROTTLE_CAP_MS (60_000ms), pas 120_000ms
    const actualDelay = sleepCalls[0][1] as number;
    expect(actualDelay).toBe(HARD_THROTTLE_CAP_MS);

    // AC3b : warn loggué avec les bonnes métadonnées
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        requestedDelayMs: 120_000,
        capMs: HARD_THROTTLE_CAP_MS,
      }),
      expect.stringMatching(/hard retry-after exceeded/i),
    );
  });
});

// ---------------------------------------------------------------------------
// Cas C — pas de retry-after → backoff exponentiel classique
// ---------------------------------------------------------------------------

describe("retryWithBackoff — Cas C : pas de retry-after → backoff classique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("utilise le backoff exponentiel (~1000ms ±20%) quand retry-after est absent", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      // 500 déclenche isTransientError, mais pas de "retry-after" → extractRetryAfterMs = 0
      if (attempt === 1) throw new Error("500 network timeout");
      return "success";
    });

    const promise = retryWithBackoff(fn, 3, "anthropic");

    // Avance de 2000ms pour couvrir le backoff base 1000ms + jitter ±20%
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);

    const sleepCalls = getRelevantSetTimeoutCalls(setTimeoutSpy);
    expect(sleepCalls.length).toBeGreaterThanOrEqual(1);

    // AC4 : délai dans la plage backoff exponentiel : base=1000ms, jitter±20% → [800, 1200]
    const actualDelay = sleepCalls[0][1] as number;
    expect(actualDelay).toBeGreaterThanOrEqual(800);
    expect(actualDelay).toBeLessThanOrEqual(1_200);
  });
});
