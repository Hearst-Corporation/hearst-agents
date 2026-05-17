/**
 * sanitizeApiError — extrait un message utilisateur safe d'une erreur API.
 *
 * T-J6 (it.4) : helper centralisé pour éviter de leak des paths serveur,
 * stack traces ou tokens dans les toasts et erreurs UI. Toute consommation
 * d'erreur API côté client doit passer par ce helper plutôt que d'exposer
 * `err.message` brut.
 *
 * Stratégie :
 *   - Whitelist : si le message matche un pattern réseau standard
 *     (Network, Failed to fetch, Connection, Timeout, Rate limit) on
 *     l'expose tel quel — il est neutre et utile.
 *   - AbortError : message dédié, l'utilisateur a sciemment annulé.
 *   - Sinon : message générique. Le détail technique reste dans la console
 *     / Sentry via le log à l'origine, jamais dans l'UI.
 */

const SAFE_PATTERNS = [
  /^Network/i,
  /^Failed to fetch$/i,
  /^Connection/i,
  /^Timeout/i,
  /^Rate limit/i,
];

export function sanitizeApiError(raw: unknown): string {
  if (raw instanceof Error) {
    if (SAFE_PATTERNS.some((p) => p.test(raw.message))) {
      return raw.message;
    }
    if (raw.name === "AbortError") return "Opération annulée";
  }
  if (typeof raw === "string" && SAFE_PATTERNS.some((p) => p.test(raw))) {
    return raw;
  }
  return "Erreur serveur — réessayez ou contactez le support si le problème persiste.";
}
