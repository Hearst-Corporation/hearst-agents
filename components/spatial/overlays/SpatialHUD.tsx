"use client";

import type { ReactNode } from "react";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface SpatialHUDProps {
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottomCenter?: ReactNode;
}

/**
 * HUD persistent du Spatial Mode — nav minimale + status.
 * Pointer-events-none sur le shell, pointer-events-auto sur les enfants interactifs.
 */
export function SpatialHUD({ topLeft, topRight, bottomCenter }: SpatialHUDProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: SPATIAL_Z_LAYERS.hud }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 w-full p-10 flex justify-between items-center">
        {topLeft && <div className="pointer-events-auto">{topLeft}</div>}
        {topRight && <div className="pointer-events-auto">{topRight}</div>}
      </div>

      {/* Bottom center slot */}
      {bottomCenter && (
        <div className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-auto">
          {bottomCenter}
        </div>
      )}
    </div>
  );
}
