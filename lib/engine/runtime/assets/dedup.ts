import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/platform/db/supabase";

/** Hash déterministe des paramètres de génération. */
export function computeGenerationHash(params: Record<string, unknown>): string {
  const stable = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

/**
 * Cherche un asset existant avec le même generation_hash.
 * Retourne le storage_key si trouvé, null sinon.
 * Fail-soft : si la colonne generation_hash n'existe pas en DB, retourne null.
 */
export async function findDuplicateAsset(tenantId: string, hash: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("assets")
    .select("storage_key")
    .eq("tenant_id", tenantId)
    .eq("generation_hash", hash)
    .limit(1)
    .single();
  if (error) return null;
  return (data as { storage_key?: string } | null)?.storage_key ?? null;
}
