"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EMERGE } from "@/components/spatial/motion/variants";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface OverlayEntry {
  id: string;
  content: ReactNode;
  fullscreen?: boolean;
}

interface SpatialOverlayContextValue {
  push: (entry: OverlayEntry) => void;
  pop: (id: string) => void;
  clear: () => void;
}

const SpatialOverlayContext = createContext<SpatialOverlayContextValue | null>(null);

/**
 * Gestionnaire d'overlays spatiaux — stack HTML au-dessus de la scène 3D.
 * Utilisé pour les modals, confirmations, états de chargement plein écran.
 */
export function SpatialOverlayManager({ children }: { children: ReactNode }) {
  const [overlays, setOverlays] = useState<OverlayEntry[]>([]);

  const push = useCallback((entry: OverlayEntry) => {
    setOverlays((prev) => [...prev.filter((o) => o.id !== entry.id), entry]);
  }, []);

  const pop = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const clear = useCallback(() => setOverlays([]), []);

  return (
    <SpatialOverlayContext.Provider value={{ push, pop, clear }}>
      {children}

      {/* Overlay stack */}
      <AnimatePresence>
        {overlays.map((overlay) => (
          <motion.div
            key={overlay.id}
            variants={EMERGE}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`absolute inset-0 pointer-events-auto ${overlay.fullscreen ? "flex items-center justify-center" : ""}`}
            style={{ zIndex: SPATIAL_Z_LAYERS.overlay }}
          >
            {overlay.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </SpatialOverlayContext.Provider>
  );
}

export function useSpatialOverlay() {
  const ctx = useContext(SpatialOverlayContext);
  if (!ctx) throw new Error("useSpatialOverlay must be used within SpatialOverlayManager");
  return ctx;
}
