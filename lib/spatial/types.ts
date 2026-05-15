/**
 * Spatial Mode — Types centraux
 * Hors design system Hearst OS. Voir CLAUDE.md section "Modules hors DS".
 */

export type SpatialStage = "idle" | "focus" | "mission" | "asset" | "expert" | "transition";

export type SpatialMotionPreset = "emerge" | "dissolve" | "orbit" | "pulse" | "drift" | "snap";

export type SpatialPanelPosition =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "corner-tl"
  | "corner-tr"
  | "corner-bl"
  | "corner-br";

export type SpatialDepthLayer =
  | "background" // z: 0  — canvas WebGL
  | "scene" // z: 10 — éléments 3D
  | "ground" // z: 20 — overlays bas (constellations)
  | "surface" // z: 30 — panels HTML flottants
  | "overlay" // z: 40 — overlays plein écran
  | "hud" // z: 50 — éléments HUD persistants (nav, status)
  | "critical"; // z: 60 — modals, toasts critiques

export interface SpatialTheme {
  background: string;
  surface: string;
  surfaceHigh: string;
  text: string;
  textMuted: string;
  accent: string;
  accentGlow: string;
  border: string;
  borderHigh: string;
}

export interface SpatialNode {
  id: string;
  label: string;
  position: { x: number; y: number; z?: number };
  radius?: number;
  speed?: number;
  phase?: number;
}

export interface OrbitalConfig {
  nodes: SpatialNode[];
  radiusX: number;
  radiusY: number;
  tiltDeg?: number;
  orbitSpeed?: number;
}

export interface MotionConfig {
  duration: number;
  ease: number[] | string;
  delay?: number;
  stagger?: number;
}

export interface SpatialSceneConfig {
  camera: {
    position: [number, number, number];
    fov: number;
  };
  environment: {
    resolution: number;
    lights: Array<{
      type: "ambient" | "spot" | "point" | "lightformer";
      intensity: number;
      position?: [number, number, number];
      scale?: [number, number, number];
    }>;
  };
}
