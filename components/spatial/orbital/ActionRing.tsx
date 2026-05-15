"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

export type SpatialActionId = "brief" | "mission" | "assets";

interface ActionDef {
  id: SpatialActionId;
  label: string;
  /** Position relative au centre, en clamp(vw/vh) */
  x: string;
  y: string;
  /** Côté du label par rapport au point (par défaut: dérivé de la position) */
  labelSide?: "left" | "right" | "top" | "bottom";
}

interface ActionRingProps {
  show: boolean;
  onAction: (id: SpatialActionId) => void;
}

const ACTIONS: ActionDef[] = [
  { id: "brief", label: "Brief", x: "clamp(-180px, -22vw, -320px)", y: "0px", labelSide: "left" },
  {
    id: "mission",
    label: "Mission",
    x: "0px",
    y: "clamp(-140px, -18vh, -260px)",
    labelSide: "top",
  },
  { id: "assets", label: "Assets", x: "clamp(180px, 22vw, 320px)", y: "0px", labelSide: "right" },
];

/**
 * Trois actions cliquables disposées autour du noyau.
 * Apparaissent au focus, disparaissent en mission/asset/idle.
 *
 * Affordance : point lumineux + label + ligne de tension au hover.
 */
export function ActionRing({ show, onAction }: ActionRingProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: SPATIAL_Z_LAYERS.ground }}
    >
      <AnimatePresence>
        {show && (
          <div className="relative">
            {ACTIONS.map((action, i) => (
              <ActionNode
                key={action.id}
                action={action}
                index={i}
                onClick={() => onAction(action.id)}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionNode({
  action,
  index,
  onClick,
}: {
  action: ActionDef;
  index: number;
  onClick: () => void;
}) {
  const labelSide = action.labelSide ?? "right";
  const labelClass =
    labelSide === "left"
      ? "right-full mr-5 text-right"
      : labelSide === "right"
        ? "left-full ml-5 text-left"
        : labelSide === "top"
          ? "bottom-full mb-5 left-1/2 -translate-x-1/2 text-center"
          : "top-full mt-5 left-1/2 -translate-x-1/2 text-center";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: action.x,
        y: action.y,
        transition: { duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 + index * 0.08 },
      }}
      exit={{
        opacity: 0,
        scale: 0.6,
        x: 0,
        y: 0,
        transition: { duration: 0.55, ease: [0.4, 0, 1, 1] },
      }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      className="absolute pointer-events-auto group flex items-center justify-center cursor-pointer"
      style={{ left: 0, top: 0 }}
      aria-label={action.label}
    >
      {/* Float idle subtle */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
        className="relative flex items-center justify-center"
      >
        {/* Halo hover */}
        <div
          className="absolute w-12 h-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 75%)",
          }}
        />

        {/* Point central */}
        <div
          className="relative w-[5px] h-[5px] rounded-full bg-white/50 group-hover:bg-white/90 transition-colors duration-300"
          style={{ boxShadow: "0 0 8px rgba(255,255,255,0.2)" }}
        />

        {/* Label */}
        <div className={`absolute whitespace-nowrap pointer-events-none ${labelClass}`}>
          <span className="text-white/40 group-hover:text-white/80 text-spatial-sm tracking-[0.25em] uppercase font-light transition-colors duration-300">
            {action.label}
          </span>
        </div>

        {/* Ligne de tension HUD au hover */}
        <div
          className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
            labelSide === "left"
              ? "right-full w-3 h-px bg-linear-to-l from-white/55 to-transparent mr-1"
              : labelSide === "right"
                ? "left-full w-3 h-px bg-linear-to-r from-white/55 to-transparent ml-1"
                : labelSide === "top"
                  ? "bottom-full h-3 w-px bg-linear-to-t from-white/55 to-transparent mb-1 left-1/2 -translate-x-1/2"
                  : "top-full h-3 w-px bg-linear-to-b from-white/55 to-transparent mt-1 left-1/2 -translate-x-1/2"
          }`}
        />
      </motion.div>
    </motion.button>
  );
}
