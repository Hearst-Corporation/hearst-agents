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
import { useSpatialPanelsAgentSync } from "@/hooks/spatial/useSpatialPanelsAgentSync";
import { useRuntimeStore } from "@/stores/runtime";
import { useSpatialPanelsStore } from "@/stores/spatial-panels";
import { SpatialScene } from "@/components/spatial/core/SpatialScene";
import { SpatialLogoCore } from "@/components/spatial/core/SpatialLogoCore";
import { CommandBar } from "@/components/spatial/overlays/CommandBar";
import { CockpitPanelsLayer } from "@/components/spatial/rnd/CockpitPanelsLayer";
import { SpatialPanelDock } from "@/components/spatial/rnd/SpatialPanelDock";
import { SpatialRobotPresence } from "@/components/spatial/rnd/SpatialRobotPresence";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

import { SPATIAL_RND_MESSAGES, SPATIAL_RND_STATES } from "@/lib/i18n/fr";

interface SpatialRndRootProps {
  initialCockpitData?: CockpitTodayPayload | null;
}

export function SpatialRndRoot({ initialCockpitData = null }: SpatialRndRootProps) {
  const spline = useSplineApp();
  const coreState = useRuntimeStore((s) => s.coreState);
  const surfaceOpen = useSpatialPanelsStore((s) =>
    s.panels.some((panel) =>
      ["brief", "mission", "assets", "chat-response", "asset-preview"].includes(panel.type),
    ),
  );
  const isAgentActive =
    coreState === SPATIAL_RND_STATES.STREAMING ||
    coreState === SPATIAL_RND_STATES.PROCESSING;
  const presenceMode =
    coreState === SPATIAL_RND_STATES.AWAITING_APPROVAL
      ? "approval"
      : isAgentActive
        ? "active"
        : surfaceOpen
          ? "surface"
        : "idle";
  useSplineIdleAmbient(spline);
  // Branche les stores existants (runtime / focal / navigation) au store de panels.
  useSpatialPanelsAgentSync();

  return (
    <>
      {/* Scène 3D centrale Spline */}
      <SpatialScene>
        <SpatialLogoCore onLoad={spline.onLoad} />
      </SpatialScene>

      <SpatialRobotPresence mode={presenceMode} surfaceOpen={surfaceOpen} />

      {/* Couche cockpit : panels contextuels en profondeur Z */}
      <CockpitPanelsLayer
        initialCockpitData={initialCockpitData}
      />

      {/* Chat bar en bas */}
      <CommandBar show={true} />

      {/* Navigation manuelle minimale */}
      <SpatialPanelDock />

      {/* État vivant minimal du robot */}
      <div
        className="pointer-events-none absolute inset-x-0 top-7 flex justify-center"
        style={{ zIndex: 50 }}
      >
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-spatial-sm font-light tracking-wide text-white/52"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px) saturate(130%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background:
                coreState === SPATIAL_RND_STATES.STREAMING || coreState === SPATIAL_RND_STATES.PROCESSING
                  ? "rgba(0,229,204,0.9)"
                  : coreState === SPATIAL_RND_STATES.AWAITING_APPROVAL
                    ? "rgba(232,176,120,0.95)"
                    : "rgba(255,255,255,0.55)",
              boxShadow:
                coreState === SPATIAL_RND_STATES.IDLE
                  ? "0 0 8px rgba(255,255,255,0.22)"
                  : "0 0 14px currentColor",
            }}
          />
          {coreState === SPATIAL_RND_STATES.STREAMING || coreState === SPATIAL_RND_STATES.PROCESSING
            ? SPATIAL_RND_MESSAGES.HEARST_THINKING
            : coreState === SPATIAL_RND_STATES.AWAITING_APPROVAL
              ? SPATIAL_RND_MESSAGES.APPROVAL_PENDING
              : SPATIAL_RND_MESSAGES.HEARST_READY}
        </div>
      </div>
    </>
  );
}
