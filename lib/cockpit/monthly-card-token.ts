/**
 * Hearst Card — Token HMAC pour partage public.
 *
 * Format identique à `lib/reports/sharing/signed-url.ts` mais payload
 * dédié : on encode `userId` + `yearMonth` + `iat`/`exp`. Pas de DB row
 * (la card est régénérée déterministe à partir des données du mois) — le
 * token suffit comme preuve d'autorisation.
 *
 * Secret : `HEARST_CARD_SHARING_SECRET` (≥ 32 chars). Fallback :
 * `REPORT_SHARING_SECRET` pour éviter d'imposer une nouvelle env var.
 *
 * Utilisé pour :
 *  - URL publique `/public/hearst-card/[token]` (partage Twitter/LinkedIn)
 *  - URL interne de rendu `/hearst-card/[userId]/[yearMonth]?token=...`
 *    (consommée par le screenshotter Playwright pour bypass auth)
 */

import crypto from "node:crypto";

export const TTL_DEFAULT_HOURS = 24 * 365; // 1 an — partage long sur les réseaux
export const TTL_MAX_HOURS = 24 * 365 * 2; // 2 ans hard-cap
export const TTL_MIN_HOURS = 1;
export const SECRET_MIN_LENGTH = 32;

const HMAC_ALG = "sha256";
const TOKEN_SEPARATOR = ".";

export interface MonthlyCardTokenPayload {
  /** User propriétaire de la card. */
  uid: string;
  /** Year-month canonique `YYYY-MM`. */
  ym: string;
  /** Issued-at (Unix seconds). */
  iat: number;
  /** Expiration (Unix seconds). */
  exp: number;
  /**
   * Mode du token :
   *  - "public" : URL publique de partage
   *  - "render" : URL interne pour le screenshotter (bypass auth)
   */
  mode: "public" | "render";
}

let _warned = false;

function getCardSecret(): string | null {
  const secret = process.env.HEARST_CARD_SHARING_SECRET ?? process.env.REPORT_SHARING_SECRET ?? "";
  if (secret.length < SECRET_MIN_LENGTH) {
    if (!_warned) {
      console.warn(
        `[monthly-card] HEARST_CARD_SHARING_SECRET / REPORT_SHARING_SECRET absent ou < ${SECRET_MIN_LENGTH} chars — signing désactivé.`,
      );
      _warned = true;
    }
    return null;
  }
  return secret;
}

function base64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function signCardToken(input: {
  userId: string;
  yearMonth: string;
  ttlHours?: number;
  mode: "public" | "render";
  now?: number;
}): { token: string; expiresAt: string; payload: MonthlyCardTokenPayload } | null {
  const secret = getCardSecret();
  if (!secret) return null;

  const ttl = Math.min(Math.max(input.ttlHours ?? TTL_DEFAULT_HOURS, TTL_MIN_HOURS), TTL_MAX_HOURS);
  const nowMs = input.now ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttl * 3600;

  const payload: MonthlyCardTokenPayload = {
    uid: input.userId,
    ym: input.yearMonth,
    mode: input.mode,
    iat,
    exp,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac(HMAC_ALG, secret).update(payloadB64).digest();
  const sigB64 = base64url(sig);
  const token = `${payloadB64}${TOKEN_SEPARATOR}${sigB64}`;

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    payload,
  };
}

export type VerifyCardTokenResult =
  | { ok: true; payload: MonthlyCardTokenPayload }
  | { ok: false; reason: "no_secret" | "malformed" | "bad_signature" | "expired" };

export function verifyCardToken(
  token: string,
  options: { now?: number } = {},
): VerifyCardTokenResult {
  const secret = getCardSecret();
  if (!secret) return { ok: false, reason: "no_secret" };

  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false, reason: "malformed" };

  const expectedSig = crypto.createHmac(HMAC_ALG, secret).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = fromBase64url(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: MonthlyCardTokenPayload;
  try {
    const json = fromBase64url(payloadB64).toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.ym !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      (parsed.mode !== "public" && parsed.mode !== "render")
    ) {
      return { ok: false, reason: "malformed" };
    }
    payload = {
      uid: parsed.uid,
      ym: parsed.ym,
      iat: parsed.iat,
      exp: parsed.exp,
      mode: parsed.mode,
    };
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const nowSec = Math.floor((options.now ?? Date.now()) / 1000);
  if (payload.exp <= nowSec) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}

export function buildPublicCardUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/public/hearst-card/${encodeURIComponent(token)}`;
}

export function buildRenderCardUrl(
  userId: string,
  yearMonth: string,
  token: string,
  baseUrl?: string,
): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/hearst-card/${encodeURIComponent(userId)}/${encodeURIComponent(yearMonth)}?token=${encodeURIComponent(token)}`;
}
