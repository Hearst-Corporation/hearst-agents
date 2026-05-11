"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { normalizeMousePosition } from "@/lib/spatial-safe/utils";

interface SpatialMouseContextValue {
  /** Position normalisée [-1, 1] — raw */
  rawX: MotionValue<number>;
  rawY: MotionValue<number>;
  /** Position lissée — pour parallax doux */
  smoothX: MotionValue<number>;
  smoothY: MotionValue<number>;
}

const SpatialMouseContext = createContext<SpatialMouseContextValue | null>(null);

/**
 * Provider mouse global du Spatial Mode.
 * Lissé via spring pour un feel premium, sans à-coups.
 * Un seul listener pour toute la scène.
 */
export function SpatialMouseProvider({ children }: { children: ReactNode }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const smoothX = useSpring(rawX, { stiffness: 60, damping: 22, mass: 0.6 });
  const smoothY = useSpring(rawY, { stiffness: 60, damping: 22, mass: 0.6 });

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const { x, y } = normalizeMousePosition(e.clientX, e.clientY);
      rawX.set(x);
      rawY.set(y);
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [rawX, rawY]);

  return (
    <SpatialMouseContext.Provider value={{ rawX, rawY, smoothX, smoothY }}>
      {children}
    </SpatialMouseContext.Provider>
  );
}

export function useSpatialMouseContext() {
  const ctx = useContext(SpatialMouseContext);
  if (!ctx) throw new Error("useSpatialMouseContext must be used within SpatialMouseProvider");
  return ctx;
}
