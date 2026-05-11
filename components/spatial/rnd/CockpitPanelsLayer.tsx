"use client";

import { useEffect } from "react";
import { useSpatialSelectionStore } from "@/stores/spatial-selection";
import { CockpitPanel3D } from "./CockpitPanel3D";
import { CockpitBriefCard } from "./cards/CockpitBriefCard";
import { CockpitKPICard } from "./cards/CockpitKPICard";
import { CockpitMissionCard } from "./cards/CockpitMissionCard";
import { CockpitAssetsCard } from "./cards/CockpitAssetsCard";

/**
 * Couche des panels 3D du cockpit /spatial-rnd.
 *
 * Layout cohérent avec /spatial qui marche : grille bento contenue
 * dans la moitié gauche de l'écran. La moitié droite reste pour le
 * robot Spline.
 *
 * Grille : 4 colonnes × 3 rangées dans w=52vw / h=80vh.
 * - Brief    : col 1-2, row 1-2 (large, vedette)
 * - KPI      : col 3-4, row 1-1 (bandeau top)
 * - Mission  : col 3-4, row 2-2 (bandeau mi)
 * - Assets   : col 1-4, row 3-3 (bandeau bottom)
 *
 * Z-axis par profondeur cinéma (le focal point est devant) :
 * - Brief    : Z=0   (avant-plan, le sujet principal)
 * - KPI      : Z=-20 (mi-plan)
 * - Mission  : Z=-40 (mi-plan profond)
 * - Assets   : Z=-80 (arrière-plan)
 *
 * Hotkeys :
 *   Esc → unselectAll
 *   P   → togglePin sur l'objet courant
 */
export function CockpitPanelsLayer() {
  const unselectAll = useSpatialSelectionStore((s) => s.unselectAll);
  const selectedId = useSpatialSelectionStore((s) => s.selectedId);
  const togglePin = useSpatialSelectionStore((s) => s.togglePin);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "Escape") {
        unselectAll();
      } else if (e.key.toLowerCase() === "p" && selectedId) {
        togglePin(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, togglePin, unselectAll]);

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start p-6 md:p-10"
      style={{ zIndex: 30 }}
      onClick={() => unselectAll()}
    >
      <div
        className="grid h-[min(640px,80vh)] w-[min(720px,52vw)] grid-cols-4 grid-rows-3 gap-4"
        style={{ perspective: "1400px" }}
      >
        {/* Brief — vedette, large, col 1-2, row 1-2 */}
        <div className="col-span-2 row-span-2">
          <CockpitPanel3D entityId="brief" depthZ={0}>
            <CockpitBriefCard />
          </CockpitPanel3D>
        </div>

        {/* KPI — bandeau top droit, col 3-4, row 1 */}
        <div className="col-span-2 row-span-1">
          <CockpitPanel3D entityId="kpi" depthZ={-20}>
            <CockpitKPICard />
          </CockpitPanel3D>
        </div>

        {/* Mission — bandeau mi droit, col 3-4, row 2 */}
        <div className="col-span-2 row-span-1">
          <CockpitPanel3D entityId="mission" depthZ={-40}>
            <CockpitMissionCard />
          </CockpitPanel3D>
        </div>

        {/* Assets — bandeau bottom plein, col 1-4, row 3 */}
        <div className="col-span-4 row-span-1">
          <CockpitPanel3D entityId="assets" depthZ={-80}>
            <CockpitAssetsCard />
          </CockpitPanel3D>
        </div>
      </div>
    </div>
  );
}
