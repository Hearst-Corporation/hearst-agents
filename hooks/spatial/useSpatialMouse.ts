"use client";

import { useEffect } from "react";
import { useMotionValue } from "framer-motion";
import { normalizeMousePosition } from "@/lib/spatial/utils";

/**
 * Tracks normalized mouse position [-1, 1] for parallax / material reactions.
 * Active uniquement quand `active` est true pour éviter les listeners inutiles.
 */
export function useSpatialMouse(active = true) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    if (!active) return;

    function handleMove(e: MouseEvent) {
      const normalized = normalizeMousePosition(e.clientX, e.clientY);
      x.set(normalized.x);
      y.set(normalized.y);
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [active, x, y]);

  return { x, y };
}
