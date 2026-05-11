"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { EMERGE } from "./variants";

interface SpatialTransitionProps {
  show: boolean;
  children: ReactNode;
  variants?: Variants;
  className?: string;
}

/**
 * Wrapper AnimatePresence générique pour les éléments spatiaux.
 * Par défaut utilise le preset EMERGE.
 */
export function SpatialTransition({
  show,
  children,
  variants = EMERGE,
  className,
}: SpatialTransitionProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
