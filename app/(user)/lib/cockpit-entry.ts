/**
 * cockpit-entry — helper RSC partagé pour les routes qui ouvrent le cockpit
 * sur un Stage présélectionné (/copilote, /run, /browser…).
 *
 * Factorise le prefetch `getCockpitToday` (invariant I-7 : RSC prefetch +
 * client refetch). Auth fail-soft : si `requireScope` échoue, retourne
 * `null` et CockpitXClient retombe sur son fetch useEffect.
 */

import { type CockpitTodayPayload, getCockpitToday } from "@/lib/cockpit/today";
import { requireScope } from "@/lib/platform/auth/scope";

export async function loadInitialCockpitData(context: string): Promise<CockpitTodayPayload | null> {
  const { scope, error } = await requireScope({ context });
  if (error || !scope) return null;
  try {
    return await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
  } catch (err) {
    console.error(`[${context}] getCockpitToday failed, client refetch fallback:`, err);
    return null;
  }
}
