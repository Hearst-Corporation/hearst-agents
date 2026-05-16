import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";
import { getProvider } from "@/lib/llm/router";
import type { ChatRequest, ChatResponse } from "@/lib/llm/types";
import { logger } from "@/lib/observability/logger";

/**
 * Returns true if the per-tenant breaker is currently OPEN for `provider`.
 *
 * Réexposé par safe-chat pour permettre aux call-sites qui n'utilisent pas
 * `chatWithCircuitBreaker` directement (ex. wrapping streamText) de garder
 * la même garde fail-fast sans importer defaultCircuitBreaker.
 */
export function isCircuitOpenFor(provider: string, tenantId?: string): boolean {
  return defaultCircuitBreaker.isOpen(provider, tenantId);
}

export interface SafeChatOptions<T> {
  /** Provider name (default "kimi"). */
  provider?: string;
  /** Tenant ID for per-tenant circuit breaker isolation. */
  tenantId?: string;
  /** Chat request payload passed to the LLM provider. */
  chatRequest: ChatRequest;
  /** Logger context label (e.g. "memory/summary"). */
  context: string;
  /** Returned when circuit is open or LLM call fails. */
  fallback: T;
  /** Maps LLM response to caller's typed T. */
  parse: (res: ChatResponse) => T;
}

/**
 * Wrap an LLM call with circuit breaker + structured logging.
 *
 * Returns `fallback` if the per-tenant breaker is OPEN or the call throws.
 * Records success/failure on every call. Never throws.
 *
 * Factorize circuit-breaker + LLM call pattern from ~20 call sites.
 *
 * Note: records circuit breaker outcomes per-call. If a request triggers
 * multiple LLM calls (e.g. parallel A/B testing), each contributes
 * independently to the breaker's failure threshold.
 *
 * Note: `recordSuccess` is invoked **after** `opts.parse` resolves so a
 * throwing `parse` is counted as a failure exactly once — no double-record
 * with `recordFailure` in the catch branch.
 */
export async function chatWithCircuitBreaker<T>(opts: SafeChatOptions<T>): Promise<T> {
  const providerName = opts.provider ?? "kimi";
  if (defaultCircuitBreaker.isOpen(providerName, opts.tenantId)) {
    logger.warn(
      { provider: providerName, ctx: opts.context },
      "[safe-chat] circuit breaker open — fallback",
    );
    return opts.fallback;
  }
  try {
    const provider = getProvider(providerName);
    const res = await provider.chat(opts.chatRequest);
    // Parse FIRST. recordSuccess only if parse succeeds — otherwise the
    // catch branch records failure (single outcome per call).
    const parsed = opts.parse(res);
    defaultCircuitBreaker.recordSuccess(providerName, opts.tenantId);
    return parsed;
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    defaultCircuitBreaker.recordFailure(providerName, errObj, opts.tenantId);
    logger.warn({ err: errObj, ctx: opts.context }, "[safe-chat] LLM call failed — fallback");
    return opts.fallback;
  }
}
