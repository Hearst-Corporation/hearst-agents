/**
 * Types du shell visionOS (port lab/cli-os → Next.js).
 *
 * Les 12 StageKey correspondent strictement aux 12 modes polymorphes
 * exposés par `useStageStore` (stores/stage.ts). Pas de dérive : un stage
 * du shell = un mode du store.
 */

import type { StageMode } from "@/stores/stage";

export type StageKey = StageMode;

export type RailItem = {
  t: string;
  s: string;
  hot?: boolean;
};

export type FooterConfig = {
  status: string;
  statusRunning?: boolean;
  actions: readonly [string, string, string];
  modes: readonly [string, string];
};

export type StageDef = {
  key: StageKey;
  label: string;
  navLabel: string;
  hotkey?: string;
  footer: FooterConfig;
  railTitle: string;
};

/**
 * Ordre LeftRail (88px) — du haut vers le bas. 12 slots, un par mode
 * polymorphe. Cmd+1..9 + Cmd+0 mappés via STAGE_HOTKEYS (stores/stage.ts).
 *
 * Pendant la phase 1 : tous les slots sont des stubs cliquables. Le registry
 * complet (footer + railItems data-bound) arrive en phase 3.
 */
export const LEFT_RAIL_ORDER: readonly StageKey[] = [
  "cockpit",
  "chat",
  "asset",
  "browser",
  "meeting",
  "kg",
  "voice",
  "simulation",
  "mission",
  "artifact",
  "signal",
  "asset_compare",
] as const;

/**
 * Libellés courts des 12 slots (utilisés dans l'aria-label + tooltip).
 * Reste minimal en P1 — design final via icônes en P2.
 */
export const STAGE_LABELS: Record<StageKey, string> = {
  cockpit: "Accueil",
  chat: "Chat",
  asset: "Assets",
  asset_compare: "Compare",
  mission: "Mission",
  browser: "Browser",
  meeting: "Meeting",
  kg: "KG",
  voice: "Voice",
  simulation: "Sim",
  artifact: "Artifact",
  signal: "Signaux",
};
