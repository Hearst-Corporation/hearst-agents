'use client';

/**
 * SpatialRoot — composant racine client qui :
 *  1. Instancie le hook `useSplineApp` (capture l'Application Spline au load)
 *  2. Branche les 3 bridges runtime (voice level, state, tool calls)
 *  3. Rend la scène + l'overlay manager
 *
 * Vit sous SpatialLayout (providers) et au-dessus de la scène + overlays.
 * C'est lui qui fait remonter `onLoad` à <SpatialLogoCore /> et redistribue
 * la même instance Spline aux hooks de bridge.
 */

import { useSplineApp } from '@/hooks/spatial/useSplineApp';
import { useSplineVoiceBridge } from '@/hooks/spatial/useSplineVoiceBridge';
import { useSplineStateBridge } from '@/hooks/spatial/useSplineStateBridge';
import { useSplineToolBridge } from '@/hooks/spatial/useSplineToolBridge';
import { SpatialScene } from './SpatialScene';
import { SpatialLogoCore } from './SpatialLogoCore';
import { SpatialOverlayManager } from '../overlays/SpatialOverlayManager';
import type { CockpitTodayPayload } from '@/lib/cockpit/today';

export interface SpatialRootProps {
  /** Payload Cockpit pre-fetché côté serveur (pour le KPI bento P2-1).
   *  Optionnel : fallback à un état vide silencieux si null. */
  initialCockpitData?: CockpitTodayPayload | null;
}

export function SpatialRoot({ initialCockpitData }: SpatialRootProps) {
  const spline = useSplineApp();

  // Bridges runtime — chacun est un useEffect interne, ne provoque pas de
  // re-render de SpatialRoot quand un event arrive.
  useSplineVoiceBridge(spline);
  useSplineStateBridge(spline);
  useSplineToolBridge(spline);

  return (
    <>
      <SpatialScene>
        <SpatialLogoCore onLoad={spline.onLoad} />
      </SpatialScene>
      <SpatialOverlayManager initialCockpitData={initialCockpitData ?? null} />
    </>
  );
}
