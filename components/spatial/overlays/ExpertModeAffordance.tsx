"use client";

import { motion } from "framer-motion";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface ExpertModeAffordanceProps {
  /** Pour brancher plus tard — pour l'instant, no-op */
  onClick?: () => void;
  /** Désactive (par défaut: true tant que la feature n'existe pas) */
  disabled?: boolean;
}

/**
 * Bouton fantôme bas-droite — annonce un futur "Mode expert".
 * Pas implémenté, juste discret. Visible mais clairement secondaire.
 */
export function ExpertModeAffordance({ onClick, disabled = true }: ExpertModeAffordanceProps) {
  return (
    <motion.button
      type="button"
      onClick={disabled ? undefined : onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 1.6, delay: 0.6 } }}
      whileHover={disabled ? undefined : { opacity: 1 }}
      className="absolute bottom-6 right-8 group flex items-center gap-2 pointer-events-auto select-none"
      style={{
        zIndex: SPATIAL_Z_LAYERS.hud,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      aria-label="Mode expert (à venir)"
      aria-disabled={disabled}
    >
      <div
        className="w-1 h-1 rounded-full bg-white/35 group-hover:bg-white/60 transition-colors duration-500"
      />
      <span
        className="text-white/30 group-hover:text-white/55 text-spatial-sm tracking-[0.34em] uppercase font-light transition-colors duration-500"
      >
        Mode expert
      </span>
    </motion.button>
  );
}
