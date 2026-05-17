/**
 * /run — ouvre le cockpit sur le Stage Mission (exécutions / runs).
 *
 * Raccourci d'entrée vers le cockpit mono-route. `initialMode="mission"`
 * bascule le store ; sans missionId, MissionStage affiche la dernière
 * mission ouverte ou l'état liste.
 */

import { CockpitXClient } from "../cockpit-x/CockpitXClient";
import { loadInitialCockpitData } from "../lib/cockpit-entry";

export const dynamic = "force-dynamic";

export default async function RunPage() {
  const initialCockpitData = await loadInitialCockpitData("RSC /run");
  return <CockpitXClient initialCockpitData={initialCockpitData} initialMode="mission" />;
}
