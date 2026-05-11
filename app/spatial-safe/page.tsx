/**
 * /spatial — RSC entrypoint pour le mode cinéma.
 *
 * Pre-fetch (best-effort) le payload Cockpit côté serveur et le passe à
 * <SpatialRoot /> pour alimenter le KPI bento P2-1. Si le scope auth n'est
 * pas dispo (dev sans session), on rend `null` et l'overlay degrade
 * silencieusement.
 *
 * Hors-DS, hors-ADD : tout vit sous `components/spatial/*`.
 */

import { SpatialLayout } from '@/components/spatial-safe/core/SpatialLayout';
import { SpatialRoot } from '@/components/spatial-safe/core/SpatialRoot';
import { requireScope } from '@/lib/platform/auth/scope';
import { getCockpitToday, type CockpitTodayPayload } from '@/lib/cockpit/today';
import '@/styles/spatial-safe/spatial.css';

export const dynamic = 'force-dynamic';

async function loadInitialCockpitData(): Promise<CockpitTodayPayload | null> {
  const { scope, error } = await requireScope({ context: 'RSC app/spatial/page.tsx' });
  if (error || !scope) return null;
  try {
    return await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
  } catch (err) {
    console.error('[RSC SpatialPage] getCockpitToday failed:', err);
    return null;
  }
}

export default async function SpatialPage() {
  const initialCockpitData = await loadInitialCockpitData();
  return (
    <SpatialLayout>
      <SpatialRoot initialCockpitData={initialCockpitData} />
    </SpatialLayout>
  );
}
