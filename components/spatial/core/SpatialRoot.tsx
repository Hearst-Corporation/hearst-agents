"use client";

/**
 * SpatialRoot — composant racine client qui :
 *  1. Instancie le hook `useSplineApp` (capture l'Application Spline au load)
 *  2. Branche les bridges runtime (voice level, state, tool calls, idle ambient)
 *  3. Rend la scène + l'overlay manager + les satellites (KPI, notif, voice, breadcrumb)
 *  4. Monte VoicePulse (singleton via guards module-level dans VoicePulse.tsx)
 *
 * Vit sous SpatialLayout (providers) et au-dessus de la scène + overlays.
 */

import dynamic from "next/dynamic";
import { useSplineApp } from "@/hooks/spatial/useSplineApp";
import { useSplineIdleAmbient } from "@/hooks/spatial/useSplineIdleAmbient";
import { useSplineStateBridge } from "@/hooks/spatial/useSplineStateBridge";
import { useSplineToolBridge } from "@/hooks/spatial/useSplineToolBridge";
import { useSplineVoiceBridge } from "@/hooks/spatial/useSplineVoiceBridge";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";
import { NotificationBellSpatial } from "../overlays/NotificationBellSpatial";
import { SpatialOverlayManager } from "../overlays/SpatialOverlayManager";
import { StageBreadcrumb } from "../overlays/StageBreadcrumb";
import { VoicePill } from "../overlays/VoicePill";
import { KPIBento } from "../panels/KPIBento";
import { SpatialLogoCore } from "./SpatialLogoCore";
import { SpatialScene } from "./SpatialScene";

// VoicePulse vit dans app/(user) — on l'importe en dynamic ssr:false pour
// éviter de rendre un composant dépendant de WebRTC pendant SSR.
const VoicePulse = dynamic(
  () => import("@/app/(user-legacy)/components/voice/VoicePulse").then((m) => m.VoicePulse),
  { ssr: false },
);

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
  useSplineIdleAmbient(spline);

  return (
    <>
      <SpatialScene>
        <SpatialLogoCore onLoad={spline.onLoad} />
      </SpatialScene>

      {/* P2-1 : KPI hero bento — placé en haut center via overlay dédié pour
          ne pas perturber la grille bento gauche (qui est déjà 4×3 saturée). */}
      <div
        className="pointer-events-none absolute inset-x-0 top-6 md:top-10 flex justify-center"
        style={{ zIndex: SPATIAL_Z_LAYERS.surface }}
      >
        <div className="pointer-events-auto w-[min(720px,52vw)]">
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "1fr",
              perspective: "1200px",
            }}
          >
            <KPIBento data={initialCockpitData ?? null} />
          </div>
        </div>
      </div>

      <SpatialOverlayManager initialCockpitData={initialCockpitData ?? null} />

      {/* Satellites P2 */}
      <NotificationBellSpatial />
      <VoicePill />
      <StageBreadcrumb />

      {/* P2-3 : pipeline WebRTC. Singleton via guards module-level dans
          VoicePulse.tsx — safe à monter ici en parallèle de la home `/`. */}
      <VoicePulse />
    </>
  );
}
