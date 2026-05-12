"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useSpatialPanelsStore, hasInterruptive } from "@/stores/spatial-panels";
import { SPATIAL_PANEL_CONFIG } from "@/lib/spatial/panel-types";
import {
  getOrbitPosition,
  getInterruptivePosition,
} from "@/lib/spatial/panel-orbit";
import { SPATIAL_PANEL_REGISTRY } from "@/lib/spatial/panel-registry";
import { SpatialPanel } from "./SpatialPanel";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface SpatialPanelHostProps {
  /** Données prefetch RSC pour les cards qui en ont besoin (KPI surtout). */
  initialCockpitData?: CockpitTodayPayload | null;
}

/**
 * Orchestrateur de tous les panels du cockpit spatial.
 *
 * Pattern :
 * 1. Lit la liste des panels actifs depuis useSpatialPanelsStore.
 * 2. Calcule la position orbitale de chacun (ou centrée si interruptif).
 * 3. Monte chaque panel via SpatialPanel + AnimatePresence (mode popLayout
 *    pour que les transitions in/out se croisent dans la profondeur Z).
 * 4. Applique un dim global si au moins un panel interruptif est ouvert.
 *
 * Gestion clavier (au niveau global, pas par panel) :
 * - Esc : défocalise (sans fermer)
 * - Click vide : défocalise
 */
export function SpatialPanelHost({
  initialCockpitData = null,
}: SpatialPanelHostProps) {
  const panels = useSpatialPanelsStore((s) => s.panels);
  const focusedId = useSpatialPanelsStore((s) => s.focusedId);
  const defocus = useSpatialPanelsStore((s) => s.defocus);

  // Hotkey Esc → défocaliser
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") {
        defocus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [defocus]);

  const interruptiveOpen = hasInterruptive(panels);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 30, perspective: "1400px" }}
      onClick={() => defocus()}
    >
      <div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Dim global quand un panel interruptif est ouvert */}
        <AnimatePresence>
          {interruptiveOpen && (
            <motion.div
              key="interruptive-dim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 36% 40%, rgba(0,0,0,0) 20%, rgba(0,0,0,0.45) 70%)",
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {panels.map((panel) => {
            const config = SPATIAL_PANEL_CONFIG[panel.type];
            const Card = SPATIAL_PANEL_REGISTRY[panel.type];
            if (!Card) return null;

            const isInterruptive = config.category === "interruptive";
            const position = isInterruptive
              ? getInterruptivePosition()
              : getOrbitPosition(panel.orbitIndex, panels.length);

            const isFocused = focusedId === panel.id;
            const isDefocused =
              focusedId !== null && focusedId !== panel.id && !isInterruptive;
            const isInterruptiveDim = interruptiveOpen && !isInterruptive;

            return (
              <SpatialPanel
                key={panel.id}
                instanceId={panel.id}
                type={panel.type}
                orbitIndex={panel.orbitIndex}
                position={position}
                isFocused={isFocused}
                isDefocused={isDefocused}
                isInterruptiveDim={isInterruptiveDim}
              >
                <Card
                  payload={panel.payload}
                  initialCockpitData={initialCockpitData}
                />
              </SpatialPanel>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
