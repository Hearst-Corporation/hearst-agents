/**
 * LLMCircuitBreaker — store pluggable avec persistance Redis.
 *
 * API PUBLIQUE SYNCHRONE INCHANGÉE : isOpen / recordSuccess / recordFailure /
 * getState / getProviderSnapshot conservent leurs signatures. router.ts ne
 * doit pas être modifié.
 *
 * Stratégie de persistance :
 * - Lecture  : in-memory immédiate (synchrone, zero-latency)
 * - Écriture : fire-and-forget vers Redis + in-memory simultané
 * - Fail-soft: si Redis throw → warn + in-memory seul, LLM call jamais bloqué
 * - Hydration : au premier accès à une clé, tente de récupérer l'état Redis
 *   pour reconstruire le cache in-memory (survie au cold start Vercel)
 */

import { logger } from "@/lib/observability/logger";
import { getRedis } from "@/lib/platform/redis/client";
import { InMemoryCircuitStore, RedisCircuitStore } from "./redis-circuit-store";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/** Snapshot persisté pour un circuit donné. */
export interface PersistedCircuitState {
  status: CircuitState;
  failures: number;
  openedAt: number | null;
}

/**
 * Interface du store — injectable pour les tests.
 *
 * sync* = méthodes appelées sur le chemin synchrone critique (lecture)
 * Les méthodes async sont fire-and-forget côté appelant.
 */
export interface CircuitStore {
  /** Lecture synchrone depuis le cache local. */
  getSync(key: string): PersistedCircuitState | null;
  /** Lecture async (peut aller chercher en Redis si cache miss). */
  get(key: string): Promise<PersistedCircuitState | null>;
  /** Persiste l'état (fire-and-forget compatible). */
  set(key: string, state: PersistedCircuitState, ttlMs?: number): Promise<void>;
  /** Incrémente atomiquement le compteur d'échecs. Sync-compatible via cache. */
  incrementFailures(key: string): number;
  /** Reset complet. */
  reset(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// LLMCircuitBreaker — API publique INCHANGÉE
// ---------------------------------------------------------------------------

export class LLMCircuitBreaker {
  private readonly store: CircuitStore;
  private readonly failureThreshold = 5;
  private readonly resetWindowMs = 60_000;

  constructor(store?: CircuitStore) {
    this.store = store ?? createDefaultStore();
  }

  /** Génère une clé unique par provider + tenant optionnel. */
  private key(provider: string, tenantId?: string): string {
    return tenantId ? `${provider}:${tenantId}` : provider;
  }

  isOpen(provider: string, tenantId?: string): boolean {
    const k = this.key(provider, tenantId);
    const circuit = this.store.getSync(k);
    if (!circuit) return false;

    if (circuit.status === "CLOSED") return false;

    if (circuit.status === "OPEN") {
      const now = Date.now();
      if (circuit.openedAt && now - circuit.openedAt >= this.resetWindowMs) {
        // Transition OPEN → HALF_OPEN (fire-and-forget)
        const next: PersistedCircuitState = { ...circuit, status: "HALF_OPEN" };
        void this.store.set(k, next);
        return false;
      }
      return true;
    }

    // HALF_OPEN → laisse passer
    return false;
  }

  recordSuccess(provider: string, tenantId?: string): void {
    const k = this.key(provider, tenantId);
    const circuit = this.store.getSync(k);
    if (!circuit) return;

    // Sync timeout avant traitement
    let currentStatus = circuit.status;
    if (currentStatus === "OPEN" && circuit.openedAt) {
      const now = Date.now();
      if (now - circuit.openedAt >= this.resetWindowMs) {
        currentStatus = "HALF_OPEN";
      }
    }

    if (currentStatus === "HALF_OPEN" || currentStatus === "CLOSED") {
      void this.store.set(k, { status: "CLOSED", failures: 0, openedAt: null });
    }
  }

  /**
   * Enregistre un échec provider. Le breaker ne trip que sur des erreurs
   * réellement transitoires côté serveur (5xx) ou network.
   *
   * Le `httpStatus` numérique (si fourni par l'appelant via `response.status`)
   * est la source de vérité pour décider 4xx/5xx. La regex sur `error.message`
   * reste un fallback pour les erreurs non-HTTP.
   *
   * Closes audit P0-9 "circuit breaker poisoning".
   */
  recordFailure(provider: string, error: Error, tenantId?: string, httpStatus?: number): void {
    // Source de vérité : status numérique si fourni
    if (typeof httpStatus === "number") {
      if (httpStatus >= 400 && httpStatus < 500) return;
    } else if (/\b4\d{2}\b/.test(error.message)) {
      return;
    }

    const k = this.key(provider, tenantId);
    const failures = this.store.incrementFailures(k);
    const circuit = this.store.getSync(k);
    if (!circuit) return;

    // Sync timeout avant traitement
    let currentStatus = circuit.status;
    if (currentStatus === "OPEN" && circuit.openedAt) {
      const now = Date.now();
      if (now - circuit.openedAt >= this.resetWindowMs) {
        currentStatus = "HALF_OPEN";
      }
    }

    if (currentStatus === "CLOSED" && failures >= this.failureThreshold) {
      void this.store.set(
        k,
        { status: "OPEN", failures, openedAt: Date.now() },
        this.resetWindowMs,
      );
    } else if (currentStatus === "HALF_OPEN") {
      void this.store.set(
        k,
        { status: "OPEN", failures, openedAt: Date.now() },
        this.resetWindowMs,
      );
    } else {
      void this.store.set(k, { ...circuit, status: currentStatus, failures });
    }
  }

  getState(provider: string, tenantId?: string): CircuitState {
    const k = this.key(provider, tenantId);
    const circuit = this.store.getSync(k);
    if (!circuit) return "CLOSED";

    if (circuit.status === "OPEN" && circuit.openedAt) {
      const now = Date.now();
      if (now - circuit.openedAt >= this.resetWindowMs) {
        return "HALF_OPEN";
      }
    }
    return circuit.status;
  }

  /** Snapshot minimal pour l'observabilité (metrics endpoint). */
  getProviderSnapshot(
    provider: string,
    tenantId?: string,
  ): {
    state: CircuitState;
    failures: number;
    openedAt: number | null;
    resetWindowMs: number;
  } {
    const k = this.key(provider, tenantId);
    const circuit = this.store.getSync(k);
    const state = this.getState(provider, tenantId);
    return {
      state,
      failures: circuit?.failures ?? 0,
      openedAt: circuit?.openedAt ?? null,
      resetWindowMs: this.resetWindowMs,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory — choisit le store selon env
// ---------------------------------------------------------------------------

function createDefaultStore(): CircuitStore {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redis = getRedis();
      if (redis) {
        return new RedisCircuitStore(redis);
      }
    } catch (err) {
      logger.warn({ err }, "[circuit-breaker] Redis init failed, falling back to in-memory store");
    }
  }

  return new InMemoryCircuitStore();
}

export const defaultCircuitBreaker = new LLMCircuitBreaker();
