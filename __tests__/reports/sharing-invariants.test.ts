/**
 * Invariants de sécurité du module reports/sharing.
 * Tests ciblés : sign/verify roundtrip, expiration, mauvais secret,
 * absence de secret, idempotence de hashToken, rate-limit, headers
 * de la route publique.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  signToken,
  verifyToken,
  hashToken,
  checkShareRateLimit,
  _resetShareRateLimit,
  SHARE_RATE_LIMIT_PER_HOUR,
} from "@/lib/reports/sharing/signed-url";

const VALID_SECRET = "a".repeat(32); // exactement 32 chars — seuil min
const FIXED_NOW = 1_700_000_000_000;

// ── Setup / Teardown ──────────────────────────────────────────

let savedSecret: string | undefined;

beforeEach(() => {
  _resetShareRateLimit();
  savedSecret = process.env.REPORT_SHARING_SECRET;
  process.env.REPORT_SHARING_SECRET = VALID_SECRET;
});

afterEach(() => {
  if (savedSecret === undefined) {
    delete process.env.REPORT_SHARING_SECRET;
  } else {
    process.env.REPORT_SHARING_SECRET = savedSecret;
  }
});

// ── Test 1 : signToken + verifyToken roundtrip ────────────────

describe("sharing-invariants — roundtrip sign/verify", () => {
  it("signToken({sid,aid,ttlHours:1}) → verifyToken retourne sid correct", () => {
    const result = signToken({
      shareId: "s1",
      assetId: "a1",
      ttlHours: 1,
      now: FIXED_NOW,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const verified = verifyToken(result.token, { now: FIXED_NOW + 100 });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    expect(verified.payload.sid).toBe("s1");
    expect(verified.payload.aid).toBe("a1");
  });
});

// ── Test 2 : verifyToken expiré ───────────────────────────────

describe("sharing-invariants — token expiré", () => {
  it("token avec exp dans le passé → { ok: false, reason: 'expired' }", () => {
    const signed = signToken({
      shareId: "s-exp",
      assetId: "a-exp",
      ttlHours: 1,
      now: FIXED_NOW,
    });
    if (!signed) throw new Error("signToken a retourné null");

    // On se place 2 heures après l'émission — le token de 1h est expiré
    const verified = verifyToken(signed.token, {
      now: FIXED_NOW + 2 * 3600 * 1000,
    });

    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.reason).toBe("expired");
  });
});

// ── Test 3 : verifyToken mauvais secret ───────────────────────

describe("sharing-invariants — mauvais secret", () => {
  it("signer avec secretA, vérifier avec secretB → bad_signature", () => {
    const secretA = "A".repeat(32);
    const secretB = "B".repeat(32);

    // Signe avec secretA
    process.env.REPORT_SHARING_SECRET = secretA;
    const signed = signToken({
      shareId: "s-bad",
      assetId: "a-bad",
      ttlHours: 1,
      now: FIXED_NOW,
    });
    if (!signed) throw new Error("signToken a retourné null avec secretA");

    // Vérifie avec secretB
    process.env.REPORT_SHARING_SECRET = secretB;
    const verified = verifyToken(signed.token, { now: FIXED_NOW + 100 });

    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(["bad_signature", "invalid"]).toContain(verified.reason);
  });
});

// ── Test 4 : signToken sans secret ───────────────────────────

describe("sharing-invariants — signToken sans secret", () => {
  it("REPORT_SHARING_SECRET absent → signToken retourne null", () => {
    delete process.env.REPORT_SHARING_SECRET;

    const result = signToken({
      shareId: "s-nosec",
      assetId: "a-nosec",
      ttlHours: 1,
    });

    expect(result).toBeNull();
  });
});

// ── Test 5 : hashToken idempotent ────────────────────────────

describe("sharing-invariants — hashToken idempotent", () => {
  it("hashToken('abc') appelé 2 fois → résultat identique", () => {
    const h1 = hashToken("abc");
    const h2 = hashToken("abc");
    expect(h1).toBe(h2);
  });

  it("hashToken est déterministe et produit un hex 64 chars", () => {
    expect(hashToken("foobar")).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── Test 6 : rate limit ──────────────────────────────────────

describe("sharing-invariants — rate limit", () => {
  it("30 appels ok:true, 31ème → ok:false", () => {
    const userId = "user-rl-test";
    const t0 = FIXED_NOW;

    for (let i = 0; i < SHARE_RATE_LIMIT_PER_HOUR; i++) {
      const r = checkShareRateLimit(userId, t0 + i);
      expect(r.ok).toBe(true);
    }

    const blocked = checkShareRateLimit(userId, t0 + SHARE_RATE_LIMIT_PER_HOUR);
    expect(blocked.ok).toBe(false);
  });
});

// ── Test 7 : headers de la route publique ────────────────────
// On test la fonction noIndexHeaders via une réponse 403 (token malformé).
// Aucun mock nécessaire : verifyToken retourne "malformed" sur un token vide.

describe("sharing-invariants — headers route publique", () => {
  it("la route renvoie X-Robots-Tag:noindex et Cache-Control:no-store", async () => {
    // Importe la route directement — secret absent => no_secret => 503 avec headers
    const savedSec = process.env.REPORT_SHARING_SECRET;
    process.env.REPORT_SHARING_SECRET = VALID_SECRET;

    const { GET } = await import(
      "@/app/api/public/reports/[token]/route"
    );

    const req = new Request("http://localhost/api/public/reports/malformed");
    const ctx = {
      params: Promise.resolve({ token: "malformed-token-no-dot" }),
    };

    const res = await GET(req as Parameters<typeof GET>[0], ctx);

    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(res.headers.get("Cache-Control")).toContain("no-store");

    process.env.REPORT_SHARING_SECRET = savedSec;
  });
});
