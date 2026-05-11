import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("[ENV ERROR] NEXTAUTH_SECRET required for OAuth state HMAC signing");
}

/**
 * Crée un state OAuth signé HMAC-SHA256.
 * Format : base64url(payload).base64url(signature)
 *
 * Le payload est un JSON arbitraire (typiquement { v: codeVerifier, u: userId, ... }).
 * La signature lie le payload au NEXTAUTH_SECRET serveur — un attaquant ne peut
 * pas forger un state valide sans connaître le secret.
 */
export function signOAuthState(payload: object): string {
  const secret = SECRET ?? "dev-only-secret";
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * Vérifie + décode un state OAuth signé.
 * Retourne null si signature invalide, payload mal formé, ou state absent.
 * Utilise timingSafeEqual pour éviter les timing attacks sur la comparaison HMAC.
 */
export function verifyOAuthState<T = unknown>(state: string | null | undefined): T | null {
  if (!state || typeof state !== "string") return null;

  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const body = state.slice(0, dotIndex);
  const sig = state.slice(dotIndex + 1);
  if (!body || !sig) return null;

  const secret = SECRET ?? "dev-only-secret";
  const expectedSig = createHmac("sha256", secret).update(body).digest("base64url");

  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "base64url");
    expBuf = Buffer.from(expectedSig, "base64url");
  } catch {
    return null;
  }

  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as T;
  } catch {
    return null;
  }
}
