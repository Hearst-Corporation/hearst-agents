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

import { CockpitXClient } from "./cockpit-x/CockpitXClient";
import { loadInitialCockpitData } from "./lib/cockpit-entry";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialCockpitData = await loadInitialCockpitData("RSC Home");
  // fallback géré dans CockpitXClient : si `initialCockpitData === null`, le
  // client déclenche un refetch via useEffect (cf. CockpitXClient.tsx ~L122).
  return <CockpitXClient initialCockpitData={initialCockpitData ?? null} />;
}
