/**
 * Spatial Mode — Utilitaires purs
 */

import type { SpatialNode } from "./types";

export function polarToCartesian(
  angle: number,
  radiusX: number,
  radiusY: number,
  tiltRad = 0
): { x: number; y: number; z: number } {
  const x = Math.cos(angle) * radiusX;
  const y = Math.sin(angle) * radiusY * Math.cos(tiltRad);
  const z = Math.sin(angle) * radiusY * Math.sin(tiltRad);
  return { x, y, z };
}

export function distributeOnEllipse(count: number, radiusX: number, radiusY: number): SpatialNode[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const { x, y } = polarToCartesian(angle, radiusX, radiusY);
    return {
      id: `node-${i}`,
      label: `Node ${i}`,
      position: { x, y },
      phase: angle,
    };
  });
}

export function lerpColor(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeMousePosition(
  clientX: number,
  clientY: number,
  width = window.innerWidth,
  height = window.innerHeight
): { x: number; y: number } {
  return {
    x: (clientX / width) * 2 - 1,
    y: (clientY / height) * 2 - 1,
  };
}

export function buildDepthGradient(opacity = 0.8): string {
  return `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,${opacity}) 100%)`;
}
