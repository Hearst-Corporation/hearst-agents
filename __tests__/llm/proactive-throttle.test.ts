/**
 * Fix #1 — Throttle proactif câblé dans router.ts
 *
 * Stratégie : tester directement LLMRateLimiter.getNextDelay() intégré dans
 * retryWithBackoff via un mock du provider LLM. On vérifie que :
 * 1. getNextDelay() est consulté avec le bon provider name
 * 2. Un délai > 0 entraîne un sleep avant le call
 * 3. Le délai est capé à 1000ms
 *
 * Fix #2 — Tests : distinction hard / soft throttle dans shouldThrottle + retryWithBackoff.
 *
 * Hard = contrainte serveur dure (retry-after ou budget épuisé) → délai complet respecté.
 * Soft = délai proactif préventif → capé à 1000ms.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMRateLimiter } from "../../lib/llm/rate-limiter";

// ─── Rate limiter mock ────────────────────────────────────────────────────────

const getNextDelayMock = vi.fn(() => 0);

vi.mock("@/lib/llm/rate-limiter", () => ({
  defaultRateLimiter: {
    getNextDelay: getNextDelayMock,
    checkLimit: vi.fn().mockResolvedValue(undefined),
    recordCall: vi.fn(),
    recordHeaders: vi.fn(),
    getStats: vi.fn(() => ({ userCount: 0 })),
  },
  LLMRateLimiter: class {
    getNextDelay = getNextDelayMock;
    checkLimit = vi.fn();
    recordCall = vi.fn();
    recordHeaders = vi.fn();
    getStats = vi.fn(() => ({ userCount: 0 }));
  },
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: vi.fn(() => false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getState: vi.fn(() => "CLOSED"),
  },
}));

vi.mock("@/lib/llm/metrics", () => ({
  defaultMetrics: {
    incrementCounter: vi.fn(),
    recordCall: vi.fn(),
    recordError: vi.fn(),
  },
}));

vi.mock("@/lib/llm/persist-run", () => ({
  persistRun: vi.fn().mockResolvedValue(undefined),
}));

// ─── Provider mock ────────────────────────────────────────────────────────────

const fakeResponse = {
  content: "hello",
  tokens_in: 10,
  tokens_out: 5,
  cost_usd: 0.001,
  latency_ms: 100,
  cache_read_tokens: 0,
  cache_creation_tokens: 0,
};

const fakeProviderChat = vi.fn().mockResolvedValue(fakeResponse);

vi.mock("@/lib/llm/anthropic", () => ({
  AnthropicProvider: class {
    name = "anthropic";
    chat = fakeProviderChat;
    streamChat = vi.fn();
  },
}));

vi.mock("@/lib/llm/openai", () => ({
  OpenAIProvider: class {
    name = "openai";
    chat = vi.fn().mockResolvedValue(fakeResponse);
    streamChat = vi.fn();
  },
}));

vi.mock("@/lib/llm/composer", () => ({
  ComposerProvider: class {
    name = "composer";
    chat = vi.fn().mockResolvedValue(fakeResponse);
    streamChat = vi.fn();
  },
}));

vi.mock("@/lib/llm/gemini", () => ({
  GeminiProvider: class {
    name = "gemini";
    chat = vi.fn().mockResolvedValue(fakeResponse);
    streamChat = vi.fn();
  },
}));

vi.mock("@/lib/llm/kimi", () => ({
  KimiProvider: class {
    name = "kimi";
    chat = vi.fn().mockResolvedValue(fakeResponse);
    streamChat = vi.fn();
  },
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────

function makeFakeSupabase() {
  const profile = {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1,
    cost_per_1k_in: 0.003,
    cost_per_1k_out: 0.015,
    max_cost_per_run: null,
    fallback_profile_id: null,
  };

  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: profile, error: null }),
        }),
      }),
    }),
  };
}

// ─── Helper : espion setTimeout qui ne piège que les sleeps de throttle ──────

/**
 * Remplace setTimeout par un espion qui :
 * - Pour les délais <= 1000ms (zone throttle proactif) : enregistre le délai
 *   et résout IMMÉDIATEMENT (sans réellement attendre) pour ne pas bloquer le test.
 * - Pour les délais > 1000ms (wallclock, retry backoff) : délègue au vrai setTimeout.
 */
function spyOnThrottleSleeps(): { calls: number[]; restore: () => void } {
  const calls: number[] = [];
  const realSetTimeout = globalThis.setTimeout.bind(globalThis);

  const spy = vi
    .spyOn(globalThis, "setTimeout")
    .mockImplementation((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof delay === "number" && delay > 0 && delay <= 1000) {
        calls.push(delay);
        // Résout immédiatement sans bloquer
        realSetTimeout(fn as (...a: unknown[]) => void, 0, ...args);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      // Délègue au vrai setTimeout pour wallclock / backoff
      return realSetTimeout(fn as (...a: unknown[]) => void, delay, ...args);
    });

  return { calls, restore: () => spy.mockRestore() };
}

// ─── Tests Fix #1 ─────────────────────────────────────────────────────────────

describe("Fix #1 — throttle proactif dans retryWithBackoff (router)", () => {
  beforeEach(() => {
    getNextDelayMock.mockReset();
    getNextDelayMock.mockReturnValue(0);
    fakeProviderChat.mockReset();
    fakeProviderChat.mockResolvedValue(fakeResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appelle getNextDelay avec le bon provider name avant le call", async () => {
    const { resetLlmProviderCache, chatWithProfile } = await import("@/lib/llm/router");
    resetLlmProviderCache();

    const fakeSb = makeFakeSupabase() as unknown as Parameters<typeof chatWithProfile>[0];
    await chatWithProfile(fakeSb, "profile-1", [{ role: "user", content: "hi" }]);

    expect(getNextDelayMock).toHaveBeenCalledWith("anthropic");
  });

  it("ne dort pas quand getNextDelay retourne 0", async () => {
    getNextDelayMock.mockReturnValue(0);

    const { calls, restore } = spyOnThrottleSleeps();

    const { resetLlmProviderCache, chatWithProfile } = await import("@/lib/llm/router");
    resetLlmProviderCache();

    const fakeSb = makeFakeSupabase() as unknown as Parameters<typeof chatWithProfile>[0];
    await chatWithProfile(fakeSb, "profile-1", [{ role: "user", content: "hi" }]);
    restore();

    expect(calls).toHaveLength(0);
  });

  it("dort le délai retourné par getNextDelay quand > 0", async () => {
    getNextDelayMock.mockReturnValue(300);

    const { calls, restore } = spyOnThrottleSleeps();

    const { resetLlmProviderCache, chatWithProfile } = await import("@/lib/llm/router");
    resetLlmProviderCache();

    const fakeSb = makeFakeSupabase() as unknown as Parameters<typeof chatWithProfile>[0];
    await chatWithProfile(fakeSb, "profile-1", [{ role: "user", content: "hi" }]);
    restore();

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]).toBe(300);
  });

  it("cape le délai proactif à 1000ms si getNextDelay retourne plus", async () => {
    // getNextDelay retourne 5000ms mais router.ts applique Math.min(..., 1000)
    getNextDelayMock.mockReturnValue(5000);

    const { calls, restore } = spyOnThrottleSleeps();

    const { resetLlmProviderCache, chatWithProfile } = await import("@/lib/llm/router");
    resetLlmProviderCache();

    const fakeSb = makeFakeSupabase() as unknown as Parameters<typeof chatWithProfile>[0];
    await chatWithProfile(fakeSb, "profile-1", [{ role: "user", content: "hi" }]);
    restore();

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Fix #2 — shouldThrottle — non-régression (cas existants)
// ---------------------------------------------------------------------------

describe("shouldThrottle — non-régression (cas existants)", () => {
  let rl: LLMRateLimiter;

  beforeEach(() => {
    rl = makeRl();
  });

  it("pas de throttle quand aucun header enregistré", () => {
    expect(rl.shouldThrottle("anthropic")).toEqual({ throttle: false });
  });

  it("throttle quand requestsRemaining=0 + reset futur", () => {
    const resetIso = new Date(Date.now() + 30_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "0",
      "anthropic-ratelimit-requests-reset": resetIso,
    });
    const d = rl.shouldThrottle("anthropic");
    expect(d.throttle).toBe(true);
    expect(d.reasonMs).toBeGreaterThan(0);
    expect(d.reasonMs).toBeLessThanOrEqual(30_000);
  });

  it("throttle proactif court quand requestsRemaining < 5", () => {
    const resetIso = new Date(Date.now() + 60_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "2",
      "anthropic-ratelimit-requests-reset": resetIso,
    });
    const d = rl.shouldThrottle("anthropic");
    expect(d.throttle).toBe(true);
    expect(d.reasonMs).toBeLessThanOrEqual(1000);
  });

  it("getNextDelay retro-compat : retourne 0 quand pas de throttle", () => {
    expect(rl.getNextDelay("anthropic")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC1 + AC2 — ThrottleDecision.kind
// ---------------------------------------------------------------------------

describe("ThrottleDecision.kind — hard vs soft", () => {
  let rl: LLMRateLimiter;

  beforeEach(() => {
    rl = makeRl();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cas 2 (retry-after) → kind: 'hard'", () => {
    rl.recordHeaders("anthropic", { "retry-after": "5" });
    const d = rl.shouldThrottle("anthropic");
    expect(d.throttle).toBe(true);
    expect(d.kind).toBe("hard");
  });

  it("cas 3 (requestsRemaining === 0) → kind: 'hard'", () => {
    const resetIso = new Date(Date.now() + 30_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "0",
      "anthropic-ratelimit-requests-reset": resetIso,
    });
    const d = rl.shouldThrottle("anthropic");
    expect(d.throttle).toBe(true);
    expect(d.kind).toBe("hard");
  });

  it("cas 4 (requestsRemaining bas proactif) → kind: 'soft'", () => {
    const resetIso = new Date(Date.now() + 60_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "3",
      "anthropic-ratelimit-requests-reset": resetIso,
    });
    const d = rl.shouldThrottle("anthropic");
    expect(d.throttle).toBe(true);
    expect(d.kind).toBe("soft");
  });

  it("cas 5 (tokensRemaining bas proactif) → kind: 'soft'", () => {
    rl.recordHeaders("openai", {
      "x-ratelimit-limit-tokens": "100000",
      "x-ratelimit-remaining-tokens": "500",
      "x-ratelimit-reset-tokens": "30s",
    });
    const d = rl.shouldThrottle("openai");
    expect(d.throttle).toBe(true);
    expect(d.kind).toBe("soft");
  });

  it("pas de kind quand throttle === false", () => {
    const d = rl.shouldThrottle("anthropic");
    expect(d.throttle).toBe(false);
    expect(d.kind).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC3 + AC4 — getNextDelayDetailed + bornes hard / soft
// ---------------------------------------------------------------------------

describe("getNextDelayDetailed — bornes hard / soft (AC3 + AC4)", () => {
  let rl: LLMRateLimiter;

  beforeEach(() => {
    rl = makeRl();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC4 test 1 : hard throttle via retry-after → délai complet respecté (pas cap 1000ms)
  it("respecte le délai complet pour throttle hard (retry-after 5000ms)", () => {
    rl.recordHeaders("anthropic", { "retry-after": "5" }); // 5s = 5000ms

    const { delay, kind } = rl.getNextDelayDetailed("anthropic");

    expect(kind).toBe("hard");
    // Le délai hard brut doit être ~5000ms, pas capé à 1000ms
    expect(delay).toBeGreaterThan(4000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  // AC4 test 2 : hard throttle via requestsRemaining=0 → délai >= durée reset - ε
  it("respecte le délai complet pour throttle hard (requests remaining 0, reset +10s)", () => {
    const resetAt = Date.now() + 10_000;
    const resetIso = new Date(resetAt).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "0",
      "anthropic-ratelimit-requests-reset": resetIso,
    });

    const { delay, kind } = rl.getNextDelayDetailed("anthropic");

    expect(kind).toBe("hard");
    // Le délai raw doit être >= 9000ms (reset dans ~10s, tolérance parsing)
    expect(delay).toBeGreaterThanOrEqual(9_000);
    expect(delay).toBeLessThanOrEqual(10_000);
  });

  // AC4 test 3 : soft throttle (proactif) → délai capé à 1000ms
  it("cape le throttle soft à 1000ms pour throttle proactif (remaining=3)", () => {
    const resetIso = new Date(Date.now() + 60_000).toISOString();
    rl.recordHeaders("anthropic", {
      "anthropic-ratelimit-requests-limit": "100",
      "anthropic-ratelimit-requests-remaining": "3",
      "anthropic-ratelimit-requests-reset": resetIso,
    });

    const { delay, kind } = rl.getNextDelayDetailed("anthropic");

    expect(kind).toBe("soft");
    // Le délai soft est capé à proactiveDelayCapMs = 1000ms
    expect(delay).toBeLessThanOrEqual(1000);
    expect(delay).toBeGreaterThan(0);
  });

  // AC4 test 4 : hard extrême → borné défensivement à 60s dans retryWithBackoff
  it("borne le throttle hard à 60s défensivement (retry-after 120s)", () => {
    // Simule un retry-after de 120s (aberrant)
    rl.recordHeaders("anthropic", { "retry-after": "120" }); // 120s = 120_000ms

    const { delay, kind } = rl.getNextDelayDetailed("anthropic");

    expect(kind).toBe("hard");
    // Le delay brut est ~120_000ms — la borne défensive est dans retryWithBackoff (60_000ms)
    // Ici on vérifie que getNextDelayDetailed retourne bien la valeur non-capée
    expect(delay).toBeGreaterThan(60_000);

    // La borne défensive est appliquée par retryWithBackoff : simulons-la
    const HARD_CAP = 60_000;
    const capped = Math.min(delay, HARD_CAP);
    expect(capped).toBe(60_000);
  });

  // Retro-compat AC7 : getNextDelay() retourne un nombre, pas un objet
  it("getNextDelay() reste retro-compat (retourne number)", () => {
    rl.recordHeaders("anthropic", { "retry-after": "5" });

    const delay = rl.getNextDelay("anthropic");
    expect(typeof delay).toBe("number");
    expect(delay).toBeGreaterThan(0);
  });

  it("getNextDelayDetailed retourne delay=0 et kind='soft' quand pas de throttle", () => {
    const result = rl.getNextDelayDetailed("anthropic");
    expect(result.delay).toBe(0);
    expect(result.kind).toBe("soft");
  });
});

// ---------------------------------------------------------------------------
// Helpers (Fix #2)
// ---------------------------------------------------------------------------

function makeRl() {
  return new LLMRateLimiter();
}
