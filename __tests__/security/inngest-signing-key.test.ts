/**
 * F-007 — assertInngestSigningKey : hard-throw en prod si clé absente
 *
 * Couvre :
 * 1. isProductionLike() OR logic sur NODE_ENV / VERCEL_ENV / HEARST_ENV
 * 2. throw si INNGEST_SIGNING_KEY absente + isProd
 * 3. warn-only si absente + isDev
 * 4. no-op si clé présente + isProd
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  delete (process.env as Record<string, string | undefined>).NODE_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.HEARST_ENV;
  delete process.env.INNGEST_SIGNING_KEY;
}

async function freshAssert() {
  // Le module a un `let checked = false;` au top — on le re-import frais
  // pour réinitialiser le state entre tests.
  vi.resetModules();
  return (await import("@/lib/jobs/inngest/check")).assertInngestSigningKey;
}

describe("F-007 — assertInngestSigningKey", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
  });

  describe("isProductionLike — OR logic sur 3 vecteurs env", () => {
    it("NODE_ENV=production sans clé → throw", async () => {
      (process.env as Record<string, string>).NODE_ENV = "production";
      const fn = await freshAssert();
      expect(() => fn()).toThrow(/INNGEST_SIGNING_KEY missing in production/);
    });

    it("VERCEL_ENV=production sans clé → throw", async () => {
      process.env.VERCEL_ENV = "production";
      const fn = await freshAssert();
      expect(() => fn()).toThrow(/INNGEST_SIGNING_KEY missing in production/);
    });

    it("HEARST_ENV=production sans clé → throw", async () => {
      process.env.HEARST_ENV = "production";
      const fn = await freshAssert();
      expect(() => fn()).toThrow(/INNGEST_SIGNING_KEY missing in production/);
    });

    it("HEARST_ENV=prod alias sans clé → throw", async () => {
      process.env.HEARST_ENV = "prod";
      const fn = await freshAssert();
      expect(() => fn()).toThrow(/INNGEST_SIGNING_KEY missing in production/);
    });

    it("VERCEL_ENV=preview (NODE_ENV non set) sans clé → no throw (preview ≠ prod)", async () => {
      process.env.VERCEL_ENV = "preview";
      const fn = await freshAssert();
      expect(() => fn()).not.toThrow();
    });
  });

  describe("Dev/test mode — warn only", () => {
    it("NODE_ENV=development sans clé → no throw, warn appelé", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      (process.env as Record<string, string>).NODE_ENV = "development";
      const fn = await freshAssert();
      expect(() => fn()).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("INNGEST_SIGNING_KEY missing"));
      warnSpy.mockRestore();
    });

    it("Aucun env set sans clé → no throw", async () => {
      const fn = await freshAssert();
      expect(() => fn()).not.toThrow();
    });
  });

  describe("Clé présente — no-op", () => {
    it("NODE_ENV=production avec clé → no throw", async () => {
      (process.env as Record<string, string>).NODE_ENV = "production";
      process.env.INNGEST_SIGNING_KEY = "signkey_test_abc123def456";
      const fn = await freshAssert();
      expect(() => fn()).not.toThrow();
    });

    it("Dev avec clé → no throw, no warn", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      (process.env as Record<string, string>).NODE_ENV = "development";
      process.env.INNGEST_SIGNING_KEY = "signkey_test_abc";
      const fn = await freshAssert();
      expect(() => fn()).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("Idempotency — checked flag", () => {
    it("Second call ne re-throw pas (checked latch)", async () => {
      (process.env as Record<string, string>).NODE_ENV = "production";
      const fn = await freshAssert();
      expect(() => fn()).toThrow();
      // Second call : flag posé, ne re-throw plus
      expect(() => fn()).not.toThrow();
    });
  });
});
