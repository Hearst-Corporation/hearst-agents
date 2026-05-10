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

  // Critical: tenant isolation requires explicit scope in production.
  // Without these vars every user shares the "dev-tenant" fallback — full
  // cross-user data exposure on shared infrastructure.
  if (isProd && !process.env.HEARST_TENANT_ID) {
    throw new Error(
      "[ENV ERROR] HEARST_TENANT_ID is required in production. " +
        "Without it all users share the dev-tenant scope."
    );
  }
  if (isProd && !process.env.HEARST_WORKSPACE_ID) {
    throw new Error(
      "[ENV ERROR] HEARST_WORKSPACE_ID is required in production. " +
        "Without it all users share the dev-workspace scope."
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
