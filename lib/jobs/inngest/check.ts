/**
 * Garde-fou boot pour /api/inngest.
 *
 * Le SDK Inngest lit `INNGEST_SIGNING_KEY` automatiquement et vérifie la
 * signature des webhooks entrants. Sans cette clé en production, la route
 * accepte n'importe quel POST → exécution arbitraire de jobs.
 *
 * On log un warning bruyant au boot pour attirer l'attention sans casser
 * l'app (le SDK reste tolérant en dev où la clé peut être absente).
 */

let warned = false;

export function assertInngestSigningKey(): void {
  if (warned) return;
  warned = true;

  if (process.env.NODE_ENV !== "production") return;

  if (!process.env.INNGEST_SIGNING_KEY) {
    console.warn(
      "[inngest] INNGEST_SIGNING_KEY manquante en production — /api/inngest accepte n'importe quel POST. Configure la clé dans Vercel (Settings → Environment Variables).",
    );
  }
}
