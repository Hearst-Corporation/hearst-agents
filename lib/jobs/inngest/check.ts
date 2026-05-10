/**
 * Garde-fou boot pour /api/inngest.
 *
 * Le SDK Inngest lit `INNGEST_SIGNING_KEY` automatiquement et vérifie la
 * signature des webhooks entrants. Sans cette clé en production, la route
 * accepte n'importe quel POST → exécution arbitraire de jobs (F-007 Battle Plan).
 *
 * En production : HARD FAIL au boot si la clé manque.
 * En dev/test : warn seulement (le SDK reste tolérant).
 */

let checked = false;

function isProductionLike(): boolean {
  // VERCEL_ENV=production OR HEARST_ENV=production OR NODE_ENV=production
  // (cf F-053 : éviter que HEARST_ENV masque NODE_ENV silencieusement)
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.HEARST_ENV === "production" || process.env.HEARST_ENV === "prod") return true;
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

export function assertInngestSigningKey(): void {
  if (checked) return;
  checked = true;

  if (!isProductionLike()) {
    if (!process.env.INNGEST_SIGNING_KEY) {
      console.warn("[inngest] INNGEST_SIGNING_KEY missing — dev only");
    }
    return;
  }

  if (!process.env.INNGEST_SIGNING_KEY) {
    throw new Error(
      "[FATAL] INNGEST_SIGNING_KEY missing in production. /api/inngest would accept arbitrary POSTs (exec workers, vol crédits, fuite données). Configure it in Vercel (Settings → Environment Variables) before booting.",
    );
  }
}
