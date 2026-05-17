/**
 * /copilote — ouvre le cockpit sur le Stage Chat (copilote IA).
 *
 * Le cockpit Hearst est mono-route : tous les Stages vivent à `/`. Cette
 * route est un raccourci d'entrée — elle prefetch les données et passe
 * `initialMode="chat"` à CockpitXClient qui bascule le store au mount.
 */

import { CockpitXClient } from "../cockpit-x/CockpitXClient";
import { loadInitialCockpitData } from "../lib/cockpit-entry";

export const dynamic = "force-dynamic";

export default async function CopilotePage() {
  const initialCockpitData = await loadInitialCockpitData("RSC /copilote");
  return <CockpitXClient initialCockpitData={initialCockpitData} initialMode="chat" />;
}
