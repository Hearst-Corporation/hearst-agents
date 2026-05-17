// builder = entrypoint CockpitXClient openNewMission
// La page ne contient pas de wizard propre : elle ouvre le panneau de création
// de mission de CockpitXClient via `openNewMission`. Le flow d'abandon est géré
// dans le panneau (cockpit-x), pas ici.
import { CockpitXClient } from "../../cockpit-x/CockpitXClient";
import { loadInitialCockpitData } from "../../lib/cockpit-entry";

export const dynamic = "force-dynamic";

export default async function MissionsBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const openNewMission = params.new === "1";
  const initialCockpitData = await loadInitialCockpitData("RSC missions/builder");
  return (
    <CockpitXClient
      initialCockpitData={initialCockpitData}
      initialMode="mission"
      openNewMission={openNewMission}
    />
  );
}
