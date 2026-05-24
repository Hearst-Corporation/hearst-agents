/**
 * retryWithBackoff — logique de retry avec backoff exponentiel + jitter.
 *
 * Extrait de router.ts pour être testable isolément.
 * Supporte un 3e arg optionnel `provider` utilisé pour logguer un warn structuré
 * quand le Retry-After du provider dépasse HARD_THROTTLE_CAP_MS.
 */

import { logger } from "@/lib/observability/logger";

/** Plafond dur sur le délai de retry : 60 s. Au-delà, on cap et on log un warn. */
export const HARD_THROTTLE_CAP_MS = 60_000;

/**
 * Extrait un délai Retry-After (ms) depuis un message d'erreur.
 * Supporte :
 *  - "retry-after: 30" (HTTP header textuel dans l'erreur)
 *  - "retry after 45 seconds"
 *  - "retryAfterMs: 120000"
 * Retourne 0 si rien n'est trouvé.
 */
export function extractRetryAfterMs(err: unknown): number {
  if (!(err instanceof Error)) return 0;
  const msg = err.message;

  // retryAfterMs: <number> (millisecondes directes)
  const msMatch = msg.match(/retryAfterMs[:\s]+(\d+)/i);
  if (msMatch) return parseInt(msMatch[1], 10);

  // retry-after: <seconds> ou retry after <seconds>
  const secMatch = msg.match(/retry[- ]after[:\s]+(\d+)/i);
  if (secMatch) return parseInt(secMatch[1], 10) * 1000;

  // "after X seconds"
  const afterSecMatch = msg.match(/after\s+(\d+)\s+second/i);
  if (afterSecMatch) return parseInt(afterSecMatch[1], 10) * 1000;

  return 0;
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /\b(429|500|502|503|504)\b/.test(err.message);
}

/**
 * Retente `fn` jusqu'à `maxRetries` fois sur erreur transiente (429, 5xx).
 * Le délai est exponentiel avec jitter ±20 %.
 * Si le provider fournit un Retry-After, on l'utilise à la place (cappé à HARD_THROTTLE_CAP_MS).
 *
 * @param fn          Fonction async à retenter.
 * @param maxRetries  Nombre max de tentatives supplémentaires (défaut 3).
 * @param provider    Nom du provider LLM — utilisé dans le warn structuré si Retry-After dépasse le cap.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  provider?: string,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (!isTransientError(e) || attempt > maxRetries) throw e;

      const retryAfterMs = extractRetryAfterMs(e);
      let delayMs: number;

      if (retryAfterMs > 0) {
        if (retryAfterMs > HARD_THROTTLE_CAP_MS) {
          logger.warn(
            {
              provider,
              requestedDelayMs: retryAfterMs,
              capMs: HARD_THROTTLE_CAP_MS,
            },
            "[router] hard retry-after exceeded HARD_THROTTLE_CAP — capping defensively, prod alert recommandée",
          );
        }
        delayMs = Math.min(retryAfterMs, HARD_THROTTLE_CAP_MS);
      } else {
        const base = 2 ** (attempt - 1) * 1000;
        const jitter = base * 0.2 * (Math.random() * 2 - 1);
        delayMs = base + jitter;
      }

      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
