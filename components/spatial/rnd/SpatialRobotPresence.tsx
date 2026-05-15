"use client";

import { motion } from "framer-motion";

interface SpatialRobotPresenceProps {
  mode: "idle" | "surface" | "active" | "approval";
  surfaceOpen: boolean;
}

export function SpatialRobotPresence({ mode, surfaceOpen }: SpatialRobotPresenceProps) {
  const accent =
    mode === "active"
      ? "rgba(255,255,255,0.26)"
      : mode === "approval"
        ? "rgba(232,176,120,0.22)"
        : mode === "surface"
          ? "rgba(255,255,255,0.2)"
          : "rgba(255,255,255,0.14)";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 w-[52%] overflow-hidden"
      style={{ zIndex: 12 }}
    >
      <motion.div
        className="absolute right-[10%] top-[16%] h-[58vh] w-[36vw] rounded-full"
        animate={{
          opacity: mode === "idle" ? [0.1, 0.16, 0.1] : [0.14, 0.22, 0.14],
          scale: surfaceOpen ? [1, 1.025, 1] : [0.99, 1.01, 0.99],
        }}
        transition={{ duration: mode === "idle" ? 7 : 4.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(closest-side, ${accent}, transparent 68%)`,
          filter: "blur(58px)",
        }}
      />
      <motion.div
        className="absolute left-[-8%] top-[16%] h-[72vh] w-[22vw]"
        animate={{ opacity: surfaceOpen ? 0.08 : 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.025), transparent)",
          filter: "blur(46px)",
        }}
      />
    </div>
  );
}
