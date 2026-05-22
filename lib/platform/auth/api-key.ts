/**
 * API Key — Génération et vérification des clés SDK Hearst (hsk_*)
 *
 * Fondation de l'auth serveur-à-serveur pour les produits Hearst
 * (studio, merchant, trading) qui appellent l'API Helm sans session NextAuth.
 *
 * Règles invariables :
 * - La clé brute n'est retournée qu'UNE SEULE FOIS (generateApiKey).
 * - Seul le SHA-256 hex est stocké en DB (key_hash).
 * - verifyApiKey est fail-soft : jamais de throw, null si invalide.
 */

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";

/**
 * Client Supabase non-typé pour les tables absentes du snapshot database.types.ts.
 * Une fois la migration 0091 appliquée et `npm run gen:types` relancé, ce cast
 * pourra être remplacé par le type généré `Database`.
 */
function getUntypedClient(): SupabaseClient | null {
  return getServerSupabase() as unknown as SupabaseClient | null;
}

/** Préfixe universel pour toutes les clés SDK Hearst. */
export const API_KEY_PREFIX = "hsk_";

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * SHA-256 hex d'une clé brute.
 * Fonction pure et déterministe — safe à tester unitairement.
 */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Génère la partie aléatoire d'une clé : 32 bytes → 64 chars hex.
 * Préfixée par API_KEY_PREFIX → longueur totale : 68 chars.
 */
function generateRawKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString("hex");
}

// ─── Types publics ────────────────────────────────────────────────────────────

export interface GenerateApiKeyOptions {
  tenantId: string;
  userId?: string;
  /** Label lisible affiché dans le dashboard. Ex: "Production SDK". */
  name: string;
  /**
   * Scopes OAuth-style accordés à la clé.
   * @default ['read']
   */
  scopes?: string[];
}

export interface GenerateApiKeyResult {
  /** UUID de la row api_keys en DB. */
  id: string;
  /**
   * Clé brute en clair — à afficher ONCE et oublier.
   * N'est jamais relue depuis la DB.
   */
  key: string;
  /** Préfixe d'affichage (8 premiers chars). Ex: "hsk_a1b2". */
  keyPrefix: string;
}

export interface VerifiedApiKey {
  tenantId: string;
  userId: string | null;
  scopes: string[];
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Génère une nouvelle clé API et l'insère en DB.
 *
 * @returns La clé brute en clair (UNE SEULE FOIS) + l'UUID de la row.
 * @throws Error si le client Supabase est indisponible ou si l'INSERT échoue.
 */
export async function generateApiKey(opts: GenerateApiKeyOptions): Promise<GenerateApiKeyResult> {
  const sb = getUntypedClient();
  if (!sb) {
    throw new Error("[api-key] Supabase client unavailable — check env vars");
  }

  const raw = generateRawKey();
  const keyHash = hashApiKey(raw);
  // Préfixe d'affichage : les 8 premiers chars (ex: "hsk_a1b2")
  const keyPrefix = raw.slice(0, 8);
  const scopes = opts.scopes ?? ["read"];

  const { data, error } = await sb
    .from("api_keys")
    .insert({
      tenant_id: opts.tenantId,
      user_id: opts.userId ?? null,
      name: opts.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `[api-key] INSERT failed: ${(error as { message?: string } | null)?.message ?? "no data returned"}`,
    );
  }

  return { id: (data as { id: string }).id, key: raw, keyPrefix };
}

/**
 * Vérifie une clé brute reçue dans un header `Authorization: Bearer`.
 *
 * @returns Le tenant résolu si la clé est valide et non révoquée, null sinon.
 *
 * Fail-soft : toute erreur inattendue retourne null (pas de throw).
 * `last_used_at` est mis à jour en fire-and-forget (ne bloque pas la réponse).
 */
export async function verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
  try {
    // Rejet rapide sans aller en DB si le préfixe est absent
    if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

    const sb = getUntypedClient();
    if (!sb) return null;

    const keyHash = hashApiKey(rawKey);

    const { data, error } = await sb
      .from("api_keys")
      .select("id, tenant_id, user_id, scopes")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (error || !data) return null;

    type ApiKeyRow = { id: string; tenant_id: string; user_id: string | null; scopes: string[] };
    const row = data as ApiKeyRow;

    // Fire-and-forget : ne pas bloquer la réponse sur cette écriture
    void Promise.resolve(
      sb
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", row.id)
        .then(({ error: updErr }: { error: { message: string } | null }) => {
          if (updErr) {
            console.warn(`[api-key] last_used_at update failed (id: ${row.id}):`, updErr.message);
          }
        }),
    ).catch(() => {});

    return {
      tenantId: row.tenant_id,
      userId: row.user_id ?? null,
      scopes: row.scopes ?? ["read"],
    };
  } catch (err) {
    // Fail-soft : log mais jamais de throw vers le caller
    console.error("[api-key] verifyApiKey unexpected error:", err);
    return null;
  }
}

/**
 * Révoque une clé API (soft delete via revoked_at).
 * Passe par service_role — usage serveur uniquement.
 *
 * @throws Error si la mise à jour échoue.
 */
export async function revokeApiKey(id: string): Promise<void> {
  const sb = getUntypedClient();
  if (!sb) throw new Error("[api-key] Supabase client unavailable");

  const { error } = await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(
      `[api-key] revokeApiKey failed: ${(error as { message?: string } | null)?.message ?? "unknown"}`,
    );
  }
}
