import { RateLimitExceededError } from "./errors";

export interface RateLimiterOptions {
  rpm: number;
  tph: number;
}

interface TokenEntry {
  ts: number;
  tokens: number;
}

interface UserState {
  callTimestamps: number[];
  tokenEntries: TokenEntry[];
  lastActivity: number;
  createdAt: number; // TTL max tracking
}

/**
 * État rate-limit par provider, dérivé des HTTP headers `x-ratelimit-*` /
 * `anthropic-ratelimit-*` / `retry-after`. Permet du backoff PROACTIF avant
 * d'envoyer un call qui se ferait 429.
 */
export interface ProviderRateLimit {
  requestsLimit: number;
  requestsRemaining: number;
  requestsResetAt: number; // epoch ms
  tokensLimit: number;
  tokensRemaining: number;
  tokensResetAt: number; // epoch ms
  retryAfterMs?: number;
  retryAfterSetAt?: number; // epoch ms — pour calculer l'expiration de retry-after
  updatedAt: number;
}

export interface ThrottleDecision {
  throttle: boolean;
  reasonMs?: number;
  /** "hard" = contrainte serveur dure (retry-after ou budget épuisé) — respecter pleinement.
   *  "soft" = délai proactif préventif — peut être capé.
   *  Absent si throttle === false. */
  kind?: "hard" | "soft";
}

const RPM = Number(process.env.LLM_RATE_LIMIT_RPM ?? "60");
const TPH = Number(process.env.LLM_RATE_LIMIT_TPH ?? "1000000");
const MAX_USERS = Number(process.env.LLM_RATE_LIMIT_MAX_USERS ?? "10000");
const MAX_USER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours max TTL

export class LLMRateLimiter {
  private userStates = new Map<string, UserState>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60000; // Cleanup every 60s

  // --- État rate-limit par provider (HTTP headers, backoff proactif) -------
  private providerLimits = new Map<string, ProviderRateLimit>();
  private lastThrottleLogAt = new Map<string, number>(); // debounce log 1/s/provider
  private readonly throttleLogDebounceMs = 1000;
  private readonly proactiveRequestsThreshold = 5;
  private readonly proactiveTokensThreshold = 1000;
  private readonly proactiveDelayCapMs = 1000;

  private cleanupIfNeeded(): void {
    const now = Date.now();

    // Periodic cleanup every 60s
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }
    this.lastCleanup = now;

    // Remove entries older than 24h or inactive for 2h
    const maxAge = now - MAX_USER_TTL_MS;
    const inactiveThreshold = now - 7200000; // 2h

    for (const [userId, state] of this.userStates.entries()) {
      const isExpired = state.createdAt < maxAge;
      const isInactive =
        state.lastActivity < inactiveThreshold &&
        state.callTimestamps.length === 0 &&
        state.tokenEntries.length === 0;

      if (isExpired || isInactive) {
        this.userStates.delete(userId);
      }
    }
  }

  private evictLRU(): void {
    // Find oldest entry by lastActivity
    let oldestUserId: string | null = null;
    let oldestActivity = Infinity;

    for (const [userId, state] of this.userStates.entries()) {
      if (state.lastActivity < oldestActivity) {
        oldestActivity = state.lastActivity;
        oldestUserId = userId;
      }
    }

    if (oldestUserId) {
      this.userStates.delete(oldestUserId);
      console.warn(`[RateLimiter] LRU evicted user ${oldestUserId} due to MAX_USERS limit`);
    }
  }

  checkLimit(userId: string): void {
    this.cleanupIfNeeded();

    const now = Date.now();
    let state = this.userStates.get(userId);

    if (!state) {
      // Check if we need to evict before adding new user
      if (this.userStates.size >= MAX_USERS) {
        this.evictLRU();
      }

      state = {
        callTimestamps: [],
        tokenEntries: [],
        lastActivity: now,
        createdAt: now,
      };
      this.userStates.set(userId, state);
    }

    // Check absolute TTL
    if (now - state.createdAt > MAX_USER_TTL_MS) {
      // Reset state after 24h
      state.callTimestamps = [];
      state.tokenEntries = [];
      state.createdAt = now;
    }

    state.lastActivity = now;

    const sixtySecondsAgo = now - 60000;
    state.callTimestamps = state.callTimestamps.filter((ts) => ts > sixtySecondsAgo);

    if (state.callTimestamps.length >= RPM) {
      throw new RateLimitExceededError(userId, "rpm");
    }

    const oneHourAgo = now - 3600000;
    state.tokenEntries = state.tokenEntries.filter((entry) => entry.ts > oneHourAgo);

    const totalTokens = state.tokenEntries.reduce((sum, entry) => sum + entry.tokens, 0);
    if (totalTokens >= TPH) {
      throw new RateLimitExceededError(userId, "tph");
    }
  }

  recordCall(userId: string, tokens: number = 0): void {
    const now = Date.now();
    let state = this.userStates.get(userId);

    if (!state) {
      // Should not happen if checkLimit was called first, but handle gracefully
      if (this.userStates.size >= MAX_USERS) {
        this.evictLRU();
      }

      state = {
        callTimestamps: [],
        tokenEntries: [],
        lastActivity: now,
        createdAt: now,
      };
      this.userStates.set(userId, state);
    }

    state.lastActivity = now;
    state.callTimestamps.push(now);
    if (tokens > 0) {
      state.tokenEntries.push({ ts: now, tokens });
    }

    // Cleanup this specific entry if inactive (not global cleanup)
    const twoHoursAgo = now - 7200000;
    if (
      state.lastActivity < twoHoursAgo &&
      state.callTimestamps.length === 0 &&
      state.tokenEntries.length === 0
    ) {
      this.userStates.delete(userId);
    }
  }

  getStats(): { userCount: number; maxUsers: number } {
    return {
      userCount: this.userStates.size,
      maxUsers: MAX_USERS,
    };
  }

  // ---------------------------------------------------------------------------
  // Backoff proactif via HTTP rate-limit headers
  // ---------------------------------------------------------------------------

  /**
   * Parse une durée style OpenAI ("1s500ms", "12.4s", "500ms", "0", "120s")
   * et retourne des ms. Retourne 0 si non parseable / vide.
   */
  private parseDuration(raw: string | undefined | null): number {
    if (!raw) return 0;
    const s = String(raw).trim();
    if (!s || s === "0") return 0;

    // Pure numeric (assume seconds, handles fractions)
    if (/^\d+(\.\d+)?$/.test(s)) {
      return Math.round(parseFloat(s) * 1000);
    }

    // Composite "XsYms" / "Xs" / "Yms" / "Xm" / "Xh"
    let total = 0;
    let matched = false;
    const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      matched = true;
      const value = parseFloat(m[1]);
      const unit = m[2];
      if (unit === "ms") total += value;
      else if (unit === "s") total += value * 1000;
      else if (unit === "m") total += value * 60_000;
      else if (unit === "h") total += value * 3_600_000;
    }
    return matched ? Math.round(total) : 0;
  }

  /**
   * Parse un timestamp ISO 8601 (Anthropic) en epoch ms. Retourne 0 si invalide.
   */
  private parseResetTimestamp(raw: string | undefined | null): number {
    if (!raw) return 0;
    const t = Date.parse(String(raw));
    return Number.isFinite(t) ? t : 0;
  }

  /**
   * Convertit un Headers (Web API) ou Record<string, string> en objet plain
   * lowercased. Permet de gérer indifféremment fetch Response.headers et
   * objets plain venant de SDK.
   */
  private normalizeHeaders(headers: Record<string, string> | Headers): Record<string, string> {
    const out: Record<string, string> = {};
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach((value, key) => {
        out[key.toLowerCase()] = value;
      });
      return out;
    }
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) {
        out[key.toLowerCase()] = String(value);
      }
    }
    return out;
  }

  /**
   * Enregistre les rate-limit headers d'un call provider.
   *
   * Supporte :
   * - Anthropic : `anthropic-ratelimit-{requests,tokens}-{limit,remaining,reset}`
   *   où reset est un timestamp ISO 8601.
   * - OpenAI : `x-ratelimit-{limit,remaining,reset}-{requests,tokens}` où
   *   reset est une durée style "1s500ms" ou "12.4s".
   * - `retry-after` (commun aux deux, en secondes).
   *
   * Si headers non reconnus → ignore silencieusement.
   * Tolérant aux erreurs de parsing : ne throw jamais.
   */
  recordHeaders(provider: string, headers: Record<string, string> | Headers): void {
    if (!provider || !headers) return;

    let h: Record<string, string>;
    try {
      h = this.normalizeHeaders(headers);
    } catch {
      return;
    }

    const now = Date.now();
    const prev = this.providerLimits.get(provider);
    const next: ProviderRateLimit = prev
      ? { ...prev, updatedAt: now }
      : {
          requestsLimit: 0,
          requestsRemaining: Number.POSITIVE_INFINITY,
          requestsResetAt: 0,
          tokensLimit: 0,
          tokensRemaining: Number.POSITIVE_INFINITY,
          tokensResetAt: 0,
          updatedAt: now,
        };

    let touched = false;

    // ---- Anthropic ----------------------------------------------------------
    const aReqLimit = h["anthropic-ratelimit-requests-limit"];
    const aReqRemaining = h["anthropic-ratelimit-requests-remaining"];
    const aReqReset = h["anthropic-ratelimit-requests-reset"];
    if (aReqLimit || aReqRemaining || aReqReset) {
      if (aReqLimit) next.requestsLimit = Number(aReqLimit) || next.requestsLimit;
      if (aReqRemaining != null) {
        const v = Number(aReqRemaining);
        if (Number.isFinite(v)) next.requestsRemaining = v;
      }
      if (aReqReset) {
        const t = this.parseResetTimestamp(aReqReset);
        if (t > 0) next.requestsResetAt = t;
      }
      touched = true;
    }

    const aTokLimit = h["anthropic-ratelimit-tokens-limit"];
    const aTokRemaining = h["anthropic-ratelimit-tokens-remaining"];
    const aTokReset = h["anthropic-ratelimit-tokens-reset"];
    if (aTokLimit || aTokRemaining || aTokReset) {
      if (aTokLimit) next.tokensLimit = Number(aTokLimit) || next.tokensLimit;
      if (aTokRemaining != null) {
        const v = Number(aTokRemaining);
        if (Number.isFinite(v)) next.tokensRemaining = v;
      }
      if (aTokReset) {
        const t = this.parseResetTimestamp(aTokReset);
        if (t > 0) next.tokensResetAt = t;
      }
      touched = true;
    }

    // ---- OpenAI -------------------------------------------------------------
    const oReqLimit = h["x-ratelimit-limit-requests"];
    const oReqRemaining = h["x-ratelimit-remaining-requests"];
    const oReqReset = h["x-ratelimit-reset-requests"];
    if (oReqLimit || oReqRemaining || oReqReset) {
      if (oReqLimit) next.requestsLimit = Number(oReqLimit) || next.requestsLimit;
      if (oReqRemaining != null) {
        const v = Number(oReqRemaining);
        if (Number.isFinite(v)) next.requestsRemaining = v;
      }
      if (oReqReset) {
        const ms = this.parseDuration(oReqReset);
        if (ms > 0) next.requestsResetAt = now + ms;
      }
      touched = true;
    }

    const oTokLimit = h["x-ratelimit-limit-tokens"];
    const oTokRemaining = h["x-ratelimit-remaining-tokens"];
    const oTokReset = h["x-ratelimit-reset-tokens"];
    if (oTokLimit || oTokRemaining || oTokReset) {
      if (oTokLimit) next.tokensLimit = Number(oTokLimit) || next.tokensLimit;
      if (oTokRemaining != null) {
        const v = Number(oTokRemaining);
        if (Number.isFinite(v)) next.tokensRemaining = v;
      }
      if (oTokReset) {
        const ms = this.parseDuration(oTokReset);
        if (ms > 0) next.tokensResetAt = now + ms;
      }
      touched = true;
    }

    // ---- retry-after (commun, en secondes ou date HTTP) --------------------
    const retryAfter = h["retry-after"];
    if (retryAfter) {
      let ms = 0;
      // Format numérique = secondes
      if (/^\d+(\.\d+)?$/.test(retryAfter.trim())) {
        ms = Math.round(parseFloat(retryAfter) * 1000);
      } else {
        // Format HTTP-date
        const t = Date.parse(retryAfter);
        if (Number.isFinite(t)) ms = Math.max(0, t - now);
      }
      if (ms > 0) {
        next.retryAfterMs = ms;
        next.retryAfterSetAt = now;
        touched = true;
      }
    }

    if (touched) {
      this.providerLimits.set(provider, next);
    }
  }

  /**
   * Détermine si un call sortant devrait être différé pour éviter un 429.
   *
   * Logique :
   * 1. Pas d'état → pas de throttle.
   * 2. retry-after actif → throttle jusqu'à expiration.
   * 3. requestsRemaining === 0 ET reset futur → throttle jusqu'à reset.
   * 4. requestsRemaining < 5 (low budget) → throttle proactif court.
   * 5. tokensRemaining < 1000 → throttle proactif similaire.
   * 6. Sinon → pas de throttle.
   */
  shouldThrottle(provider: string): ThrottleDecision {
    const state = this.providerLimits.get(provider);
    if (!state) return { throttle: false };

    const now = Date.now();

    // 2. retry-after explicite (priorité absolue, set sur 429) → HARD
    if (state.retryAfterMs && state.retryAfterSetAt) {
      const elapsed = now - state.retryAfterSetAt;
      const remaining = state.retryAfterMs - elapsed;
      if (remaining > 0) {
        this.logThrottle(provider, remaining, state);
        return { throttle: true, reasonMs: remaining, kind: "hard" };
      }
    }

    // 3. Budget requests épuisé → HARD
    if (state.requestsRemaining === 0 && state.requestsResetAt > now) {
      const remaining = state.requestsResetAt - now;
      this.logThrottle(provider, remaining, state);
      return { throttle: true, reasonMs: remaining, kind: "hard" };
    }

    // 4. Budget requests bas → throttle proactif court → SOFT
    if (
      Number.isFinite(state.requestsRemaining) &&
      state.requestsRemaining > 0 &&
      state.requestsRemaining < this.proactiveRequestsThreshold &&
      state.requestsResetAt > now
    ) {
      const window = state.requestsResetAt - now;
      const delay = Math.min(
        Math.ceil(window / Math.max(state.requestsRemaining, 1)),
        this.proactiveDelayCapMs,
      );
      if (delay > 0) {
        this.logThrottle(provider, delay, state);
        return { throttle: true, reasonMs: delay, kind: "soft" };
      }
    }

    // 5. Budget tokens bas → throttle proactif similaire → SOFT
    if (
      Number.isFinite(state.tokensRemaining) &&
      state.tokensRemaining > 0 &&
      state.tokensRemaining < this.proactiveTokensThreshold &&
      state.tokensResetAt > now
    ) {
      const window = state.tokensResetAt - now;
      const delay = Math.min(Math.ceil(window / 10), this.proactiveDelayCapMs);
      if (delay > 0) {
        this.logThrottle(provider, delay, state);
        return { throttle: true, reasonMs: delay, kind: "soft" };
      }
    }

    return { throttle: false };
  }

  /**
   * Helper : retourne le délai à attendre (ms) avant le prochain call. 0 si OK.
   * Retro-compat — signature inchangée.
   */
  getNextDelay(provider: string): number {
    const decision = this.shouldThrottle(provider);
    return decision.throttle ? (decision.reasonMs ?? 0) : 0;
  }

  /**
   * Helper étendu : retourne le délai ET le kind (hard / soft).
   * - hard → contrainte serveur dure, respecter le délai complet.
   * - soft → délai proactif, peut être capé côté consommateur.
   */
  getNextDelayDetailed(provider: string): { delay: number; kind: "hard" | "soft" } {
    const decision = this.shouldThrottle(provider);
    if (!decision.throttle) return { delay: 0, kind: "soft" };
    return { delay: decision.reasonMs ?? 0, kind: decision.kind ?? "soft" };
  }

  /**
   * Snapshot lecture seule de l'état rate-limit d'un provider (debug / metrics).
   */
  getProviderLimit(provider: string): ProviderRateLimit | undefined {
    const state = this.providerLimits.get(provider);
    return state ? { ...state } : undefined;
  }

  private logThrottle(provider: string, reasonMs: number, state: ProviderRateLimit): void {
    const now = Date.now();
    const lastAt = this.lastThrottleLogAt.get(provider) ?? 0;
    if (now - lastAt < this.throttleLogDebounceMs) return;
    this.lastThrottleLogAt.set(provider, now);

    const remaining = Number.isFinite(state.requestsRemaining) ? state.requestsRemaining : "∞";
    const limit = state.requestsLimit || "?";
    console.warn(
      `[ratelimit] ${provider} throttle ${reasonMs}ms (remaining=${remaining}/${limit})`,
    );
  }
}

export const defaultRateLimiter = new LLMRateLimiter();
