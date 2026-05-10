"use client";

import { motion, AnimatePresence, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";

type Anchor =
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center"
  | "center";

interface FloatingPanelProps {
  show: boolean;
  children: ReactNode;
  anchor?: Anchor;
  delay?: number;
  width?: number | string;
  noParallax?: boolean;
  rotationAmplitude?: number;
  className?: string;
}

const ANCHOR_CLASSES: Record<Anchor, string> = {
  "left":          "left-12 top-1/2 -translate-y-1/2",
  "right":         "right-12 top-1/2 -translate-y-1/2",
  "top-left":      "left-12 top-12",
  "top-right":     "right-12 top-12",
  "bottom-left":   "left-12 bottom-16",
  "bottom-right":  "right-12 bottom-16",
  "bottom-center": "left-1/2 -translate-x-1/2 bottom-16",
  "center":        "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
};

/**
 * Origine d'émergence — chaque panel part visuellement de l'orbe (centre écran)
 * et glisse vers son ancrage. Sensation magnétique : attiré par le noyau.
 */
const ANCHOR_EMERGENCE: Record<Anchor, { x: number; y: number }> = {
  "left":          { x: 180, y: 0 },
  "right":         { x: -180, y: 0 },
  "top-left":      { x: 120, y: 80 },
  "top-right":     { x: -120, y: 80 },
  "bottom-left":   { x: 120, y: -80 },
  "bottom-right":  { x: -120, y: -80 },
  "bottom-center": { x: 0, y: -120 },
  "center":        { x: 0, y: 0 },
};

export function FloatingPanel({
  show,
  children,
  anchor = "center",
  delay = 0,
  width,
  noParallax = false,
  rotationAmplitude = 1.4,
  className,
}: FloatingPanelProps) {
  const { smoothX, smoothY } = useSpatialMouseContext();
  const rotateX = useTransform(smoothY, [-1, 1], [rotationAmplitude, -rotationAmplitude]);
  const rotateY = useTransform(smoothX, [-1, 1], [-rotationAmplitude, rotationAmplitude]);

  const emergence = ANCHOR_EMERGENCE[anchor];

  return (
    <AnimatePresence>
      {show && (
        <div
          className={`absolute pointer-events-none ${ANCHOR_CLASSES[anchor]}`}
          style={{ perspective: 1400, zIndex: SPATIAL_Z_LAYERS.surface }}
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.88,
              x: emergence.x,
              y: emergence.y,
              filter: "blur(18px)",
            }}
            animate={{
              opacity: 1,
              scale: 1,
              x: 0,
              y: 0,
              filter: "blur(0px)",
              transition: {
                duration: 1.6,
                ease: [0.16, 1, 0.3, 1],
                delay,
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.92,
              x: emergence.x * 0.4,
              y: emergence.y * 0.4,
              filter: "blur(12px)",
              transition: { duration: 0.7, ease: [0.4, 0, 1, 1] },
            }}
            style={{
              width: width ?? undefined,
              rotateX: noParallax ? 0 : rotateX,
              rotateY: noParallax ? 0 : rotateY,
            }}
            className={`pointer-events-auto relative rounded-[18px] overflow-hidden ${className ?? ""}`}
          >
            {/* Frozen glass — opacité légèrement remontée pour lisibilité */}
            <div
              className="absolute inset-0 rounded-[18px]"
              style={{
                backgroundColor: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.11)",
                backdropFilter: "blur(36px) saturate(125%)",
                WebkitBackdropFilter: "blur(36px) saturate(125%)",
                boxShadow:
                  "0 36px 100px -24px rgba(0,0,0,0.85), 0 6px 18px -4px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
              }}
            />

            {/* Reflet diagonal subtil — ton froid, pas de glow coloré */}
            <div
              className="absolute inset-0 rounded-[18px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(140deg, rgba(220,228,238,0.06) 0%, transparent 38%, transparent 100%)",
              }}
            />

            <div className="relative">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
