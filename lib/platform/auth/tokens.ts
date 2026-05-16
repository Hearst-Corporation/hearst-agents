/**
 * Platform Auth — Token Store (AES-256-GCM)
 *
 * Canonical location for OAuth token encryption, storage, and lifecycle.
 * Architecture Finale: lib/platform/auth/tokens.ts
 */

import crypto from "node:crypto";
import type { Database } from "@/lib/database.types";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

type UserTokenInsert = Database["public"]["Tables"]["user_tokens"]["Insert"];

/* ─── Supabase client (canonique via getServerSupabase) ─── */

const USE_MEMORY_STORE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  return requireServerSupabase();
}

/* ─── In-memory fallback for dev without Supabase ─── */

const memoryTokens = new Map<string, Record<string, unknown>>();

function memKey(userId: string, provider: string) {
  return `${userId}::${provider}`;
}

/* ─── Key Provider abstraction + F-028: Key rotation via keyId envelope ─── */

export interface KeyProvider {
  getKey(): Buffer;
}

class EnvKeyProvider implements KeyProvider {
  getKey(): Buffer {
    const hex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-char hex string (256-bit)");
    }
    return Buffer.from(hex, "hex");
  }
}

let keyProvider: KeyProvider = new EnvKeyProvider();

export function setKeyProvider(provider: KeyProvider) {
  keyProvider = provider;
}

/**
 * Multi-key provider pour rotation. Nouvelles écritures utilisent ACTIVE_KEY_ID,
 * anciennes lectures (avec d'autres keyIds) restent compatibles.
 *
 * Format de ciphertext après rotation : `keyId.iv.tag.ciphertext` (base64url)
 */
const KEY_PROVIDERS: Record<string, () => Buffer> = {
  "1": () => {
    const hex = process.env.TOKEN_ENCRYPTION_KEY_1 ?? process.env.TOKEN_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
      throw new Error("TOKEN_ENCRYPTION_KEY_1 (or TOKEN_ENCRYPTION_KEY) must be 64-char hex");
    }
    return Buffer.from(hex, "hex");
  },
  "2": () => {
    const hex = process.env.TOKEN_ENCRYPTION_KEY_2;
    if (!hex || hex.length !== 64) {
      throw new Error("TOKEN_ENCRYPTION_KEY_2 must be 64-char hex (if key rotation active)");
    }
    return Buffer.from(hex, "hex");
  },
};

// ID de la clé active pour les nouvelles écritures. Default : "1" (backward compat).
const ACTIVE_KEY_ID = process.env.TOKEN_ENCRYPTION_KEY_ACTIVE ?? "1";

/* ─── AES-256-GCM encryption with keyId rotation ─── */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard : 12 bytes (96 bits)

/**
 * Chiffre un token avec la clé active et l'enveloppe avec son keyId.
 * Format : `keyId.iv.tag.ciphertext` (tous en base64url pour pas de ':' collision)
 */
export function encryptToken(plaintext: string): string {
  const keyId = ACTIVE_KEY_ID;
  const keyFn = KEY_PROVIDERS[keyId];
  if (!keyFn) {
    throw new Error(`Invalid ACTIVE_KEY_ID "${keyId}" — not in KEY_PROVIDERS`);
  }
  const key = keyFn();
  if (key.length !== 32) {
    throw new Error(`Key ${keyId} has invalid length ${key.length}, expected 32 bytes`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format : keyId.iv.tag.ciphertext (base64url)
  return [
    keyId,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Déchiffre un token avec gestion backward-compatible de keyIds historiques.
 * Parse le format enveloppe `keyId.iv.tag.ciphertext`, sélectionne la clé
 * correspondante, puis déchiffre.
 */
export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(".");
  const legacyParts = ciphertext.split(":");

  // Backward compat : ancien format sans keyId était `iv:tag:enc` (hex)
  if (legacyParts.length === 3 && !ciphertext.includes(".")) {
    console.warn("[TokenStore] Décryption en format legacy (sans keyId) — migration conseillée");
    const [ivHex, authTagHex, encHex] = legacyParts;
    if (!ivHex || !authTagHex || !encHex) throw new Error("Malformed legacy token");
    const key = keyProvider.getKey(); // Fallback sur ancien provider
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString(
      "utf8",
    );
  }

  // Nouveau format : `keyId.iv.tag.ciphertext` (base64url)
  if (parts.length !== 4) throw new Error("Malformed encrypted token (expected 4 parts)");

  const [keyId, ivB64, tagB64, ctB64] = parts;
  if (!keyId || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed token — missing parts");
  }

  const keyFn = KEY_PROVIDERS[keyId];
  if (!keyFn) {
    throw new Error(
      `Unknown key ID "${keyId}" — rotation déjà complétée? Vérifiez TOKEN_ENCRYPTION_KEY_*`,
    );
  }

  const key = keyFn();
  if (key.length !== 32) {
    throw new Error(`Key ${keyId} has invalid length ${key.length}, expected 32 bytes`);
  }

  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ct = Buffer.from(ctB64, "base64url");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (err) {
    throw new Error(
      `Decryption failed for key ${keyId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/* ─── Constants ─── */

const MAX_AUTH_FAILURES = 5;
const REFRESH_ROTATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ─── Types ─── */

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number;
}

export interface TokenMeta {
  tokens: StoredTokens;
  revoked: boolean;
  authFailureCount: number;
  needsRotation: boolean;
}

const EMPTY: StoredTokens = { accessToken: null, refreshToken: null, expiresAt: 0 };

/* ─── Read ─── */

export async function getTokens(userId: string, provider = "google"): Promise<StoredTokens> {
  const meta = await getTokenMeta(userId, provider);
  if (meta.revoked) return EMPTY;
  return meta.tokens;
}

export async function getTokenMeta(userId: string, provider = "google"): Promise<TokenMeta> {
  if (USE_MEMORY_STORE) {
    const row = memoryTokens.get(memKey(userId, provider));
    if (!row) return { tokens: EMPTY, revoked: false, authFailureCount: 0, needsRotation: false };
    return {
      tokens: {
        accessToken: (row.accessToken as string) ?? null,
        refreshToken: (row.refreshToken as string) ?? null,
        expiresAt: (row.expiresAt as number) ?? 0,
      },
      revoked: false,
      authFailureCount: 0,
      needsRotation: false,
    };
  }
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("user_tokens")
      .select(
        "access_token_enc, refresh_token_enc, expires_at, revoked_at, auth_failure_count, refresh_rotated_at",
      )
      .eq("user_id", userId)
      .eq("provider", provider)
      .single();

    if (error || !data) {
      return { tokens: EMPTY, revoked: false, authFailureCount: 0, needsRotation: false };
    }

    const revoked = !!data.revoked_at;
    const authFailureCount = data.auth_failure_count ?? 0;

    const lastRotation = data.refresh_rotated_at ? new Date(data.refresh_rotated_at).getTime() : 0;
    const needsRotation =
      lastRotation > 0 ? Date.now() - lastRotation > REFRESH_ROTATION_INTERVAL_MS : false;

    return {
      tokens: {
        accessToken: data.access_token_enc ? decryptToken(data.access_token_enc) : null,
        refreshToken: data.refresh_token_enc ? decryptToken(data.refresh_token_enc) : null,
        expiresAt: data.expires_at ?? 0,
      },
      revoked,
      authFailureCount,
      needsRotation,
    };
  } catch (err) {
    console.error("[TokenStore] Read error:", err instanceof Error ? err.message : err);
    return { tokens: EMPTY, revoked: false, authFailureCount: 0, needsRotation: false };
  }
}

/* ─── Write ─── */

export async function saveTokens(
  userId: string,
  tokens: Partial<StoredTokens>,
  provider = "google",
  options?: { tenantId?: string },
) {
  if (USE_MEMORY_STORE) {
    const k = memKey(userId, provider);
    const existing = memoryTokens.get(k) ?? {};
    if (tokens.accessToken !== undefined) existing.accessToken = tokens.accessToken;
    if (tokens.refreshToken !== undefined) existing.refreshToken = tokens.refreshToken;
    if (tokens.expiresAt !== undefined) existing.expiresAt = tokens.expiresAt;
    if (options?.tenantId) existing.tenantId = options.tenantId;
    memoryTokens.set(k, existing);
    console.log(`[TokenStore] Saved to memory for ${userId}/${provider}`);
    return;
  }
  try {
    const sb = getSupabase();
    const row: UserTokenInsert = {
      user_id: userId,
      provider,
      updated_at: new Date().toISOString(),
      auth_failure_count: 0,
      revoked_at: null,
    };

    if (options?.tenantId) {
      row.tenant_id = options.tenantId;
    }

    if (tokens.accessToken !== undefined) {
      row.access_token_enc = tokens.accessToken ? encryptToken(tokens.accessToken) : null;
    }
    if (tokens.refreshToken !== undefined) {
      row.refresh_token_enc = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;
      row.refresh_rotated_at = new Date().toISOString();
    }
    if (tokens.expiresAt !== undefined) {
      row.expires_at = tokens.expiresAt;
    }

    const { error } = await sb.from("user_tokens").upsert(row, { onConflict: "user_id,provider" });

    if (error) {
      console.error("[TokenStore] Save failed:", error.message);
    }
  } catch (err) {
    console.error("[TokenStore] Save error:", err instanceof Error ? err.message : err);
  }
}

/* ─── Touch last_used_at ─── */

export async function touchLastUsed(userId: string, provider = "google") {
  try {
    const sb = getSupabase();
    await sb
      .from("user_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", provider);
  } catch {
    // non-critical
  }
}

/* ─── Auth failure tracking ─── */

export async function recordAuthFailure(userId: string, provider = "google"): Promise<boolean> {
  try {
    const sb = getSupabase();

    const { data } = await sb
      .from("user_tokens")
      .select("auth_failure_count")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single();

    const count = (data?.auth_failure_count ?? 0) + 1;

    if (count >= MAX_AUTH_FAILURES) {
      await sb
        .from("user_tokens")
        .update({
          auth_failure_count: count,
          revoked_at: new Date().toISOString(),
          access_token_enc: null,
          refresh_token_enc: null,
        })
        .eq("user_id", userId)
        .eq("provider", provider);

      console.error(`[TokenStore] Auto-revoked tokens for ${userId} after ${count} auth failures`);
      return true;
    }

    await sb
      .from("user_tokens")
      .update({ auth_failure_count: count })
      .eq("user_id", userId)
      .eq("provider", provider);

    return false;
  } catch (err) {
    console.error("[TokenStore] Failure tracking error:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function resetAuthFailures(userId: string, provider = "google") {
  try {
    const sb = getSupabase();
    await sb
      .from("user_tokens")
      .update({ auth_failure_count: 0 })
      .eq("user_id", userId)
      .eq("provider", provider);
  } catch {
    // non-critical
  }
}

/* ─── Revoke / Clear ─── */

export async function revokeToken(userId: string, provider = "google") {
  try {
    const sb = getSupabase();
    const { error } = await sb
      .from("user_tokens")
      .update({
        revoked_at: new Date().toISOString(),
        access_token_enc: null,
        refresh_token_enc: null,
      })
      .eq("user_id", userId)
      .eq("provider", provider);

    if (error) {
      console.error("[TokenStore] Revoke failed:", error.message);
    }
  } catch (err) {
    console.error("[TokenStore] Revoke error:", err instanceof Error ? err.message : err);
  }
}

export async function clearTokens(userId: string) {
  try {
    const sb = getSupabase();
    const { error } = await sb.from("user_tokens").delete().eq("user_id", userId);

    if (error) {
      console.error("[TokenStore] Clear failed:", error.message);
    }
  } catch (err) {
    console.error("[TokenStore] Clear error:", err instanceof Error ? err.message : err);
  }
}

/* ─── Helpers ─── */

export function isTokenExpired(expiresAt: number): boolean {
  if (!expiresAt) return true;
  return Date.now() / 1000 > expiresAt - 60;
}
