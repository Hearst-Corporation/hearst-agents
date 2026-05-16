/**
 * Mission ownership verification — fail-closed cross-tenant IDOR guard.
 *
 * Extrait depuis `app/api/v2/missions/[id]/route.ts` pour pouvoir être testé
 * directement (avant : test répliquait la logique inline ce qui faisait
 * passer les tests sans valider la vraie fonction).
 *
 * Sécurité :
 *  - Fast path : cache in-memory (`getMission`)
 *  - Fallback DB (cold lambda / cache vide) — fail-closed si DB inaccessible
 *  - Vérifie user_id (colonne SQL) ET tenantId (JSONB actions)
 *  - Mission legacy sans tenantId JSONB → user_id seul suffit
 */

import { getMission } from "@/lib/engine/runtime/missions/store";
import { logger } from "@/lib/observability/logger";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { redactId } from "@/lib/utils/redact";

/**
 * Vérifie que l'utilisateur possède bien la mission.
 *
 * Fail-closed : retourne false si cache absent ET DB inaccessible ou
 * mission introuvable — empêche le bypass cold-lambda (IDOR P0).
 * Vérifie user_id (colonne SQL) + tenantId (JSONB actions).
 */
export async function verifyMissionOwnership(
  id: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  // Fast path : cache in-memory
  const memMission = getMission(id);
  if (memMission) {
    // Fail-closed durci (P3) : si la mission en cache n'a pas de userId
    // (cache pollué / état dégradé), on refuse l'ownership au lieu d'accepter.
    // tenantId reste permissif pour les missions legacy sans tenantId mémorisé.
    const userMatch = memMission.userId === userId;
    const tenantMatch = !memMission.tenantId || memMission.tenantId === tenantId;
    return userMatch && tenantMatch;
  }

  // Fallback DB — cas cold lambda / cache vide
  const sb = getServerSupabase();
  if (!sb) {
    logger.error(
      {
        event: "mission_ownership_no_db",
        missionId: id,
      },
      "verifyMissionOwnership: no DB client — ownership denied",
    );
    return false; // fail closed
  }

  const { data, error } = await sb
    .from("missions")
    .select("user_id, actions")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    logger.warn(
      {
        event: "mission_ownership_not_found",
        missionId: id,
        ...(error ? { dbError: error.message } : {}),
      },
      "verifyMissionOwnership: mission not found in DB",
    );
    return false;
  }

  const actions = (data.actions ?? {}) as Record<string, unknown>;
  const dbTenantId = actions.tenantId as string | undefined;

  const userMatch = data.user_id === userId;
  // Si tenantId absent du JSONB (missions legacy), on accepte — sinon on vérifie
  const tenantMatch = !dbTenantId || dbTenantId === tenantId;

  if (!userMatch || !tenantMatch) {
    logger.warn(
      {
        event: "idor_attempt",
        action: "verify_ownership",
        missionId: id,
        userId: redactId(userId),
        tenantId: redactId(tenantId),
        userMatch,
        tenantMatch,
      },
      "Mission IDOR attempt blocked",
    );
  }

  return userMatch && tenantMatch;
}
