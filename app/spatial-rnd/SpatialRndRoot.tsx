"use client";

/**
 * /spatial-rnd — Cockpit 3D R&D
 *
 * Reprend la base /spatial qui marche (Spline central + providers) et ajoute
 * une couche cockpit avec panels HTML qui flottent en CSS 3D à différentes
 * profondeurs Z, avec sélection / hover / pin et halos.
 *
 * Pattern : pas de R3F custom, pas de boxGeometry. Juste CSS 3D + Framer
 * Motion + Spline pour l'ambiance 3D centrale.
 *
 * À ne pas confondre avec /spatial-safe (sauvegarde figée de la production).
 */

import { useSplineApp } from "@/hooks/spatial/useSplineApp";
import { useSplineIdleAmbient } from "@/hooks/spatial/useSplineIdleAmbient";
import { SpatialScene } from "@/components/spatial/core/SpatialScene";
import { SpatialLogoCore } from "@/components/spatial/core/SpatialLogoCore";
import { CommandBar } from "@/components/spatial/overlays/CommandBar";
import { CockpitPanelsLayer } from "@/components/spatial/rnd/CockpitPanelsLayer";

export function SpatialRndRoot() {
  const spline = useSplineApp();
  useSplineIdleAmbient(spline);

  return (
    <>
      {/* Scène 3D centrale Spline */}
      <SpatialScene>
        <SpatialLogoCore onLoad={spline.onLoad} />
      </SpatialScene>

      {/* Couche cockpit : 4 panels HTML en profondeur Z */}
      <CockpitPanelsLayer />

      {/* Chat bar en bas */}
      <CommandBar show={true} />

      {/* Pill HUD top-center pour signaler qu'on est en R&D */}
      <div
        className="pointer-events-none absolute inset-x-0 top-6 flex justify-center"
        style={{ zIndex: 50 }}
      >
        <div
          className="pointer-events-auto rounded-full px-4 py-1.5 text-spatial-xs uppercase tracking-[0.2em] text-white/45"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px) saturate(130%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Spatial · R&D · cockpit 3D
        </div>
      </div>
    </>
  );
}
