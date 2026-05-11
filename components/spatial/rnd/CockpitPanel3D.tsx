"use client";

import { motion, useTransform } from "framer-motion";
import { type ReactNode } from "react";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";
import {
  useSpatialEntityState,
  useSpatialSelectionStore,
  type SpatialEntityId,
} from "@/stores/spatial-selection";

interface CockpitPanel3DProps {
  entityId: SpatialEntityId;
  /** Profondeur Z du panel (px). Négatif = derrière la caméra. */
  depthZ: number;
  /** Intensité du tilt (suit la souris). */
  tiltIntensity?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Wrapper d'un panel HTML qui flotte à une profondeur Z donnée dans la scène
 * cockpit 3D. Pur CSS 3D (perspective + translateZ + tilt), pas de R3F.
 *
 * États visuels :
 * - idle : translateZ(depthZ), opacity 1
 * - hovered : scale 1.04, glow blanc cassé
 * - focal (selected ou pinned) : translateZ(depthZ + 80), scale 1.08, glow fort
 * - defocused : translateZ(depthZ - 60), opacity 0.4, blur 4px
 *
 * Tilt 3D : suit la souris via SpatialMouseProvider.
 * Click : select(entityId), shift+click : togglePin, click ailleurs : unselectAll.
 */
export function CockpitPanel3D({
  entityId,
  depthZ,
  tiltIntensity = 6,
  className,
  children,
}: CockpitPanel3DProps) {
  const { smoothX, smoothY } = useSpatialMouseContext();
  const select = useSpatialSelectionStore((s) => s.select);
  const togglePin = useSpatialSelectionStore((s) => s.togglePin);
  const hover = useSpatialSelectionStore((s) => s.hover);

  const { isHovered, isFocal, isPinned, isDefocused } = useSpatialEntityState(entityId);

  const rotateY = useTransform(smoothX, [-1, 1], [-tiltIntensity, tiltIntensity]);
  const rotateX = useTransform(smoothY, [-1, 1], [tiltIntensity, -tiltIntensity]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      togglePin(entityId);
    } else {
      select(entityId);
    }
  };

  const targetZ = isFocal ? depthZ + 80 : isDefocused ? depthZ - 60 : depthZ;
  const targetScale = isFocal ? 1.08 : isHovered ? 1.04 : 1;
  const targetOpacity = isDefocused ? 0.4 : 1;
  const targetBlur = isDefocused ? 4 : 0;

  return (
    <motion.div
      onClick={handleClick}
      onMouseEnter={() => hover(entityId)}
      onMouseLeave={() => hover(null)}
      animate={{
        z: targetZ,
        scale: targetScale,
        opacity: targetOpacity,
        filter: `blur(${targetBlur}px)`,
      }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        willChange: "transform",
        cursor: "pointer",
      }}
      className={`pointer-events-auto relative h-full w-full ${className ?? ""}`}
    >
      {/* Halo focal / pinned */}
      {isFocal && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-[40px]"
          style={{
            background: isPinned
              ? "radial-gradient(closest-side, rgba(0,229,204,0.20), transparent 70%)"
              : "radial-gradient(closest-side, rgba(255,255,255,0.16), transparent 70%)",
            filter: "blur(8px)",
          }}
        />
      )}
      {/* Halo hover */}
      {isHovered && !isFocal && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-2 rounded-[40px]"
          style={{
            background: "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent 75%)",
          }}
        />
      )}

      <div className="relative">{children}</div>
    </motion.div>
  );
}
