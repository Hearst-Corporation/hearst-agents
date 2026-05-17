// builder = entrypoint CockpitXClient openNewMission
// La page ne contient pas de wizard propre : elle ouvre le panneau de création
// de mission de CockpitXClient via `openNewMission`. Le flow d'abandon est géré
// dans le panneau (cockpit-x), pas ici.
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
