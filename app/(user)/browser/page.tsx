/**
 * /browser — ouvre le cockpit sur le Stage Browser.
 *
 * Particularité : le payload browser exige un `sessionId`. Sans session
 * active, CockpitXternalise un sessionId vide → BrowserStage rend son
 * état idle (pas de crash) et l'utilisateur démarre une session via l'UI.
 */

import { CockpitXClient } from "../cockpit-x/CockpitXClient";
import { loadInitialCockpitData } from "../lib/cockpit-entry";

export const dynamic = "force-dynamic";

export default async function BrowserPage() {
  const initialCockpitData = await loadInitialCockpitData("RSC /browser");
  return <CockpitXClient initialCockpitData={initialCockpitData} initialMode="browser" />;
}
