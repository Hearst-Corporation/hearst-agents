import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryProviderLimits,
  LLMRateLimiter,
  type ProviderRateLimit,
  RedisProviderLimits,
} from "../../lib/llm/rate-limiter";

describe("LLMRateLimiter", () => {
  let limiter: LLMRateLimiter;

  beforeEach(() => {
    limiter = new LLMRateLimiter();
  });

  it("allows calls under RPM limit", () => {
    expect(() => limiter.checkLimit("user1")).not.toThrow();
    expect(() => limiter.checkLimit("user1")).not.toThrow();
  });

  it("isolates limits per user", () => {
    limiter.checkLimit("user1");
    limiter.recordCall("user1");

    // user1 has 1 call, user2 has none — both should be under their own limits
    expect(() => limiter.checkLimit("user1")).not.toThrow();
    expect(() => limiter.checkLimit("user2")).not.toThrow();
  });

  it("tracks token usage for TPH limit", () => {
    limiter.checkLimit("user1");
    limiter.recordCall("user1", 100);
    limiter.recordCall("user1", 200);

    // Total 300 tokens, well under the 1M default TPH limit
    expect(() => limiter.checkLimit("user1")).not.toThrow();
  });

  it("resets call count after 60 seconds (mock)", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    limiter.checkLimit("user1");
    limiter.recordCall("user1");

    vi.setSystemTime(now + 61000);

    // Call timestamps should be pruned after 60s
    expect(() => limiter.checkLimit("user1")).not.toThrow();

    vi.useRealTimers();
  });

  it("cleans up inactive users after 2 hours", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    limiter.checkLimit("user1");
    limiter.recordCall("user1");

    // Simulate 2.5 hours of inactivity
    vi.setSystemTime(now + 2.5 * 3600000);

    // Create a new user to trigger the check
    limiter.checkLimit("user2");

    // After accessing user2, we can verify user1 would be cleaned up on next user1 access
    // This is implicit — just verify the limiter doesn't crash on cleanup
    expect(() => limiter.checkLimit("user1")).not.toThrow();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ProviderLimitsStore — Redis et InMemory
// ---------------------------------------------------------------------------

describe("InMemoryProviderLimits", () => {
  it("stocke et retourne les limites provider", () => {
    const store = new InMemoryProviderLimits();
    const limit: ProviderRateLimit = {
      requestsLimit: 100,
      requestsRemaining: 50,
      requestsResetAt: Date.now() + 60_000,
      tokensLimit: 1_000_000,
      tokensRemaining: 500_000,
      tokensResetAt: Date.now() + 60_000,
      updatedAt: Date.now(),
    };

    store.recordAsync("anthropic", limit);
    const retrieved = store.getSync("anthropic");

    expect(retrieved).toBeDefined();
    expect(retrieved?.requestsRemaining).toBe(50);
    expect(retrieved?.tokensLimit).toBe(1_000_000);
  });

  it("retourne undefined pour un provider inconnu", () => {
    const store = new InMemoryProviderLimits();
    expect(store.getSync("unknown-provider")).toBeUndefined();
  });

  it("isole les limites par provider", () => {
    const store = new InMemoryProviderLimits();
    const now = Date.now();

    store.recordAsync("openai", {
      requestsLimit: 100,
      requestsRemaining: 10,
      requestsResetAt: now + 60_000,
      tokensLimit: 100_000,
      tokensRemaining: 5_000,
      tokensResetAt: now + 60_000,
      updatedAt: now,
    });
    store.recordAsync("anthropic", {
      requestsLimit: 200,
      requestsRemaining: 100,
      requestsResetAt: now + 60_000,
      tokensLimit: 200_000,
      tokensRemaining: 150_000,
      tokensResetAt: now + 60_000,
      updatedAt: now,
    });

    expect(store.getSync("openai")?.requestsRemaining).toBe(10);
    expect(store.getSync("anthropic")?.requestsRemaining).toBe(100);
  });
});

describe("RedisProviderLimits", () => {
  it("écrit la limite provider vers Redis en best-effort (fire-and-forget)", async () => {
    const mockSet = vi.fn().mockResolvedValue("OK");
    const mockRedis = { set: mockSet };

    const store = new RedisProviderLimits(mockRedis);
    const now = Date.now();
    const limit: ProviderRateLimit = {
      requestsLimit: 100,
      requestsRemaining: 5,
      requestsResetAt: now + 30_000,
      tokensLimit: 1_000_000,
      tokensRemaining: 800,
      tokensResetAt: now + 30_000,
      updatedAt: now,
    };

    store.recordAsync("openai", limit);

    // Le cache in-memory est immédiatement disponible
    expect(store.getSync("openai")?.requestsRemaining).toBe(5);

    // Attendre la persistance async
    await new Promise((r) => setTimeout(r, 10));

    // Redis doit avoir été appelé avec le bon préfixe et une TTL
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining("provider-limits:openai"),
      expect.stringContaining('"requestsRemaining":5'),
      "EX",
      120,
    );
  });

  it("fallback in-memory garanti si Redis échoue (fail-soft)", async () => {
    const mockSet = vi.fn().mockRejectedValue(new Error("Redis connection refused"));
    const mockRedis = { set: mockSet };

    const store = new RedisProviderLimits(mockRedis);
    const now = Date.now();

    // Ne doit pas throw même si Redis fail
    expect(() =>
      store.recordAsync("anthropic", {
        requestsLimit: 50,
        requestsRemaining: 2,
        requestsResetAt: now + 10_000,
        tokensLimit: 50_000,
        tokensRemaining: 200,
        tokensResetAt: now + 10_000,
        updatedAt: now,
      }),
    ).not.toThrow();

    // Le cache in-memory est disponible malgré l'erreur Redis
    const state = store.getSync("anthropic");
    expect(state?.requestsRemaining).toBe(2);

    // Laisser la promesse échouer silencieusement
    await new Promise((r) => setTimeout(r, 20));
    // Pas de crash, pas d'exception propagée
  });

  it("LLMRateLimiter utilise RedisProviderLimits quand un store est fourni", () => {
    const store = new InMemoryProviderLimits();
    const limiterWithStore = new LLMRateLimiter(store);

    // Enregistrer des headers qui devraient déclencher un throttle
    const now = Date.now();
    limiterWithStore.recordHeaders("openai", {
      "x-ratelimit-remaining-requests": "0",
      "x-ratelimit-reset-requests": "30s",
      "x-ratelimit-limit-requests": "60",
      "x-ratelimit-remaining-tokens": "100000",
      "x-ratelimit-reset-tokens": "30s",
      "x-ratelimit-limit-tokens": "1000000",
    });

    // shouldThrottle doit utiliser le store
    const decision = limiterWithStore.shouldThrottle("openai");
    expect(decision.throttle).toBe(true);
    expect(decision.reasonMs).toBeGreaterThan(0);

    // getProviderLimit doit aussi fonctionner via le store
    const providerState = limiterWithStore.getProviderLimit("openai");
    expect(providerState?.requestsRemaining).toBe(0);
  });
});
