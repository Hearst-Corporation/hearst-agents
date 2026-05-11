"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface OrbAffordanceProps {
  show: boolean;
  hovered: boolean;
  label?: string;
}

/**
 * Label discret sous le noyau — uniquement en idle.
 * Renforce visuellement quand le curseur est sur la zone du noyau.
 */
export function OrbAffordance({
  show,
  hovered,
  label = "Cliquer pour orchestrer",
}: OrbAffordanceProps) {
  return (
    <div
      className="absolute inset-x-0 top-[60%] flex items-center justify-center pointer-events-none"
      style={{ zIndex: SPATIAL_Z_LAYERS.ground }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: hovered ? 0.85 : 0.45,
              y: 0,
              transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.4 } }}
            className="text-white text-spatial-xs tracking-[0.3em] uppercase font-light select-none"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
