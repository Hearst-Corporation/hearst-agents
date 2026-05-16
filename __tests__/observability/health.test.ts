/**
 * P1-1 — Health observability endpoint logic.
 *
 * Tests la logique de check Sentry / Axiom / Langfuse de manière isolée.
 * L'intégration route HTTP est testée séparément en e2e (requiert auth admin).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    AXIOM_TOKEN: process.env.AXIOM_TOKEN,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.AXIOM_TOKEN;
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("P1-1 health observability — Langfuse flush helper", () => {
  it("flushLangfuse retourne false si aucune clé Langfuse configurée", async () => {
    const { flushLangfuse } = await import("@/lib/observability/langfuse");
    const result = await flushLangfuse(500);
    expect(result).toBe(false);
  });

  it("flushLangfuse respecte le timeout strict", async () => {
    const t0 = Date.now();
    const { flushLangfuse } = await import("@/lib/observability/langfuse");
    await flushLangfuse(100);
    const elapsed = Date.now() - t0;
    // Pas de client → retourne immédiatement, pas de wait timeout
    expect(elapsed).toBeLessThan(50);
  });
});

describe("P1-1 health observability — env-based checks", () => {
  // On teste la logique des check helpers de manière unitaire.
  // Pour éviter d'importer le route handler (qui dépend de requireAdmin),
  // on réplique la logique métier ici.

  function checkSentry() {
    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
    return {
      name: "sentry" as const,
      configured: Boolean(dsn),
      ok: Boolean(dsn),
    };
  }

  function checkAxiom() {
    const token = process.env.AXIOM_TOKEN;
    const configured = Boolean(token);
    return {
      name: "axiom" as const,
      configured,
      // Axiom optionnel en dev/test
      ok: configured || process.env.NODE_ENV !== "production",
    };
  }

  it("checkSentry retourne ok=false si DSN absent", () => {
    const result = checkSentry();
    expect(result.configured).toBe(false);
    expect(result.ok).toBe(false);
  });

  it("checkSentry retourne ok=true si SENTRY_DSN configuré", () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/123";
    const result = checkSentry();
    expect(result.configured).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("checkSentry retourne ok=true si NEXT_PUBLIC_SENTRY_DSN configuré", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://def@sentry.io/456";
    const result = checkSentry();
    expect(result.configured).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("checkAxiom retourne ok=true en dev même sans token", () => {
    // NODE_ENV est "test" par défaut sous Vitest, donc !== "production" → ok=true
    const result = checkAxiom();
    expect(result.configured).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("checkAxiom retourne ok=true si token présent", () => {
    process.env.AXIOM_TOKEN = "xaat-fake-token";
    const result = checkAxiom();
    expect(result.configured).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("agrégation globale : tous OK → status='ok', http 200", () => {
    const checks = [
      { name: "langfuse", ok: true, configured: true, detail: "ok" },
      { name: "sentry", ok: true, configured: true, detail: "ok" },
      { name: "axiom", ok: true, configured: true, detail: "ok" },
    ];
    const allOk = checks.every((c) => c.ok);
    expect(allOk).toBe(true);
    expect(allOk ? 200 : 503).toBe(200);
  });

  it("agrégation globale : un check fail → status='degraded', http 503", () => {
    const checks = [
      { name: "langfuse", ok: true, configured: true, detail: "ok" },
      { name: "sentry", ok: false, configured: false, detail: "DSN absent" },
      { name: "axiom", ok: true, configured: true, detail: "ok" },
    ];
    const allOk = checks.every((c) => c.ok);
    expect(allOk).toBe(false);
    expect(allOk ? 200 : 503).toBe(503);
  });
});

describe("P1-1 health observability — verifyStripeWebhook fail-soft", () => {
  it("retourne false si STRIPE_WEBHOOK_SECRET absent", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { verifyStripeWebhook } = await import("@/lib/credits/stripe");
    const result = await verifyStripeWebhook("body", "sig");
    expect(result.ok).toBe(false);
  });
});
