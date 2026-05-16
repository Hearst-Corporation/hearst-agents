/**
 * Types partagés pour les stores de circuit breaker.
 * Extraits ici pour éviter la dépendance circulaire entre
 * lib/llm/circuit-breaker.ts et lib/llm/redis-circuit-store.ts.
 */

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
