/**
 * /spatial-rnd — Cockpit 3D R&D
 *
 * Pre-fetch RSC du payload Cockpit (best-effort, fail-soft) puis passe au
 * client. Pattern identique à /spatial.
 */

import { SpatialLayout } from "@/components/spatial/core/SpatialLayout";
import { SpatialRndRoot } from "./SpatialRndRoot";
import { requireScope } from "@/lib/platform/auth/scope";
import { getCockpitToday, type CockpitTodayPayload } from "@/lib/cockpit/today";
import "@/styles/spatial/spatial.css";

export const dynamic = "force-dynamic";

async function loadInitialCockpitData(): Promise<CockpitTodayPayload | null> {
  const { scope, error } = await requireScope({ context: "RSC app/spatial-rnd/page.tsx" });
  if (error || !scope) return null;
  try {
    return await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
  } catch (err) {
    console.error("[RSC SpatialRndPage] getCockpitToday failed:", err);
    return null;
  }
}

export default async function SpatialRndPage() {
  const initialCockpitData = await loadInitialCockpitData();
  return (
    <SpatialLayout>
      <SpatialRndRoot initialCockpitData={initialCockpitData} />
    </SpatialLayout>
  );
}