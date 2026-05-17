/**
 * /runs — alias de /run (Stage Mission). Certains liens / habitudes
 * pointent vers le pluriel ; on évite un 404 en réutilisant la même
 * entrée cockpit.
 */

import { CockpitXClient } from "../cockpit-x/CockpitXClient";
import { loadInitialCockpitData } from "../lib/cockpit-entry";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const initialCockpitData = await loadInitialCockpitData("RSC /runs");
  return <CockpitXClient initialCockpitData={initialCockpitData} initialMode="mission" />;
}
