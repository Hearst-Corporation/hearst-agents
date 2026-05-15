"use client";

import type { ReactNode } from "react";

interface SpatialSceneProps {
  children?: ReactNode;
}

/**
 * Couche 3D de la page spatiale. Conteneur fixed plein écran.
 * Reçoit la scène (Spline / R3F) en children pour permettre du SSR
 * sur les noyaux qui le supportent.
 */
export function SpatialScene({ children }: SpatialSceneProps) {
  return <div className="spatial-canvas-container fixed inset-0 z-1">{children}</div>;
}
