/**
 * HITL Confirmation Token — protection cryptographique contre la prompt injection
 * sur les tools write-side.
 *
 * Pattern :
 *   1. Le LLM propose un draft (pas d'exécution).
 *   2. L'UI (ou l'orchestrateur) émet un token HMAC signé avec les args canoniques.
 *   3. L'exécution n'a lieu que si le token est valide (signature + TTL + user/tool/args match).
 *
 * Garanties :
 *   - Un LLM compromis ne peut PAS générer un token valide (ne connaît pas NEXTAUTH_SECRET).
 *   - Un token ne peut PAS être réutilisé pour des args différents (argsHash dans payload).
 *   - TTL 5 min — fenêtre de replay acceptable sans Redis (MVP).
 *   - Timing-safe compare sur la signature (pas de timing oracle).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// NEXTAUTH_SECRET est disponible côté serveur sur toutes les routes Next.js.
// On throw si absent pour fail-fast : un serveur sans secret ne doit pas tourner.
function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("[HITL] NEXTAUTH_SECRET absent — impossible de signer les tokens.");
  return s;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ToolConfirmationPayload {
  userId: string;
  tenantId: string;
  toolSlug: string;
  argsHash: string; // HMAC-SHA256 des args canoniques (clés triées)
  nonce: string; // 16 bytes random — unicité par emission
  expiresAt: number; // epoch ms
}

// ── Issue ─────────────────────────────────────────────────────────────────────

/**
 * Émet un token de confirmation signé.
 * À appeler côté serveur uniquement (nécessite NEXTAUTH_SECRET).
 */
export function issueConfirmationToken(
  payload: Omit<ToolConfirmationPayload, "nonce" | "expiresAt">,
): string {
  const secret = getSecret();
  const body: ToolConfirmationPayload = {
    ...payload,
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Date.now() + TTL_MS,
  };
  const json = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  return `${Buffer.from(json).toString("base64url")}.${sig}`;
}

// ── Verify ────────────────────────────────────────────────────────────────────

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Vérifie un token de confirmation.
 * Retourne { ok: true } uniquement si toutes les assertions passent.
 * Ne throw jamais — toute erreur est un { ok: false }.
 */
export function verifyConfirmationToken(
  token: string,
  expected: {
    userId: string;
    tenantId: string;
    toolSlug: string;
    argsHash: string;
  },
): VerifyResult {
  try {
    const secret = getSecret();
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return { ok: false, reason: "malformed" };

    const bodyB64 = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    if (!bodyB64 || !sig) return { ok: false, reason: "malformed" };

    const json = Buffer.from(bodyB64, "base64url").toString("utf8");
    const expectedSig = createHmac("sha256", secret).update(json).digest("base64url");

    // Compare en longueur fixe pour éviter timing oracle
    const sigBuf = Buffer.from(sig);
    const expSigBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expSigBuf.length) return { ok: false, reason: "bad_signature" };
    if (!timingSafeEqual(sigBuf, expSigBuf)) return { ok: false, reason: "bad_signature" };

    const payload = JSON.parse(json) as ToolConfirmationPayload;

    if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    if (payload.userId !== expected.userId) return { ok: false, reason: "user_mismatch" };
    if (payload.tenantId !== expected.tenantId) return { ok: false, reason: "tenant_mismatch" };
    if (payload.toolSlug !== expected.toolSlug) return { ok: false, reason: "tool_mismatch" };
    if (payload.argsHash !== expected.argsHash) return { ok: false, reason: "args_mismatch" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "parse_error" };
  }
}

// ── Args hash ─────────────────────────────────────────────────────────────────

/**
 * Hash canonique des args : clés triées alphabétiquement + JSON.stringify.
 * Garantit que { b:1, a:2 } et { a:2, b:1 } produisent le même hash.
 */
export function hashToolArgs(args: object): string {
  const secret = getSecret();
  const keys = Object.keys(args).sort();
  const canonical = JSON.stringify(args, keys);
  return createHmac("sha256", secret).update(canonical).digest("base64url");
}
