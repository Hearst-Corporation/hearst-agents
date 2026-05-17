import { type CockpitTodayPayload, getCockpitToday } from "@/lib/cockpit/today";
import { requireScope } from "@/lib/platform/auth/scope";
import { CockpitXClient } from "../../cockpit-x/CockpitXClient";

export const dynamic = "force-dynamic";

async function loadInitialCockpitData(): Promise<CockpitTodayPayload | null> {
  const { scope, error } = await requireScope({
    context: "RSC app/(user)/missions/builder/page.tsx",
  });
  if (error || !scope) return null;
  try {
    return await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
  } catch {
    return null;
  }
}

export default async function MissionsBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const openNewMission = params.new === "1";
  const initialCockpitData = await loadInitialCockpitData();
  return (
    <CockpitXClient
      initialCockpitData={initialCockpitData}
      initialMode="mission"
      openNewMission={openNewMission}
    />
  );
}
