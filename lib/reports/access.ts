/**
 * lib/reports/access.ts
 *
 * Helper centralisé pour vérifier l'accès à un asset de type "report".
 * Toutes les routes /api/reports/[reportId]/* doivent importer ce helper
 * plutôt que de dupliquer la logique localement.
 */

import { getServerSupabase } from "@/lib/platform/db/supabase";

/**
 * Vérifie qu'un asset report existe et que le caller a accès.
 *
 * Sécurité : retourne UNIQUEMENT `"not_found"` (mappé 404 côté route) pour
 * 3 cas distincts :
 *  1. asset inexistant
 *  2. asset existe mais kind != "report"
 *  3. asset existe mais provenance.userId mismatch (cross-user)
 *
 * Ne PAS retourner 403 sur le cas (3) — ça leak l'existence du report à
 * un attaquant cross-tenant qui distinguerait alors "n'existe pas" de
 * "existe mais pas à toi". Tous les call sites doivent traiter
 * `not_found` comme un 404 uniforme.
 */
export async function resolveAssetTenant(
  reportId: string,
  callerUserId: string,
  fallbackTenantId: string,
): Promise<{ tenantId: string } | { error: "not_found" | "unavailable" }> {
  const sb = getServerSupabase();
  if (!sb) return { error: "unavailable" };

  const { data, error } = await sb
    .from("assets")
    .select("id, kind, provenance")
    .eq("id", reportId)
    .maybeSingle();
  if (error) return { error: "unavailable" };
  if (!data) return { error: "not_found" };
  if (data.kind !== "report") return { error: "not_found" };

  const provenance = (data.provenance ?? {}) as Record<string, unknown>;
  if (provenance.userId !== undefined && provenance.userId !== callerUserId) {
    return { error: "not_found" };
  }
  const tenantId = (provenance.tenantId as string | undefined) ?? fallbackTenantId;
  return { tenantId };
}
