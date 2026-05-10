"use client";

import { motion } from "framer-motion";
import { ORBITAL_NODE } from "@/components/spatial/motion/variants";
import type { SpatialNode } from "@/lib/spatial/types";
import { ORBITAL_DEFAULTS } from "@/lib/spatial/constants";

interface OrbitalItemProps {
  node: SpatialNode;
  index: number;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
  renderLabel?: (node: SpatialNode) => React.ReactNode;
  position: "left" | "right" | "top" | "bottom";
}

/**
 * Item orbital HTML positionné par Framer Motion.
 * Indépendant de R3F — utilisable dans la couche HTML overlay.
 */
export function OrbitalItem({
  node,
  index,
  onHover,
  onClick,
  renderLabel,
  position,
}: OrbitalItemProps) {
  const labelClass = {
    left: "right-full mr-5",
    right: "left-full ml-5",
    top: "bottom-full mb-5",
    bottom: "top-full mt-5",
  }[position];

  const tensionClass = {
    left: "right-full w-4 h-px bg-gradient-to-l from-white/40 to-transparent mr-1",
    right: "left-full w-4 h-px bg-gradient-to-r from-white/40 to-transparent ml-1",
    top: "bottom-full h-4 w-px bg-gradient-to-t from-white/40 to-transparent mb-1",
    bottom: "top-full h-4 w-px bg-gradient-to-b from-white/40 to-transparent mt-1",
  }[position];

  return (
    <motion.div
      custom={index * 0.1}
      variants={ORBITAL_NODE}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute flex items-center justify-center pointer-events-auto cursor-pointer group"
      style={{ x: node.position.x, y: node.position.y }}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(node.id)}
    >
      <motion.div
        animate={{ y: [0, -ORBITAL_DEFAULTS.floatAmplitude, 0] }}
        transition={{
          duration: ORBITAL_DEFAULTS.floatDuration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.3,
        }}
        className="flex items-center justify-center"
      >
        {/* Point lumineux */}
        <div className="relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/60 group-hover:bg-white transition-colors duration-500 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          <div className="absolute w-10 h-10 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors duration-500 blur-md" />
        </div>

        {/* Label */}
        <div className={`absolute whitespace-nowrap flex items-center justify-center ${labelClass}`}>
          {renderLabel ? (
            renderLabel(node)
          ) : (
            <span className="text-white/60 group-hover:text-white text-xs tracking-[0.2em] uppercase font-light transition-colors duration-500">
              {node.label}
            </span>
          )}
        </div>

        {/* Ligne de tension HUD */}
        <div className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${tensionClass}`} />
      </motion.div>
    </motion.div>
  );
}
