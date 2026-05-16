/**
 * PII redaction helpers for safe logging.
 *
 * Garde les premiers caractères d'un identifiant (UUID, opaque ID) pour
 * permettre le debug sans leak. Centralise le pattern `.slice(0, 8)` dupliqué
 * dans 3+ call sites (scope.ts, get-user-id.ts, etc.).
 */

/** Default number of chars kept (suffisant pour distinguer en debug). */
const DEFAULT_KEEP = 8;

/**
 * Redacts a UUID / opaque ID for safe logging.
 *
 * - `null` / `undefined` / `""` → `"anonymous"` (distinguishable sentinel)
 * - `keep <= 0` → `"anonymous"` (safeguard : ne jamais retourner "" qui peut
 *   se confondre avec un id valide tronqué, ou réveler accidentellement l'id
 *   complet via une convention de slice mal interprétée)
 * - sinon : conserve les `keep` premiers caractères (default 8)
 *
 * @example
 * redactId("550e8400-e29b-41d4-a716-446655440000") // "550e8400"
 * redactId(null) // "anonymous"
 * redactId("abc", 2) // "ab"
 * redactId("abc", 0) // "anonymous"
 */
export function redactId(id: string | null | undefined, keep: number = DEFAULT_KEEP): string {
  if (!id) return "anonymous";
  if (keep <= 0) return "anonymous";
  return id.slice(0, keep);
}
