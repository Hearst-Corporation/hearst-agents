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
        "This would expose all API routes without authentication.",
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
        "Set it as CSV (e.g. 'hearstcorporation.io,partner.com').",
    );
  }

  // Critical: Stripe webhook secret obligatoire en prod pour valider les signatures.
  // Sans lui, constructEvent() ne peut pas vérifier l'authenticité des webhooks Stripe.
  if (isProd && !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "[ENV ERROR] STRIPE_WEBHOOK_SECRET is required in production. " +
        "Without it, Stripe webhook signatures cannot be verified, allowing fake payment events. " +
        "Get the secret from the Stripe dashboard > Webhooks > your endpoint.",
    );
  }

  // Critical: Stripe secret key obligatoire en prod pour créer les sessions Checkout
  // et interroger l'API Stripe (top-up crédits). Sans elle, lib/credits/stripe.ts
  // utilise process.env.STRIPE_SECRET_KEY! (non-null assertion) → TypeError en runtime.
  if (isProd && !process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "[ENV ERROR] STRIPE_SECRET_KEY is required in production. " +
        "Without it, Stripe Checkout sessions cannot be created and top-up will fail. " +
        "Get the key from Stripe dashboard > Developers > API keys.",
    );
  }

  // Critical: Kimi API key obligatoire en prod pour les fonctions d'orchestration IA
  // (run-research-report, delegate/api.ts) qui utilisent process.env.KIMI_API_KEY!
  // (non-null assertion). Sans cette var, un throw TypeError non catchable en runtime.
  if (isProd && !process.env.KIMI_API_KEY) {
    throw new Error(
      "[ENV ERROR] KIMI_API_KEY is required in production. " +
        "Without it, AI orchestration (research reports, delegate API) will crash at runtime. " +
        "Get the key from Hypercli dashboard and set KIMI_API_KEY in your environment.",
    );
  }

  // Safety net 7j — HEARST_TENANT_ID/HEARST_WORKSPACE_ID encore utilisés
  // pour les pages publiques (hearst-card screenshotter) sans session.
  // Ces vars seront retirées en PR 4 (après 7 jours sans incident Sentry).
  if (isProd && !process.env.HEARST_TENANT_ID) {
    // boot-time warn — pino non encore initialisé, intentionnellement console.*
    console.warn(
      "[ENV] HEARST_TENANT_ID not set — utilisé uniquement pour hearst-card screenshotter. " +
        "Ce check sera supprimé en PR 4.",
    );
  }
  if (isProd && !process.env.HEARST_WORKSPACE_ID) {
    // boot-time warn — pino non encore initialisé, intentionnellement console.*
    console.warn(
      "[ENV] HEARST_WORKSPACE_ID not set — scope.ts lit désormais session.workspaceId (DB). " +
        "Ce check sera supprimé en PR 4.",
    );
  }

  // Jobs async : warn si ni Redis ni Inngest ne sont configurés en prod.
  // Sans l'un ou l'autre, enqueueJob() throw sur tous les job types sauf daily-brief.
  // Solution recommandée sur Vercel : set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
  if (isProd && !process.env.REDIS_URL && !process.env.INNGEST_EVENT_KEY) {
    // boot-time warn — pino non encore initialisé, intentionnellement console.*
    console.warn(
      "[ENV] Warning: REDIS_URL and INNGEST_EVENT_KEY both absent — " +
        "async jobs (audio, image, video, code-exec, doc-parse) will fail. " +
        "Set INNGEST_EVENT_KEY for Vercel or REDIS_URL for self-hosted.",
    );
  }
}

validateEnv();

// Marker export — TS exigerait "isolatedModules: true" sur un fichier sans
// exports, et l'import dynamique `await import("@/lib/env.server")` réclame
// que le fichier soit reconnu comme module. Un boolean trivial fait l'affaire.
export const ENV_VALIDATED = true;
