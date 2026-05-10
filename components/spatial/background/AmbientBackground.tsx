"use client";

import { buildDepthGradient } from "@/lib/spatial/utils";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";

interface AmbientBackgroundProps {
  /** Gradient radial de vignettage — opacity 0.8 par défaut */
  vignetteOpacity?: number;
  /** Couleur de fond brute */
  baseColor?: string;
  /** Gradient radial de l'ambiance centrale */
  ambientColor?: string;
}

/**
 * Calque background HTML — vignette + ambiance colorée.
 * Toujours pointer-events-none, z=0.
 */
export function AmbientBackground({
  vignetteOpacity = 0.95,
  baseColor = "#020202",
  ambientColor = "rgba(20,20,20,0.5)",
}: AmbientBackgroundProps) {
  return (
    <>
      {/* Base color */}
      <div
        className="absolute inset-0"
        style={{
          background: baseColor,
          zIndex: SPATIAL_Z_LAYERS.background,
        }}
      />

      {/* Ambient radial gradient (center breathing zone) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${ambientColor} 0%, rgba(0,0,0,1) 100%)`,
          zIndex: SPATIAL_Z_LAYERS.background + 1,
        }}
      />

      {/* Vignette overlay (top layer, cinematic) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: buildDepthGradient(vignetteOpacity),
          zIndex: SPATIAL_Z_LAYERS.overlay - 1,
        }}
      />
    </>
  );
}
