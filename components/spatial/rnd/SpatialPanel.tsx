"use client";

import { motion, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import {
  getOrbitPanelHeight,
  getOrbitPanelWidth,
  type OrbitPosition,
} from "@/lib/spatial/panel-orbit";
import { SPATIAL_PANEL_CONFIG, type SpatialPanelType } from "@/lib/spatial/panel-types";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";
import { useSpatialPanelsStore } from "@/stores/spatial-panels";

interface SpatialPanelProps {
  instanceId: string;
  type: SpatialPanelType;
  orbitIndex: number;
  position: OrbitPosition;
  /** Si vrai, ce panel a le focus (orbit 0, halo). */
  isFocused: boolean;
  /** Si vrai, un autre panel est focal → ce panel est defocused. */
  isDefocused: boolean;
  /** Si vrai, un panel interruptif est ouvert → tous les autres dim. */
  isInterruptiveDim: boolean;
  children: ReactNode;
}

/**
 * Wrapper d'un panel dans le cockpit spatial orbital.
 *
 * Animations :
 * - Entrée : émergence depuis le robot (translateZ -160, scale 0.92, opacity 0,
 *   blur 8px) → position finale, 720ms cubic-bezier(0.16,1,0.3,1).
 * - Sortie : recul Z + dissolution, 360ms cubic-bezier(0.4,0,1,1).
 * - Focus : état très discret, sans zoom ni halo agressif.
 * - Defocus : légère baisse d'opacité uniquement.
 * - Dim interruptif : opacity 0.25, blur 6px (laisse le centre stage à l'overlay).
 *
 * Click → focus, second click → defocus.
 * Esc géré au niveau SpatialPanelHost.
 */
export function SpatialPanel({
  instanceId,
  type,
  orbitIndex,
  position,
  isFocused,
  isDefocused,
  isInterruptiveDim,
  children,
}: SpatialPanelProps) {
  const { smoothY } = useSpatialMouseContext();
  const focus = useSpatialPanelsStore((s) => s.focus);
  const defocus = useSpatialPanelsStore((s) => s.defocus);

  const config = SPATIAL_PANEL_CONFIG[type];
  const isInterruptive = config.category === "interruptive";

  // Tilt 3D vertical — moins fort si defocused (effet "en arrière").
  const tiltMagnitude = isFocused ? 6 : isDefocused ? 2 : 4;
  const rotateX = useTransform(smoothY, [-1, 1], [tiltMagnitude, -tiltMagnitude]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFocused) {
      defocus();
      return;
    }
    focus(instanceId);
  };

  // États cibles
  const targetZ = position.depthZ;
  const targetScale = 1;
  const targetOpacity = isInterruptiveDim && !isInterruptive ? 0.1 : isDefocused ? 0.6 : 1;
  const targetBlur = isInterruptiveDim && !isInterruptive ? 12 : 0;
  const targetSaturate = isDefocused ? 0.7 : 1;

  const filterValue =
    targetBlur > 0 || targetSaturate < 1
      ? `blur(${targetBlur}px) saturate(${targetSaturate})`
      : "none";

  const width = getOrbitPanelWidth(orbitIndex, type);
  const height = getOrbitPanelHeight(type);

  return (
    <motion.div
      key={instanceId}
      onClick={handleClick}
      whileHover={{ y: -5, scale: 1.02, transition: { duration: 0.2, ease: "easeOut" } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1, ease: "easeOut" } }}
      transition={{
        duration: 0.72,
        ease: [0.16, 1, 0.3, 1],
        opacity: { duration: 0.48 },
      }}
      initial={{
        opacity: 0,
        scale: 0.8,
        z: position.depthZ - 200,
        filter: "blur(20px) saturate(0.2)",
        x: "0%",
        y: "0%",
      }}
      animate={{
        opacity: targetOpacity,
        scale: targetScale,
        z: targetZ,
        filter: filterValue,
        rotateY: position.rotateY,
        // PAS DE BOXSHADOW ICI
      }}
      exit={{
        opacity: 0,
        scale: 0.85,
        z: position.depthZ - 150,
        filter: "blur(10px) saturate(0.5)",
        transition: { duration: 0.4, ease: [0.4, 0, 1, 1] },
      }}
      style={{
        position: "absolute",
        left: `${position.xPct}%`,
        top: `${position.yPct}%`,
        width: `${width}px`,
        height: `${height}px`,
        // Centre le panel sur sa position pivot
        translateX: "-50%",
        translateY: "-50%",
        rotateX,
        // rotateY est animé par framer
        transformStyle: "preserve-3d",
        willChange: "transform, opacity",
        cursor: "pointer",
      }}
      className={`pointer-events-auto rounded-xl border border-border-strong ${isFocused ? "shadow-panel-lift bg-bg-panel-gradient backdrop-blur-lg" : "bg-bg-panel-gradient backdrop-blur-md"}`}
    >
      {/* Halo interruptif (ambre) existant */}
      {isInterruptive && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[56px]"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--warn) 25%, transparent), transparent 70%)",
            filter: "blur(16px)",
          }}
        />
      )}

      <div className="relative h-full w-full">{children}</div>
    </motion.div>
  );
}
