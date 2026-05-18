import type { ZodType } from "zod";

/**
 * Validation de formulaire côté client — réutilise les schémas Zod déjà
 * définis côté serveur (parité client/serveur, source unique de vérité).
 *
 * Pas de dépendance react-hook-form : un simple `useState` + `validateForm`
 * au submit suffit pour les formulaires du cockpit. La forme du résultat
 * miroite `parseJsonBody` (lib/platform/http/parse-body.ts) côté serveur :
 * discriminated union `{ ok }`.
 *
 *   const r = validateForm(WebhookSchema, values);
 *   if (!r.ok) { setErrors(r.errors); return; }
 *   void submit(r.data);
 */
export type FieldErrors = Record<string, string>;

export type ValidateResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/**
 * Valide `values` contre `schema`. En cas d'échec, retourne le **premier**
 * message d'erreur par champ (clé = premier segment du path Zod), prêt à
 * afficher inline sous l'input. Les erreurs racine (path vide) vont sous `_`.
 */
export function validateForm<T>(schema: ZodType<T>, values: unknown): ValidateResult<T> {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_";
    // Premier message rencontré par champ — on ne surcharge pas l'UI.
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
