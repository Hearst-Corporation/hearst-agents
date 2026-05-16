/**
 * Implémentations du CircuitStore pour le LLMCircuitBreaker.
 *
 * - InMemoryCircuitStore : fallback local (tests, dev sans Redis)
 * - RedisCircuitStore    : persistance Upstash/ioredis (prod multi-instance)
 *
 * Le RedisCircuitStore est fail-soft : toute erreur Redis log un warn et
 * délègue à le cache in-memory interne — le LLM call n'est JAMAIS bloqué
 * à cause d'un Redis down.
 *
 * Stratégie lecture/écriture :
 * - getSync  → in-memory immédiate (zero-latency, chemin critique synchrone)
 * - set      → écrit in-memory + lance la persistance Redis en background
 * - hydrate  → appel async one-shot au 1er get() pour reconstruire après cold start
 */

import { logger } from "@/lib/observability/logger";
import type { CircuitState, CircuitStore, PersistedCircuitState } from "./circuit-breaker";

// ---------------------------------------------------------------------------
// InMemoryCircuitStore — fallback / implémentation de test
// ---------------------------------------------------------------------------

export class InMemoryCircuitStore implements CircuitStore {
  protected readonly data = new Map<string, PersistedCircuitState>();

  getSync(key: string): PersistedCircuitState | null {
    return this.data.get(key) ?? null;
  }

  async get(key: string): Promise<PersistedCircuitState | null> {
    return this.getSync(key);
  }

  async set(key: string, state: PersistedCircuitState): Promise<void> {
    this.data.set(key, { ...state });
  }

  incrementFailures(key: string): number {
    const current = this.data.get(key) ?? {
      status: "CLOSED" as CircuitState,
      failures: 0,
      openedAt: null,
    };
    const updated: PersistedCircuitState = { ...current, failures: current.failures + 1 };
    this.data.set(key, updated);
    return updated.failures;
  }

  async reset(key: string): Promise<void> {
    this.data.set(key, { status: "CLOSED", failures: 0, openedAt: null });
  }
}

// ---------------------------------------------------------------------------
// Interface minimale du client Redis (subset utilisé ici)
// ---------------------------------------------------------------------------

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: "EX", ttlSeconds?: number): Promise<unknown>;
  setex(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// RedisCircuitStore — persistance multi-instance, fail-soft
// ---------------------------------------------------------------------------

const REDIS_KEY_PREFIX = "circuit-breaker:";

export class RedisCircuitStore implements CircuitStore {
  /**
   * Cache in-memory local — source de vérité pour les lectures synchrones.
   * Redis est le store de persistance secondaire (survie cold start).
   */
  private readonly cache = new Map<string, PersistedCircuitState>();
  /** Clés déjà hydratées depuis Redis (évite les allers-retours répétés). */
  private readonly hydrated = new Set<string>();

  constructor(private readonly redis: RedisLike) {}

  private redisKey(key: string): string {
    return `${REDIS_KEY_PREFIX}${key}`;
  }

  /** Lit depuis le cache in-memory local (synchrone, zero-latency). */
  getSync(key: string): PersistedCircuitState | null {
    return this.cache.get(key) ?? null;
  }

  /**
   * Lecture async : hydrate depuis Redis si la clé n'est pas encore en cache.
   * Utile au 1er accès après un cold start Vercel.
   */
  async get(key: string): Promise<PersistedCircuitState | null> {
    if (!this.hydrated.has(key)) {
      await this._hydrateFromRedis(key);
    }
    return this.cache.get(key) ?? null;
  }

  /** Écrit in-memory immédiatement + persiste en Redis en arrière-plan. */
  async set(key: string, state: PersistedCircuitState, ttlMs?: number): Promise<void> {
    // Écriture synchrone locale d'abord
    this.cache.set(key, { ...state });
    this.hydrated.add(key);

    // Persistance Redis fire-and-forget
    this._persistToRedis(key, state, ttlMs).catch((err: unknown) => {
      logger.warn({ err, key }, "[circuit-store] Redis set failed (non-blocking)");
    });
  }

  /** Incrémente le compteur en mémoire (synchrone). Redis est mis à jour ensuite. */
  incrementFailures(key: string): number {
    const current = this.cache.get(key) ?? {
      status: "CLOSED" as CircuitState,
      failures: 0,
      openedAt: null,
    };
    const updated: PersistedCircuitState = { ...current, failures: current.failures + 1 };
    this.cache.set(key, updated);
    this.hydrated.add(key);

    // Sync Redis en arrière-plan
    this._persistToRedis(key, updated).catch((err: unknown) => {
      logger.warn(
        { err, key },
        "[circuit-store] Redis incrementFailures persist failed (non-blocking)",
      );
    });

    return updated.failures;
  }

  async reset(key: string): Promise<void> {
    this.cache.set(key, { status: "CLOSED", failures: 0, openedAt: null });
    this.hydrated.add(key);

    try {
      await this.redis.del(this.redisKey(key));
    } catch (err) {
      logger.warn({ err, key }, "[circuit-store] Redis reset failed (non-blocking)");
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers privés
  // ---------------------------------------------------------------------------

  private async _hydrateFromRedis(key: string): Promise<void> {
    this.hydrated.add(key); // Marquer avant l'appel pour éviter la double hydration
    try {
      const raw = await this.redis.get(this.redisKey(key));
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<PersistedCircuitState>;
      if (typeof parsed.status !== "string" || typeof parsed.failures !== "number") {
        return;
      }
      const state: PersistedCircuitState = {
        status: parsed.status as CircuitState,
        failures: parsed.failures,
        openedAt: typeof parsed.openedAt === "number" ? parsed.openedAt : null,
      };
      this.cache.set(key, state);
    } catch (err) {
      logger.warn({ err, key }, "[circuit-store] Redis hydrate failed (non-blocking)");
    }
  }

  private async _persistToRedis(
    key: string,
    state: PersistedCircuitState,
    ttlMs?: number,
  ): Promise<void> {
    const raw = JSON.stringify(state);
    const rKey = this.redisKey(key);

    if (ttlMs && ttlMs > 0) {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.redis.setex(rKey, ttlSeconds, raw);
    } else {
      await this.redis.set(rKey, raw);
    }
  }
}
