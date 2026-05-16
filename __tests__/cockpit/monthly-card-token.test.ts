/**
 * Tests Vitest — `lib/cockpit/monthly-card-token.ts`
 *
 * Couvre :
 *  - signCardToken (mode public, mode render)
 *  - verifyCardToken (signature, expiration, malformed)
 *  - URLs builder (public + render)
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPublicCardUrl,
  buildRenderCardUrl,
  signCardToken,
  TTL_DEFAULT_HOURS,
  verifyCardToken,
} from "@/lib/cockpit/monthly-card-token";

const SECRET = "x".repeat(64);
const USER_ID = "user-1";
const YEAR_MONTH = "2026-04";

describe("signCardToken / verifyCardToken", () => {
  beforeEach(() => {
    process.env.HEARST_CARD_SHARING_SECRET = SECRET;
  });

  it("retourne null si secret absent", () => {
    delete process.env.HEARST_CARD_SHARING_SECRET;
    delete process.env.REPORT_SHARING_SECRET;
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "public",
    });
    expect(signed).toBeNull();
  });

  it("signe un token valide en mode public (TTL = 1 an par défaut)", () => {
    const now = Date.now();
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "public",
      now,
    });

    expect(signed).not.toBeNull();
    expect(signed?.token).toContain(".");
    expect(signed?.payload.uid).toBe(USER_ID);
    expect(signed?.payload.ym).toBe(YEAR_MONTH);
    expect(signed?.payload.mode).toBe("public");

    // TTL_DEFAULT_HOURS = 24 * 365 = 1 an
    const expectedExpSec = Math.floor(now / 1000) + TTL_DEFAULT_HOURS * 3600;
    expect(signed?.payload.exp).toBe(expectedExpSec);
  });

  it("signe un token valide en mode render avec TTL court", () => {
    const now = Date.now();
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "render",
      ttlHours: 1,
      now,
    });

    expect(signed).not.toBeNull();
    expect(signed?.payload.mode).toBe("render");
    const expectedExpSec = Math.floor(now / 1000) + 1 * 3600;
    expect(signed?.payload.exp).toBe(expectedExpSec);
  });

  it("verifyCardToken accepte un token valide et retourne le payload", () => {
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "public",
    });
    expect(signed).not.toBeNull();
    const result = verifyCardToken(signed!.token);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.uid).toBe(USER_ID);
      expect(result.payload.ym).toBe(YEAR_MONTH);
      expect(result.payload.mode).toBe("public");
    }
  });

  it("verifyCardToken rejette un token modifié (bad signature)", () => {
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "public",
    });
    expect(signed).not.toBeNull();
    // Tamper : remplacer la signature entière par une signature garantie invalide.
    // Plus fiable qu'un flip de caractère (peut tomber sur un caractère identique).
    const parts = signed!.token.split(".");
    expect(parts.length).toBe(2);
    const tampered = `${parts[0]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    const result = verifyCardToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad_signature");
    }
  });

  it("verifyCardToken rejette un token expiré", () => {
    const oneHourAgo = Date.now() - 2 * 3600 * 1000;
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "render",
      ttlHours: 1,
      now: oneHourAgo,
    });
    expect(signed).not.toBeNull();
    const result = verifyCardToken(signed!.token);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
  });

  it("verifyCardToken rejette un token malformé (pas de séparateur)", () => {
    const result = verifyCardToken("nopelmaomalformed");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed");
    }
  });

  it("verifyCardToken rejette un token avec parties vides", () => {
    const result = verifyCardToken(".something");
    expect(result.ok).toBe(false);
  });

  it("verifyCardToken : payload modifié → bad_signature (HMAC catch tout tampering)", () => {
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "public",
    });
    expect(signed).not.toBeNull();
    const parts = signed!.token.split(".");
    expect(parts.length).toBe(2);
    // Inverser le case du premier byte du payload (B64 reste valide)
    const head = parts[0].charCodeAt(0);
    const swapped = String.fromCharCode(head ^ 1) + parts[0].slice(1);
    const tampered = `${swapped}.${parts[1]}`;

    const result = verifyCardToken(tampered);
    expect(result.ok).toBe(false);
  });

  it("fallback secret REPORT_SHARING_SECRET si HEARST_CARD absent", () => {
    delete process.env.HEARST_CARD_SHARING_SECRET;
    process.env.REPORT_SHARING_SECRET = SECRET;
    const signed = signCardToken({
      userId: USER_ID,
      yearMonth: YEAR_MONTH,
      mode: "public",
    });
    expect(signed).not.toBeNull();
    const result = verifyCardToken(signed!.token);
    expect(result.ok).toBe(true);
  });
});

describe("buildPublicCardUrl / buildRenderCardUrl", () => {
  it("construit une URL publique correctement formée", () => {
    const url = buildPublicCardUrl("token123", "https://app.test");
    expect(url).toBe("https://app.test/public/hearst-card/token123");
  });

  it("construit une URL de rendu avec query param token", () => {
    const url = buildRenderCardUrl("user-1", "2026-04", "tok", "https://app.test");
    expect(url).toBe("https://app.test/hearst-card/user-1/2026-04?token=tok");
  });

  it("trim le slash final du baseUrl", () => {
    const url = buildPublicCardUrl("t", "https://app.test/");
    expect(url).toBe("https://app.test/public/hearst-card/t");
  });
});
