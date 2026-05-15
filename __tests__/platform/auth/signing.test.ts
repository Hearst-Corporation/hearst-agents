/**
 * Tests HMAC signing — signed-url.ts
 *
 * Invariants couverts :
 *   1. signToken → verifyToken roundtrip valide
 *   2. verifyToken token expiré → { ok: false, reason: "expired" }
 *   3. verifyToken mauvais secret → { ok: false, reason: "bad_signature" }
 *   4. verifyToken token malformé → { ok: false, reason: "malformed" }
 *   5. signToken sans secret → null
 *   6. signToken avec secret < 32 chars → null
 *   7. hashToken idempotent (même token → même hash SHA-256)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_SECRET = "a".repeat(32); // 32 chars exactement
const OTHER_SECRET = "b".repeat(32);
const SHARE_ID = "aaa11111-0000-0000-0000-000000000001";
const ASSET_ID = "asset-42";

const ENV_BACKUP = process.env.REPORT_SHARING_SECRET;

describe("signToken / verifyToken", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REPORT_SHARING_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.REPORT_SHARING_SECRET;
    else process.env.REPORT_SHARING_SECRET = ENV_BACKUP;
  });

  it("roundtrip valide : signToken → verifyToken retourne ok:true avec sid et aid corrects", async () => {
    const { signToken, verifyToken } = await import("@/lib/reports/sharing/signed-url");

    const now = Date.now();
    const result = signToken({ shareId: SHARE_ID, assetId: ASSET_ID, ttlHours: 24, now });
    expect(result).not.toBeNull();

    const verify = verifyToken(result?.token, { now });
    expect(verify.ok).toBe(true);
    if (verify.ok) {
      expect(verify.payload.sid).toBe(SHARE_ID);
      expect(verify.payload.aid).toBe(ASSET_ID);
    }
  });

  it("verifyToken : token expiré → { ok: false, reason: 'expired' }", async () => {
    const { signToken, verifyToken } = await import("@/lib/reports/sharing/signed-url");

    const pastNow = Date.now() - 48 * 3600 * 1000; // signé il y a 48h
    const result = signToken({ shareId: SHARE_ID, assetId: ASSET_ID, ttlHours: 1, now: pastNow });
    expect(result).not.toBeNull();

    // Vérification au moment actuel → token expiré
    const verify = verifyToken(result?.token);
    expect(verify.ok).toBe(false);
    if (!verify.ok) {
      expect(verify.reason).toBe("expired");
    }
  });

  it("verifyToken : mauvais secret → { ok: false, reason: 'bad_signature' }", async () => {
    // Signe avec VALID_SECRET (déjà posé dans beforeEach)
    const now = Date.now();
    const { signToken } = await import("@/lib/reports/sharing/signed-url");
    const result = signToken({ shareId: SHARE_ID, assetId: ASSET_ID, ttlHours: 24, now });
    expect(result).not.toBeNull();

    // Recharge le module avec OTHER_SECRET pour que getSharingSecret() lise la nouvelle valeur
    vi.resetModules();
    process.env.REPORT_SHARING_SECRET = OTHER_SECRET;
    const { verifyToken } = await import("@/lib/reports/sharing/signed-url");

    const verify = verifyToken(result?.token, { now });
    expect(verify.ok).toBe(false);
    if (!verify.ok) {
      expect(verify.reason).toBe("bad_signature");
    }
  });

  it("verifyToken : token tronqué sans séparateur '.' → { ok: false, reason: 'malformed' }", async () => {
    const { verifyToken } = await import("@/lib/reports/sharing/signed-url");
    const malformed = "aGVsbG8td29ybGQ"; // base64url sans point
    const verify = verifyToken(malformed);
    expect(verify.ok).toBe(false);
    if (!verify.ok) {
      expect(verify.reason).toBe("malformed");
    }
  });

  it("signToken : REPORT_SHARING_SECRET absent → retourne null", async () => {
    vi.resetModules();
    delete process.env.REPORT_SHARING_SECRET;
    const { signToken } = await import("@/lib/reports/sharing/signed-url");
    const result = signToken({ shareId: SHARE_ID, assetId: ASSET_ID, ttlHours: 24 });
    expect(result).toBeNull();
  });

  it("signToken : REPORT_SHARING_SECRET < 32 chars → retourne null", async () => {
    vi.resetModules();
    process.env.REPORT_SHARING_SECRET = "short"; // 5 chars
    const { signToken } = await import("@/lib/reports/sharing/signed-url");
    const result = signToken({ shareId: SHARE_ID, assetId: ASSET_ID, ttlHours: 24 });
    expect(result).toBeNull();
  });
});

describe("hashToken", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REPORT_SHARING_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.REPORT_SHARING_SECRET;
    else process.env.REPORT_SHARING_SECRET = ENV_BACKUP;
  });

  it("idempotent : deux appels avec le même token → même hash SHA-256", async () => {
    const { hashToken } = await import("@/lib/reports/sharing/signed-url");
    const token = "payload.signature";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    // SHA-256 hex = 64 chars
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});
