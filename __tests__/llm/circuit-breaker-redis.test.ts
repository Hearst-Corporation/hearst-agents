/**
 * Tests du RedisCircuitStore — persistance multi-instance, fail-soft.
 *
 * Couvre :
 * 1. État persiste après "redémarrage" (réinstanciation breaker + nouveau store)
 * 2. Fail-soft : Redis throw → fallback in-memory, ne crash pas
 * 3. TTL : OPEN → HALF_OPEN après expiration du reset window
 * 4. Isolation per-tenant : tenant A trip ne bloque pas tenant B
 * 5. Hydration au cold start : get() lit depuis Redis si cache miss
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMCircuitBreaker } from "../../lib/llm/circuit-breaker";
import { RedisCircuitStore } from "../../lib/llm/redis-circuit-store";

// ---------------------------------------------------------------------------
// Mock Redis — implémentation in-memory qui simule l'API RedisLike
// ---------------------------------------------------------------------------

interface MockRedisStore {
  [key: string]: { value: string; expiresAt?: number };
}

function createMockRedis(store: MockRedisStore = {}) {
  return {
    _store: store,
    async get(key: string): Promise<string | null> {
      const entry = store[key];
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        delete store[key];
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string): Promise<unknown> {
      store[key] = { value };
      return "OK";
    },
    async setex(key: string, ttlSeconds: number, value: string): Promise<unknown> {
      store[key] = { value, expiresAt: Date.now() + ttlSeconds * 1000 };
      return "OK";
    },
    async del(key: string): Promise<number> {
      if (store[key]) {
        delete store[key];
        return 1;
      }
      return 0;
    },
    async incr(key: string): Promise<number> {
      const entry = store[key];
      const current = entry ? parseInt(entry.value, 10) : 0;
      const next = current + 1;
      store[key] = { value: String(next) };
      return next;
    },
  };
}

// ---------------------------------------------------------------------------

describe("RedisCircuitStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // 1. État persiste après réinstanciation
  // ---------------------------------------------------------------------------
  it("persists circuit state across breaker re-instantiation (cold start survival)", async () => {
    const sharedStore: MockRedisStore = {};
    const redis = createMockRedis(sharedStore);

    // Instance 1 : trip le circuit
    const circuitStore1 = new RedisCircuitStore(redis);
    const breaker1 = new LLMCircuitBreaker(circuitStore1);

    for (let i = 0; i < 5; i++) {
      breaker1.recordFailure("openai", new Error("503 server error"));
    }
    // Flush les promises fire-and-forget
    await vi.runAllTimersAsync();

    expect(breaker1.isOpen("openai")).toBe(true);

    // Instance 2 : nouveau breaker, même backing Redis (simule cold start Vercel)
    const circuitStore2 = new RedisCircuitStore(redis);
    const breaker2 = new LLMCircuitBreaker(circuitStore2);

    // À la 1re lecture sync, le cache est vide → CLOSED par défaut (avant hydration)
    // Mais après hydration async, le circuit doit être OPEN
    const hydratedState = await circuitStore2.get("openai");
    expect(hydratedState?.status).toBe("OPEN");
    expect(hydratedState?.failures).toBe(5);

    // Après hydration manuelle dans un cas réel, isOpen() lirait le cache hydraté
    // Ici on vérifie que le store Redis contient bien l'état OPEN
    const rawState = await redis.get("circuit-breaker:openai");
    expect(rawState).not.toBeNull();
    const parsed = JSON.parse(rawState!);
    expect(parsed.status).toBe("OPEN");
    expect(parsed.failures).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // 2. Fail-soft : Redis down → fallback in-memory, ne crash pas
  // ---------------------------------------------------------------------------
  it("falls back to in-memory when Redis throws — LLM call is never blocked", async () => {
    const brokenRedis = {
      async get(): Promise<string | null> {
        throw new Error("Redis ECONNREFUSED");
      },
      async set(): Promise<unknown> {
        throw new Error("Redis ECONNREFUSED");
      },
      async setex(): Promise<unknown> {
        throw new Error("Redis ECONNREFUSED");
      },
      async del(): Promise<number> {
        throw new Error("Redis ECONNREFUSED");
      },
      async incr(): Promise<number> {
        throw new Error("Redis ECONNREFUSED");
      },
    };

    const store = new RedisCircuitStore(brokenRedis);
    const breaker = new LLMCircuitBreaker(store);

    // Ne doit pas throw malgré Redis cassé
    expect(() => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure("anthropic", new Error("500 error"));
      }
    }).not.toThrow();

    expect(breaker.isOpen("anthropic")).toBe(true);
    expect(breaker.getState("anthropic")).toBe("OPEN");

    // recordSuccess ne doit pas throw non plus
    await vi.runAllTimersAsync();
    vi.advanceTimersByTime(60_001);
    expect(() => breaker.recordSuccess("anthropic")).not.toThrow();
    expect(breaker.getState("anthropic")).toBe("CLOSED");
  });

  // ---------------------------------------------------------------------------
  // 3. TTL : OPEN → HALF_OPEN après expiration du reset window
  // ---------------------------------------------------------------------------
  it("transitions OPEN → HALF_OPEN after reset window TTL expires", async () => {
    const sharedStore: MockRedisStore = {};
    const redis = createMockRedis(sharedStore);
    const store = new RedisCircuitStore(redis);
    const breaker = new LLMCircuitBreaker(store);

    for (let i = 0; i < 5; i++) {
      breaker.recordFailure("gemini", new Error("502 bad gateway"));
    }
    await vi.runAllTimersAsync();

    expect(breaker.getState("gemini")).toBe("OPEN");
    expect(breaker.isOpen("gemini")).toBe(true);

    // Avance le temps au-delà du reset window (60s)
    vi.advanceTimersByTime(60_001);

    expect(breaker.getState("gemini")).toBe("HALF_OPEN");
    expect(breaker.isOpen("gemini")).toBe(false);

    // Un succès doit fermer le circuit
    breaker.recordSuccess("gemini");
    expect(breaker.getState("gemini")).toBe("CLOSED");
  });

  // ---------------------------------------------------------------------------
  // 4. Isolation per-tenant
  // ---------------------------------------------------------------------------
  it("isolates circuits per tenant — tenant A trip does not block tenant B", async () => {
    const redis = createMockRedis();
    const store = new RedisCircuitStore(redis);
    const breaker = new LLMCircuitBreaker(store);

    // Trip le circuit pour tenant-A
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure("openai", new Error("500 error"), "tenant-A");
    }
    await vi.runAllTimersAsync();

    expect(breaker.isOpen("openai", "tenant-A")).toBe(true);
    expect(breaker.getState("openai", "tenant-A")).toBe("OPEN");

    // Tenant B doit rester CLOSED
    expect(breaker.isOpen("openai", "tenant-B")).toBe(false);
    expect(breaker.getState("openai", "tenant-B")).toBe("CLOSED");

    // Provider différent aussi CLOSED
    expect(breaker.isOpen("anthropic", "tenant-A")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 5. Hydration depuis Redis au cold start
  // ---------------------------------------------------------------------------
  it("hydrates in-memory cache from Redis on first async get()", async () => {
    // Prépopule Redis avec un état OPEN (simule un état persisté avant cold start)
    const sharedStore: MockRedisStore = {
      "circuit-breaker:kimi": {
        value: JSON.stringify({ status: "OPEN", failures: 7, openedAt: Date.now() - 1000 }),
      },
    };
    const redis = createMockRedis(sharedStore);
    const store = new RedisCircuitStore(redis);

    // Avant hydration : getSync retourne null (cache vide)
    expect(store.getSync("kimi")).toBeNull();

    // Après hydration async
    const state = await store.get("kimi");
    expect(state).not.toBeNull();
    expect(state?.status).toBe("OPEN");
    expect(state?.failures).toBe(7);

    // Maintenant getSync doit aussi retourner l'état hydraté
    const syncState = store.getSync("kimi");
    expect(syncState?.status).toBe("OPEN");
    expect(syncState?.failures).toBe(7);
  });
});
