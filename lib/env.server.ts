/**
 * Environment validation — Server-side only
 *
 * This module validates critical environment variables at boot time.
 * Import it at the top of server entry points to trigger validation early.
 *
 * Rules:
 * - HEARST_DEV_AUTH_BYPASS=1 is forbidden in production
 * - NODE_ENV=production triggers strict validation mode
 */

const isProd = process.env.NODE_ENV === "production";

// Validate security-critical environment variables
function validateEnv(): void {
  // Critical: prevent dev bypass in production
  if (isProd && process.env.HEARST_DEV_AUTH_BYPASS === "1") {
    throw new Error(
      "[ENV ERROR] HEARST_DEV_AUTH_BYPASS=1 is forbidden in production. " +
        "This would expose all API routes without authentication."
    );
  }

  // Critical: allowlist domaine obligatoire en prod pour empêcher l'enrôlement
  // libre de n'importe quel compte Google/Azure. Sans cette var, le callback
  // signIn() refuse tous les logins OAuth en production (fail-closed).
  // Format CSV : "hearstcorporation.io,partner.com"
  if (isProd && !process.env.HEARST_ALLOWED_EMAIL_DOMAINS) {
    throw new Error(
      "[ENV ERROR] HEARST_ALLOWED_EMAIL_DOMAINS is required in production. " +
        "Without it, any Google/Azure user can self-enroll in the production tenant. " +
        "Set it as CSV (e.g. 'hearstcorporation.io,partner.com')."
    );
  }

  // Safety net 7j — HEARST_TENANT_ID/HEARST_WORKSPACE_ID encore utilisés
  // pour les pages publiques (hearst-card screenshotter) sans session.
  // Ces vars seront retirées en PR 4 (après 7 jours sans incident Sentry).
  if (isProd && !process.env.HEARST_TENANT_ID) {
    console.warn(
      "[ENV] HEARST_TENANT_ID not set — utilisé uniquement pour hearst-card screenshotter. " +
        "Ce check sera supprimé en PR 4."
    );
  }
  if (isProd && !process.env.HEARST_WORKSPACE_ID) {
    console.warn(
      "[ENV] HEARST_WORKSPACE_ID not set — scope.ts lit désormais session.workspaceId (DB). " +
        "Ce check sera supprimé en PR 4."
    );
  }

  // Production mode confirmation
  if (isProd) {
    console.log("[ENV] Production mode validated — auth bypass disabled, tenant scope confirmed");
  }

  // Optional: warn if HEARST_API_KEY is not set in production
  // (session-only auth is allowed per decision, but we log for visibility)
  if (isProd && !process.env.HEARST_API_KEY) {
    console.log(
      "[ENV] Note: HEARST_API_KEY not set — relying on session auth only"
    );
  }

  // Jobs async : warn si ni Redis ni Inngest ne sont configurés en prod.
  // Sans l'un ou l'autre, enqueueJob() throw sur tous les job types sauf daily-brief.
  // Solution recommandée sur Vercel : set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
  if (isProd && !process.env.REDIS_URL && !process.env.INNGEST_EVENT_KEY) {
    console.warn(
      "[ENV] Warning: REDIS_URL and INNGEST_EVENT_KEY both absent — " +
      "async jobs (audio, image, video, code-exec, doc-parse) will fail. " +
      "Set INNGEST_EVENT_KEY for Vercel or REDIS_URL for self-hosted."
    );
  }
}

// Execute validation immediately on module load
validateEnv();

// Marker export — TS exigerait "isolatedModules: true" sur un fichier sans
// exports, et l'import dynamique `await import("@/lib/env.server")` réclame
// que le fichier soit reconnu comme module. Un boolean trivial fait l'affaire.
export const ENV_VALIDATED = true;
