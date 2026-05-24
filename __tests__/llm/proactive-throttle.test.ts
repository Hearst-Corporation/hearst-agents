/**
 * Fix #1 — Throttle proactif câblé dans router.ts
 *
 * Stratégie : tester directement LLMRateLimiter.getNextDelay() intégré dans
 * retryWithBackoff via un mock du provider LLM. On vérifie que :
 * 1. getNextDelay() est consulté avec le bon provider name
 * 2. Un délai > 0 entraîne un sleep avant le call
 * 3. Le délai est capé à 1000ms
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ─── Tests ───────────────────────────────────────────────────────────────────

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
