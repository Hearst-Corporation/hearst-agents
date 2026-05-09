/** TODO stub — voir docs/AGENT-DRIVEN-DEV.md
 *
 * Wrapper fetch admin avec gestion d'erreurs silencieuse. Stub no-op typé.
 * À implémenter : auth headers, retry, logging d'erreur côté admin.
 */

/**
 * Fetch JSON admin-safe : retourne null sur erreur réseau ou non-200.
 * Stub : retourne toujours null (pas d'appel réseau effectué).
 */
export async function fetchAdminJson<T>(_url: string, _init?: RequestInit): Promise<T | null> {
  return null;
}
