"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface MissionStatusProps {
  show: boolean;
  /** Texte de l'état de mission */
  label?: string;
}

/**
 * Bandeau de statut de mission — un seul focus dominant pendant l'orchestration.
 * Centré au-dessus du noyau, pulse lent.
 */
export function MissionStatus({
  show,
  label = "Mission en cours",
}: MissionStatusProps) {
  return (
    <div
      className="absolute inset-x-0 top-[28%] flex items-center justify-center pointer-events-none"
      style={{ zIndex: SPATIAL_Z_LAYERS.surface }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            animate={{
              opacity: 1, y: 0, filter: "blur(0px)",
              transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 },
            }}
            exit={{
              opacity: 0, y: -4, filter: "blur(6px)",
              transition: { duration: 0.5, ease: [0.4, 0, 1, 1] },
            }}
            className="flex items-center gap-3"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-1 rounded-full bg-white/85"
              style={{ boxShadow: "0 0 8px rgba(255,255,255,0.55)" }}
            />
            <div className="text-white/60 text-[10px] tracking-[0.3em] uppercase font-light">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
