/**
 * P1-2 — Stripe top-up activation tests.
 */

import { describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID_5;
  delete process.env.STRIPE_PRICE_ID_20;
  delete process.env.STRIPE_PRICE_ID_50;
  delete process.env.STRIPE_WEBHOOK_SECRET;
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
    });
    expect(result.success).toBe(false);
  });
});
