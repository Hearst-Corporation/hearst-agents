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
  width = typeof window !== 'undefined' ? window.innerWidth : 1920,
  height = typeof window !== 'undefined' ? window.innerHeight : 1080
): { x: number; y: number } {
  return {
    x: (clientX / width) * 2 - 1,
    y: (clientY / height) * 2 - 1,
  };
}

/**
 * Format relatif "à l'instant", "5min", "hier", "lun.", "12 mai".
 * Utilisé par les cards bento spatial pour les timestamps assets/messages.
 */
const FR_DAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "à l'instant";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) {
    const d = new Date(ts);
    return FR_DAY_SHORT[d.getDay()];
  }
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString('fr-FR', { month: 'short' })}`;
}
