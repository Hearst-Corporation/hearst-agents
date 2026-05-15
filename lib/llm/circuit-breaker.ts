export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface ProviderCircuitState {
  state: CircuitState;
  failureCount: number;
  openedAt: number | null;
}

export class LLMCircuitBreaker {
  private providers = new Map<string, ProviderCircuitState>();
  private readonly failureThreshold = 5;
  private readonly resetWindowMs = 60000;

  /** Génère une clé unique par provider + tenant optionnel. */
  private key(provider: string, tenantId?: string): string {
    return tenantId ? `${provider}:${tenantId}` : provider;
  }

  isOpen(provider: string, tenantId?: string): boolean {
    const k = this.key(provider, tenantId);
    let circuit = this.providers.get(k);
    if (!circuit) {
      circuit = { state: "CLOSED", failureCount: 0, openedAt: null };
      this.providers.set(k, circuit);
      return false;
    }

    if (circuit.state === "CLOSED") return false;

    if (circuit.state === "OPEN") {
      const now = Date.now();
      if (circuit.openedAt && now - circuit.openedAt >= this.resetWindowMs) {
        circuit.state = "HALF_OPEN";
        return false;
      }
      return true;
    }

    return false;
  }

  recordSuccess(provider: string, tenantId?: string): void {
    const k = this.key(provider, tenantId);
    let circuit = this.providers.get(k);
    if (!circuit) {
      circuit = { state: "CLOSED", failureCount: 0, openedAt: null };
      this.providers.set(k, circuit);
    }

    // Sync state with timeout window before processing
    if (circuit.state === "OPEN" && circuit.openedAt) {
      const now = Date.now();
      if (now - circuit.openedAt >= this.resetWindowMs) {
        circuit.state = "HALF_OPEN";
      }
    }

    if (circuit.state === "HALF_OPEN") {
      circuit.state = "CLOSED";
      circuit.failureCount = 0;
      circuit.openedAt = null;
    } else if (circuit.state === "CLOSED") {
      circuit.failureCount = 0;
    }
  }

  /**
   * Enregistre un échec provider. Le breaker ne trip que sur des erreurs
   * réellement transitoires côté serveur (5xx) ou network.
   *
   * Le `httpStatus` numérique (si fourni par l'appelant via `response.status`)
   * est la source de vérité pour décider 4xx/5xx. La regex sur `error.message`
   * reste un fallback pour les erreurs non-HTTP, mais sans précédence : un
   * httpStatus 4xx skip systématiquement, indépendamment du message.
   *
   * Closes audit P0-9 "circuit breaker poisoning" : un attaquant ne peut plus
   * faire trip le breaker en injectant "500" dans un message d'erreur app-layer.
   */
  recordFailure(provider: string, error: Error, tenantId?: string, httpStatus?: number): void {
    // Source de vérité : status numérique si fourni
    if (typeof httpStatus === "number") {
      // 4xx client error → ne trip pas le breaker (problème côté input, pas provider)
      if (httpStatus >= 400 && httpStatus < 500) return;
      // 5xx ou network (0/undefined) → continue vers la logique de trip
    } else if (/\b4\d{2}\b/.test(error.message)) {
      // Fallback regex (legacy) — moins fiable, n'écrase pas httpStatus si fourni
      return;
    }

    const k = this.key(provider, tenantId);
    let circuit = this.providers.get(k);
    if (!circuit) {
      circuit = { state: "CLOSED", failureCount: 0, openedAt: null };
      this.providers.set(k, circuit);
    }

    // Sync state with timeout window before processing
    if (circuit.state === "OPEN" && circuit.openedAt) {
      const now = Date.now();
      if (now - circuit.openedAt >= this.resetWindowMs) {
        circuit.state = "HALF_OPEN";
      }
    }

    circuit.failureCount++;

    if (circuit.state === "CLOSED" && circuit.failureCount >= this.failureThreshold) {
      circuit.state = "OPEN";
      circuit.openedAt = Date.now();
    } else if (circuit.state === "HALF_OPEN") {
      circuit.state = "OPEN";
      circuit.openedAt = Date.now();
    }
  }

  getState(provider: string, tenantId?: string): CircuitState {
    const k = this.key(provider, tenantId);
    const circuit = this.providers.get(k);
    if (!circuit) return "CLOSED";
    if (circuit.state === "OPEN" && circuit.openedAt) {
      const now = Date.now();
      if (now - circuit.openedAt >= this.resetWindowMs) {
        return "HALF_OPEN";
      }
    }
    return circuit.state;
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
    const circuit = this.providers.get(k);
    const state = this.getState(provider, tenantId);
    return {
      state,
      failures: circuit?.failureCount ?? 0,
      openedAt: circuit?.openedAt ?? null,
      resetWindowMs: this.resetWindowMs,
    };
  }
}

export const defaultCircuitBreaker = new LLMCircuitBreaker();
