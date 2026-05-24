/**
 * retryWithBackoff — helper d'isolation pour les retries LLM transitoires.
 *
 * Extrait de router.ts (qui l'appelait 4× en hot path) pour améliorer la
 * testabilité et éviter la duplication.
 *
 * Stratégie :
 * - Retry sur erreurs transitoires uniquement (429, 500, 502, 503, 504).
 * - Backoff exponentiel avec jitter ±20%.
 * - Cap configurable via provider (utilise SOFT_THROTTLE_CAP_MS par défaut,
 *   HARD_THROTTLE_CAP_MS si provider retry-after est explicite).
 *
 * @internal — ne pas importer depuis les couches UI ou API.
 */

/** Cap dur pour les delays issus d'un Retry-After explicite (429). */
export const HARD_THROTTLE_CAP_MS = 60_000;

/** Cap doux pour le backoff exponentiel générique. */
export const SOFT_THROTTLE_CAP_MS = 30_000;

/**
 * Détermine si une erreur est transitoire (5xx ou 429).
 * Seule la regex sur error.message est utilisée (les SDK LLM y incluent le code HTTP).
 */
export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /\b(429|500|502|503|504)\b/.test(err.message);
}

/**
 * Extrait le nombre de ms à attendre depuis un header Retry-After ou un
 * message d'erreur LLM (ex : "retry after 12s").
 * Retourne 0 si non trouvé.
 */
export function extractRetryAfterMs(err: unknown): number {
  if (!(err instanceof Error)) return 0;
  const msg = err.message;

  // "retry-after: 500ms" (ms en premier pour éviter le faux-positif du match secondes)
  const msMatch = msg.match(/retry[-\s]after[:\s]+(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) {
    return Math.min(Math.round(parseFloat(msMatch[1])), HARD_THROTTLE_CAP_MS);
  }

  // "retry-after: 30" ou "retry after 30s" (secondes, ne doit pas matcher "ms")
  const secMatch = msg.match(/retry[-\s]after[:\s]+(\d+(?:\.\d+)?)\s*(?:s\b)?(?!\s*ms)/i);
  if (secMatch) {
    return Math.min(Math.round(parseFloat(secMatch[1]) * 1000), HARD_THROTTLE_CAP_MS);
  }

  return 0;
}

/**
 * Exécute `fn` avec retry + backoff exponentiel sur erreurs transitoires.
 *
 * @param fn          - La fonction async à exécuter.
 * @param maxRetries  - Nombre maximum de tentatives supplémentaires (défaut : 3).
 * @param provider    - Nom du provider LLM (optionnel, pour les logs).
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

      // Essaie d'extraire un Retry-After explicite depuis le message
      const retryAfterMs = extractRetryAfterMs(e);

      let delayMs: number;
      if (retryAfterMs > 0) {
        delayMs = retryAfterMs;
      } else {
        const base = 2 ** (attempt - 1) * 1000;
        const jitter = base * 0.2 * (Math.random() * 2 - 1);
        delayMs = Math.min(base + jitter, SOFT_THROTTLE_CAP_MS);
      }

      if (provider) {
        console.warn(
          `[retryWithBackoff] ${provider} attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delayMs)}ms`,
        );
      }

      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
