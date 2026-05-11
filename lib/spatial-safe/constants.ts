/**
 * Spatial Mode — Constantes système
 * Centralise toutes les valeurs magiques du module spatial.
 */

import type { SpatialDepthLayer, SpatialTheme, SpatialSceneConfig, MotionConfig } from "./types";

export const SPATIAL_Z_LAYERS: Record<SpatialDepthLayer, number> = {
  background: 0,
  scene: 10,
  ground: 20,
  surface: 30,
  overlay: 40,
  hud: 50,
  critical: 60,
};

export const SPATIAL_THEME_DARK: SpatialTheme = {
  background: "#000000",
  surface: "rgba(255,255,255,0.04)",
  surfaceHigh: "rgba(255,255,255,0.08)",
  text: "rgba(255,255,255,0.90)",
  textMuted: "rgba(255,255,255,0.40)",
  accent: "#ffffff",
  accentGlow: "rgba(255,255,255,0.60)",
  border: "rgba(255,255,255,0.10)",
  borderHigh: "rgba(255,255,255,0.20)",
};

export const SCENE_CONFIG: SpatialSceneConfig = {
  camera: {
    position: [0, 0, 10],
    fov: 45,
  },
  environment: {
    resolution: 512,
    lights: [
      { type: "ambient", intensity: 0.2 },
      { type: "spot", intensity: 1, position: [10, 10, 10] },
      { type: "point", intensity: 0.5, position: [-10, -10, -10] },
      { type: "lightformer", intensity: 3, position: [0, 4, 4], scale: [8, 8, 1] },
      { type: "lightformer", intensity: 1.2, position: [0, -2, -6], scale: [10, 10, 1] },
    ],
  },
};

export const MOTION_PRESETS: Record<string, MotionConfig> = {
  emerge: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
  dissolve: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  snap: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
  drift: { duration: 2.0, ease: "easeInOut" },
  pulse: { duration: 1.5, ease: "easeInOut" },
};

export const ORB_RADIUS = {
  inner: 0.95,
  outer: 1.5,
  ring: { inner: 1.1, outer: 1.12 },
} as const;

export const ORBITAL_DEFAULTS = {
  radiusX: 320,
  radiusY: 240,
  orbitSpeed: 0.5,
  floatAmplitude: 5,
  floatDuration: 5,
} as const;
