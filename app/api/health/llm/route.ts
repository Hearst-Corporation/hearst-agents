/**
 * GET /api/health/llm — Endpoint de santé consolidé des providers LLM.
 *
 * Retourne pour chaque provider connu (anthropic, openai, gemini) :
 *   - status : "ok" | "degraded" | "down"
 *   - latency_ms : p95 sur les 100 derniers calls (rolling, via metrics)
 *   - breaker_state : état du circuit breaker (CLOSED / HALF_OPEN / OPEN)
 *   - cache_hit_ratio_24h : ratio Anthropic uniquement (null sinon)
 *   - headroom : { requests_remaining, tokens_remaining, reset_at } depuis
 *     le rate-limiter (basé sur les HTTP headers du dernier call provider).
 *
 * Approche "lecture seule" : on ne pingue PAS les providers en live (coût
 * tokens). Les valeurs viennent uniquement des aggregateurs in-process
 * (`defaultMetrics`, `defaultCircuitBreaker`, `defaultRateLimiter`).
 *
 * Auth : déléguée au proxy Next.js global (cookie session NextAuth ou API
 * key). La route n'est PAS dans la liste `PUBLIC_PATHS` du proxy → toute
 * requête sans session/clé est interceptée en amont avec un 401.
 *
 * Cache : `revalidate = 30` pour éviter de surcharger en cas de polling
 * dashboard. Le snapshot est cheap (memoire process), mais on garde un
 * cache court pour permettre des appels haute fréquence.
 */

import { NextResponse } from "next/server";
import { defaultCircuitBreaker, type CircuitState } from "@/lib/llm/circuit-breaker";
import { defaultMetrics } from "@/lib/llm/metrics";
import { defaultRateLimiter } from "@/lib/llm/rate-limiter";
import { getLangfuseClient } from "@/lib/observability/langfuse";

export const dynamic = "force-dynamic";
export const revalidate = 30;

// ---------------------------------------------------------------------------
// Constantes nommées (pas de magic numbers)
// ---------------------------------------------------------------------------

/** Providers surveillés. Ordre cohérent avec le routeur (router.ts). */
const TRACKED_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
type TrackedProvider = (typeof TRACKED_PROVIDERS)[number];

/** Taux d'erreur > seuil → status "degraded". */
const DEGRADED_ERROR_RATE = 0.1;

/** Latence p95 > seuil → status "degraded" même sans erreurs. */
const DEGRADED_LATENCY_MS = 5_000;

// ---------------------------------------------------------------------------
// Types de réponse
// ---------------------------------------------------------------------------

type HealthStatus = "ok" | "degraded" | "down";

interface ProviderHeadroom {
  requests_remaining: number | null;
  tokens_remaining: number | null;
  reset_at: string | null;
}

interface ProviderHealth {
  status: HealthStatus;
  latency_ms: number | null;
  breaker_state: CircuitState;
  cache_hit_ratio_24h: number | null;
  headroom: ProviderHeadroom;
}

interface LangfuseHealth {
  enabled: boolean;
  flushable: boolean;
}

interface HealthResponse {
  ok: boolean;
  checked_at: string;
  providers: Record<TrackedProvider, ProviderHealth>;
  langfuse: LangfuseHealth;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Détermine le status d'un provider à partir des signaux disponibles :
 *   - breaker OPEN → "down"
 *   - breaker HALF_OPEN OU error rate haut OU latence haute → "degraded"
 *   - sinon → "ok"
 */
function deriveStatus(
  breakerState: CircuitState,
  errorRate: number,
  latencyP95: number | null,
  hasSamples: boolean,
): HealthStatus {
  if (breakerState === "OPEN") return "down";
  if (breakerState === "HALF_OPEN") return "degraded";
  if (hasSamples && errorRate > DEGRADED_ERROR_RATE) return "degraded";
  if (latencyP95 !== null && latencyP95 > DEGRADED_LATENCY_MS) return "degraded";
  return "ok";
}

/**
 * Construit l'objet headroom depuis le snapshot rate-limiter d'un provider.
 * Retourne `null` partout si aucun header n'a été enregistré (premier call
 * pas encore fait, ou provider inactif).
 */
function buildHeadroom(provider: string): ProviderHeadroom {
  const limit = defaultRateLimiter.getProviderLimit(provider);
  if (!limit) {
    return { requests_remaining: null, tokens_remaining: null, reset_at: null };
  }

  // requestsRemaining peut être Infinity si jamais setté → on le ramène à null
  const requestsRemaining = Number.isFinite(limit.requestsRemaining)
    ? limit.requestsRemaining
    : null;
  const tokensRemaining = Number.isFinite(limit.tokensRemaining)
    ? limit.tokensRemaining
    : null;

  // On expose le reset le plus proche (requests OU tokens). 0 = non setté.
  const resets = [limit.requestsResetAt, limit.tokensResetAt].filter((t) => t > 0);
  const earliestReset = resets.length > 0 ? Math.min(...resets) : null;

  return {
    requests_remaining: requestsRemaining,
    tokens_remaining: tokensRemaining,
    reset_at: earliestReset !== null ? new Date(earliestReset).toISOString() : null,
  };
}

/**
 * Construit l'état de santé d'un provider en lisant les agrégateurs.
 * Tolérant : si aucun call n'a encore été enregistré pour ce provider,
 * on retourne un état "ok" minimal (breaker CLOSED, latence null).
 */
function buildProviderHealth(provider: TrackedProvider): ProviderHealth {
  const breakerSnap = defaultCircuitBreaker.getProviderSnapshot(provider);
  const metrics = defaultMetrics.getMetrics();
  const providerMetrics = metrics.providers.find((p) => p.provider === provider);

  const latencyP95 = providerMetrics?.latency.p95 ?? null;
  const errorRate = providerMetrics?.errorRate ?? 0;
  const hasSamples = (providerMetrics?.totalCalls ?? 0) + (providerMetrics?.totalErrors ?? 0) > 0;

  // cache_hit_ratio_24h : strictement Anthropic. Pour les autres providers,
  // null (sémantique correcte : non applicable).
  const cacheHitRatio =
    provider === "anthropic" ? providerMetrics?.tokens.cacheHitRate ?? null : null;

  return {
    status: deriveStatus(breakerSnap.state, errorRate, latencyP95, hasSamples),
    latency_ms: latencyP95,
    breaker_state: breakerSnap.state,
    cache_hit_ratio_24h: cacheHitRatio,
    headroom: buildHeadroom(provider),
  };
}

/**
 * État Langfuse : enabled si client instancié (clés présentes), flushable si
 * la méthode `flushAsync` existe sur le client (toujours vrai pour le SDK
 * langfuse mais on check pour la robustesse).
 */
function buildLangfuseHealth(): LangfuseHealth {
  try {
    const client = getLangfuseClient();
    if (!client) {
      return { enabled: false, flushable: false };
    }
    return {
      enabled: true,
      flushable: typeof client.flushAsync === "function",
    };
  } catch {
    // En prod sans clés, getLangfuseClient throw → on retourne disabled
    // plutôt que de propager (l'endpoint health doit être robuste).
    return { enabled: false, flushable: false };
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export function GET() {
  const providers = {} as Record<TrackedProvider, ProviderHealth>;
  let anyDown = false;

  for (const name of TRACKED_PROVIDERS) {
    const health = buildProviderHealth(name);
    providers[name] = health;
    if (health.status === "down") anyDown = true;
  }

  const body: HealthResponse = {
    ok: !anyDown,
    checked_at: new Date().toISOString(),
    providers,
    langfuse: buildLangfuseHealth(),
  };

  return NextResponse.json(body);
}
