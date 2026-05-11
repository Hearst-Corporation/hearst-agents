"use client";

import { useEffect, useState } from "react";
import { SpatialSceneR3F } from "@/components/spatial/core/SpatialSceneR3F";
import { SpatialDevHUD } from "@/components/spatial/dev/SpatialDevHUD";
import { SpatialLevaPanel } from "@/components/spatial/dev/SpatialLevaPanel";
import { SpatialChatPill } from "@/components/spatial/panels-3d/SpatialChatPill";
import { useSpatialSceneStore } from "@/stores/spatial-scene";
import { useSpatialSelection } from "@/stores/spatial-selection";

export function SpatialRndRoot() {
  const [devMode, setDevMode] = useState(false);
  const reset = useSpatialSceneStore((state) => state.reset);
  const { selected, unselectAll, togglePin } = useSpatialSelection();

  useEffect(() => {
    const saved = localStorage.getItem("spatial-rnd-dev-mode");
    if (saved === "true") setDevMode(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on D, ensure not in input
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (isInput) return;

      if (e.key === "d" || e.key === "D") {
        setDevMode((prev) => {
          const next = !prev;
          localStorage.setItem("spatial-rnd-dev-mode", String(next));
          if (!next) {
            reset();
          }
          return next;
        });
      }

      // Hotkeys couche 2
      if (e.key === "Escape") {
        unselectAll();
      }

      if ((e.key === "p" || e.key === "P") && selected.length > 0) {
        togglePin(selected[0]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reset, unselectAll, togglePin, selected]);

  return (
    <>
      <SpatialSceneR3F devMode={devMode} />
      
      <SpatialChatPill />
      
      {!devMode && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-2 flex items-center gap-3 pointer-events-none">
          <span className="text-spatial-base font-medium text-white">Spatial · R&D</span>
          <span className="text-spatial-xs text-white/60">[D] mode dev</span>
        </div>
      )}

      {devMode && (
        <>
          <SpatialDevHUD />
          <SpatialLevaPanel />
        </>
      )}
    </>
  );
}
