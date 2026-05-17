import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("[ENV ERROR] NEXTAUTH_SECRET required for OAuth state signing");
}

/**
 * Dérive une clé AES-256 (32 bytes) depuis NEXTAUTH_SECRET via HMAC-SHA256.
 * Isolée par le label "oauth-state-key" pour éviter la réutilisation de clé.
 */
function getKey(): Buffer {
  const secret = SECRET ?? "dev-only-secret";
  return createHmac("sha256", secret).update("oauth-state-key").digest();
}

/**
 * Crée un state OAuth chiffré AES-256-GCM.
 * Format : base64url(iv[12] ‖ ciphertext ‖ authTag[16])
 *
 * Le payload est chiffré (pas juste signé) — un attaquant ne peut pas lire
 * userId/tenantId/workspaceId même sans connaître le secret.
 * L'auth tag GCM garantit l'intégrité : tout state forgé ou tronqué retourne null.
 */
export function signOAuthState(payload: object): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV pour AES-256-GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 128-bit auth tag
  // Format compact : iv ‖ ciphertext ‖ tag — tout en base64url, pas de séparateur
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString("base64url");
}

/**
 * Déchiffre + vérifie un state OAuth AES-256-GCM.
 * Retourne null si state absent, mal formé, forgé, ou tronqué.
 * L'auth tag GCM joue le rôle de timingSafeEqual implicite (rejet constant-time).
 */
export function verifyOAuthState<T = unknown>(state: string | null | undefined): T | null {
  if (!state || typeof state !== "string") return null;
  try {
    const combined = Buffer.from(state, "base64url");
    // Minimum : iv(12) + tag(16) + au moins 1 octet de ciphertext
    if (combined.length < 12 + 16 + 1) return null;
    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(combined.length - 16);
    const encrypted = combined.subarray(12, combined.length - 16);
    const key = getKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf-8")) as T;
  } catch {
    // Couvre : auth tag invalide (forgery), JSON malformé, base64 corrompu
    return null;
  }
}
