/**
 * Home — Server Component (shell visionOS).
 *
 * Prefetch le payload Cockpit côté serveur et passe `initialCockpitData`
 * à `<CockpitXClient />`. Pattern identique à l'ancienne app/(user)/page.tsx
 * (invariant I-7 cockpit v1.5 : RSC prefetch + client refetch obligatoires).
 *
 * Auth fail-soft : si `requireScope` échoue, `initialCockpitData = null`
 * et CockpitXClient retombe sur son fetch useEffect.
 */

import { type CockpitTodayPayload, getCockpitToday } from "@/lib/cockpit/today";
import { requireScope } from "@/lib/platform/auth/scope";
import { CockpitXClient } from "./cockpit-x/CockpitXClient";

export const dynamic = "force-dynamic";

async function loadInitialCockpitData(): Promise<CockpitTodayPayload | null> {
  const { scope, error } = await requireScope({ context: "RSC app/(user-x)/page.tsx" });
  if (error || !scope) return null;
  try {
    return await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
  } catch (err) {
    console.error("[RSC Home] getCockpitToday failed, falling back to client fetch:", err);
    return null;
  }
}

export default async function HomePage() {
  const initialCockpitData = await loadInitialCockpitData();
  return <CockpitXClient initialCockpitData={initialCockpitData} />;
}
