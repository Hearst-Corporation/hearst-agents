/**
 * Signed URL — partage public de reports via token HMAC.
 *
 * Format de token : `<base64url(payload)>.<hmac-base64url>`
 *   payload = { sid, aid, exp, iat }   // sid = share id (uuid v4),
 *                                      // aid = asset id,
 *                                      // exp/iat en secondes Unix
 *   hmac    = HMAC-SHA256(secret, payloadBase64)
 *
 * Côté DB : on ne stocke JAMAIS le token raw — uniquement son hash SHA-256
 * (sha256(token).hex). Le lookup se fait par hash, ce qui rend impossible
 * une fuite de DB → tokens valides.
 *
 * Le secret est lu via `REPORT_SHARING_SECRET` (≥ 32 chars). Si absent,
 * on log un warning fort et on refuse de signer (fail-closed).
 */

import crypto from "node:crypto";

// ── Constantes (pas de magic numbers ailleurs) ───────────────

export const TTL_MAX_HOURS = 168; // 7 jours
export const TTL_DEFAULT_HOURS = 24;
export const TTL_MIN_HOURS = 1;
export const SECRET_MIN_LENGTH = 32;
export const SHARE_RATE_LIMIT_PER_HOUR = 30; // par user

const HMAC_ALG = "sha256";
const TOKEN_SEPARATOR = ".";

// ── Types ────────────────────────────────────────────────────

export interface SignedTokenPayload {
  /** Share id (uuid v4). */
  sid: string;
  /** Asset id (text — assets.id est text). */
  aid: string;
  /** Issued at (seconds, Unix). */
  iat: number;
  /** Expiration (seconds, Unix). */
  exp: number;
}

export interface SignTokenInput {
  shareId: string;
  assetId: string;
  ttlHours: number;
  /** Override pour tests. Défaut Date.now(). */
  now?: number;
}

export interface SignTokenResult {
  /** Token raw — à transmettre dans l'URL, jamais persisté. */
  token: string;
  /** SHA-256 hex du token raw — à persister en DB. */
  tokenHash: string;
  /** Date d'expiration (ISO 8601). */
  expiresAt: string;
  payload: SignedTokenPayload;
}

export interface VerifyTokenResult {
  ok: true;
  payload: SignedTokenPayload;
  tokenHash: string;
}

export type VerifyTokenError =
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "bad_signature" }
  | { ok: false; reason: "expired"; payload: SignedTokenPayload }
  | { ok: false; reason: "no_secret" };

// ── Secret loader (fail-closed) ──────────────────────────────

let _warned = false;

function getSharingSecret(): string | null {
  const secret = process.env.REPORT_SHARING_SECRET ?? "";
  if (secret.length < SECRET_MIN_LENGTH) {
    if (!_warned) {
      console.warn(
        `[sharing] REPORT_SHARING_SECRET absent ou < ${SECRET_MIN_LENGTH} chars — signing désactivé (fail-closed).`,
      );
      _warned = true;
    }
    return null;
  }
  return secret;
}

/**
 * Liste ordonnée des secrets acceptés en VÉRIFICATION (signing utilise
 * toujours `getSharingSecret()` = le primaire). Permet une rotation sans
 * casser les tokens en circulation (cf. audit P0-16) :
 *   - Le primaire `REPORT_SHARING_SECRET` est utilisé pour signer + vérifier
 *   - Les secondaires `REPORT_SHARING_SECRET_PREVIOUS` (puis _N) sont
 *     uniquement acceptés en vérification, pendant la fenêtre TTL_MAX_HOURS
 *     (= 7 jours) pour laisser les anciens tokens expirer naturellement.
 *
 * Ordre du retour : primaire d'abord (chemin chaud), puis fallbacks.
 */
function getSharingSecretsForVerify(): string[] {
  const primary = getSharingSecret();
  const secrets: string[] = primary ? [primary] : [];
  const previous = process.env.REPORT_SHARING_SECRET_PREVIOUS ?? "";
  if (previous.length >= SECRET_MIN_LENGTH && previous !== primary) {
    secrets.push(previous);
  }
  return secrets;
}

// ── Encoding helpers ─────────────────────────────────────────

function base64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

// ── Signing ──────────────────────────────────────────────────

export function signToken(input: SignTokenInput): SignTokenResult | null {
  const secret = getSharingSecret();
  if (!secret) return null;

  const ttl = Math.min(Math.max(input.ttlHours, TTL_MIN_HOURS), TTL_MAX_HOURS);
  const nowMs = input.now ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttl * 3600;

  const payload: SignedTokenPayload = {
    sid: input.shareId,
    aid: input.assetId,
    iat,
    exp,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac(HMAC_ALG, secret).update(payloadB64).digest();
  const sigB64 = base64url(sig);
  const token = `${payloadB64}${TOKEN_SEPARATOR}${sigB64}`;

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(exp * 1000).toISOString(),
    payload,
  };
}

// ── Verification ─────────────────────────────────────────────

export function verifyToken(
  token: string,
  options: { now?: number } = {},
): VerifyTokenResult | VerifyTokenError {
  const secrets = getSharingSecretsForVerify();
  if (secrets.length === 0) return { ok: false, reason: "no_secret" };

  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false, reason: "malformed" };

  let providedSig: Buffer;
  try {
    providedSig = fromBase64url(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  // Tente chaque secret accepté (primaire puis previous) — permet rotation
  // sans invalider les tokens en circulation. Timing-safe sur chaque tentative.
  let matched = false;
  for (const secret of secrets) {
    const expectedSig = crypto.createHmac(HMAC_ALG, secret).update(payloadB64).digest();
    if (
      expectedSig.length === providedSig.length &&
      crypto.timingSafeEqual(expectedSig, providedSig)
    ) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    return { ok: false, reason: "bad_signature" };
  }

  // Decode payload
  let payload: SignedTokenPayload;
  try {
    const json = fromBase64url(payloadB64).toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).sid !== "string" ||
      typeof (parsed as Record<string, unknown>).aid !== "string" ||
      typeof (parsed as Record<string, unknown>).iat !== "number" ||
      typeof (parsed as Record<string, unknown>).exp !== "number"
    ) {
      return { ok: false, reason: "malformed" };
    }
    payload = parsed as SignedTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const nowMs = options.now ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  if (payload.exp <= nowSec) {
    return { ok: false, reason: "expired", payload };
  }

  return { ok: true, payload, tokenHash: hashToken(token) };
}

// ── Rate limiter (in-memory simple par userId / heure) ───────

interface RateState {
  windowStart: number;
  count: number;
}

const rateStates = new Map<string, RateState>();
const ONE_HOUR_MS = 3_600_000;

export function checkShareRateLimit(
  userId: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const state = rateStates.get(userId);
  if (!state || now - state.windowStart > ONE_HOUR_MS) {
    rateStates.set(userId, { windowStart: now, count: 1 });
    return { ok: true };
  }
  if (state.count >= SHARE_RATE_LIMIT_PER_HOUR) {
    return { ok: false, retryAfterMs: ONE_HOUR_MS - (now - state.windowStart) };
  }
  state.count += 1;
  return { ok: true };
}

/** Test-only — vidage de l'état rate-limiter. */
export function _resetShareRateLimit(): void {
  rateStates.clear();
}

// ── URL builder ──────────────────────────────────────────────

export function buildShareUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/public/reports/${encodeURIComponent(token)}`;
}
