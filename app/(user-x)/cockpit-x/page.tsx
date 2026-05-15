/**
 * CockpitX (page de test P4) — Server Component qui prefetch le cockpit
 * payload et passe `initialCockpitData` à `<CockpitXClient />`.
 *
 * Pattern identique à [app/(user)/page.tsx](../../(user)/page.tsx) — c'est
 * une exigence du verrou cockpit v1.5 I-7 : "RSC prefetch + client refetch
 * obligatoires (KPIs à jour, ne pas s'appuyer uniquement sur SSR snapshot)".
 *
 * Auth fail-soft (idem layout actuel) : si `requireScope` échoue, on rend
 * `initialCockpitData = null` et `<CockpitStage>` retombe sur son fetch
 * useEffect.
 */

import { type CockpitTodayPayload, getCockpitToday } from "@/lib/cockpit/today";
import { requireScope } from "@/lib/platform/auth/scope";
import { CockpitXClient } from "./CockpitXClient";

export const dynamic = "force-dynamic";

async function loadInitialCockpitData(): Promise<CockpitTodayPayload | null> {
  const { scope, error } = await requireScope({ context: "RSC app/(user-x)/cockpit-x/page.tsx" });
  if (error || !scope) return null;
  try {
    return await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
  } catch (err) {
    console.error("[RSC CockpitX] getCockpitToday failed, falling back to client fetch:", err);
    return null;
  }
}

export default async function CockpitXPage() {
  const initialCockpitData = await loadInitialCockpitData();
  return <CockpitXClient initialCockpitData={initialCockpitData} />;
}
