"use client";

import { motion, AnimatePresence, useTransform, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";
import { PANEL_EMERGE } from "@/components/spatial/motion/variants";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface FloatingPanelProps {
  show: boolean;
  children: ReactNode;
  /** MotionValues pour le parallax souris */
  mouseX?: MotionValue<number>;
  mouseY?: MotionValue<number>;
  /** Amplitude max de rotation en degrés */
  rotationAmplitude?: number;
  className?: string;
  onClose?: () => void;
}

/**
 * Panel HTML flottant avec parallax souris et glass material CSS.
 * Aucune logique métier — reçoit children arbitraires.
 */
export function FloatingPanel({
  show,
  children,
  mouseX,
  mouseY,
  rotationAmplitude = 3,
  className,
  onClose,
}: FloatingPanelProps) {
  const rotateX = useTransform(mouseY ?? { get: () => 0 } as MotionValue<number>, [-1, 1], [rotationAmplitude, -rotationAmplitude]);
  const rotateY = useTransform(mouseX ?? { get: () => 0 } as MotionValue<number>, [-1, 1], [-rotationAmplitude, rotationAmplitude]);

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{ perspective: "1200px", zIndex: SPATIAL_Z_LAYERS.surface }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            variants={PANEL_EMERGE}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              rotateX: mouseX ? rotateX : 0,
              rotateY: mouseX ? rotateY : 0,
              background: "var(--sp-surface, rgba(255,255,255,0.04))",
              borderColor: "var(--sp-border, rgba(255,255,255,0.10))",
            }}
            className={`pointer-events-auto relative max-w-[90vw] backdrop-blur-3xl border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] ${className ?? ""}`}
          >
            {/* Glass reflection */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors z-10"
                aria-label="Fermer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
