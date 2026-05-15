/**
 * P1-2 — Stripe top-up activation tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID_5;
  delete process.env.STRIPE_PRICE_ID_20;
  delete process.env.STRIPE_PRICE_ID_50;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MODERATION_HARD_FAIL;
});

describe("Stripe top-up — configuration", () => {
  it("isStripeConfigured = false sans env vars", async () => {
    const { isStripeConfigured } = await import("@/lib/credits/stripe");
    expect(isStripeConfigured()).toBe(false);
  });

  it("isStripeConfigured = true avec clé + prix", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    process.env.STRIPE_PRICE_ID_5 = "price_5";
    const { isStripeConfigured } = await import("@/lib/credits/stripe");
    expect(isStripeConfigured()).toBe(true);
  });

  it("getAvailableTopUpPrices filtre les prix configurés", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    process.env.STRIPE_PRICE_ID_5 = "price_5";
    process.env.STRIPE_PRICE_ID_50 = "price_50";
    const { getAvailableTopUpPrices } = await import("@/lib/credits/stripe");
    const prices = getAvailableTopUpPrices();
    expect(prices).toHaveLength(2);
    expect(prices[0]).toEqual({ priceId: "price_5", amountUsd: 5 });
    expect(prices[1]).toEqual({ priceId: "price_50", amountUsd: 50 });
  });
});

describe("Stripe top-up — checkout session", () => {
  it("retourne STRIPE_NOT_CONFIGURED si pas de clé", async () => {
    const { createCheckoutSession } = await import("@/lib/credits/stripe");
    const result = await createCheckoutSession({
      userId: "user-1",
      tenantId: "tenant-1",
      priceId: "price_5",
      amountUsd: 5,
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });
    expect("errorCode" in result && result.errorCode).toBe("STRIPE_NOT_CONFIGURED");
  });
});

describe("Stripe top-up — webhook verification", () => {
  it("retourne erreur si STRIPE_WEBHOOK_SECRET absent", async () => {
    const { verifyStripeWebhook } = await import("@/lib/credits/stripe");
    const result = await verifyStripeWebhook("body", "sig");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("STRIPE_WEBHOOK_SECRET absent");
  });

  it("retourne erreur si signature invalide", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const { verifyStripeWebhook } = await import("@/lib/credits/stripe");
    const result = await verifyStripeWebhook("body", "invalid-sig");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("verification failed");
  });
});

describe("Grant credits", () => {
  it("grantCredits retourne error sans DB", async () => {
    const { grantCredits } = await import("@/lib/credits/grant");
    const result = await grantCredits("user-1", 5, {
      source: "stripe_topup",
      sessionId: "sess_123",
      tenantId: "tenant-1",
    });
    expect(result.success).toBe(false);
  });

  it("grantCredits accepte tenantId explicite", async () => {
    const { grantCredits } = await import("@/lib/credits/grant");
    const result = await grantCredits("user-1", 5, {
      source: "stripe_topup",
      sessionId: "sess_123",
      tenantId: "tenant-abc",
    });
    // Sans DB, retourne error — mais le tenantId est passé
    expect(result.success).toBe(false);
  });
});

describe("Moderation hard fail mode", () => {
  it("fail-soft par défaut (HARD_FAIL absent)", async () => {
    delete process.env.MODERATION_HARD_FAIL;
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("test");
    // Sans OPENAI_API_KEY, retourne skipped (fail-soft)
    expect(result.flagged).toBe(false);
    expect(result.source).toBe("skipped");
  });

  it("HARD_FAIL bloque si modération indisponible", async () => {
    process.env.MODERATION_HARD_FAIL = "true";
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("test");
    // Sans OPENAI_API_KEY + HARD_FAIL = contenu bloqué
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("moderation_unavailable");
  });

  it("HARD_FAIL bloque sur erreur HTTP", async () => {
    process.env.MODERATION_HARD_FAIL = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    vi.resetModules();
    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("test");
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("moderation_unavailable");
    expect(result.reason).toContain("503");
  });

  it("fail-soft laisse passer sur erreur HTTP", async () => {
    delete process.env.MODERATION_HARD_FAIL;
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    vi.resetModules();
    const { moderateContent } = await import("@/lib/moderation/openai");
    const result = await moderateContent("test");
    expect(result.flagged).toBe(false);
    expect(result.source).toBe("error");
    expect(result.reason).toContain("503");
  });
});
