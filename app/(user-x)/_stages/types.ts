/**
 * Types du shell visionOS (port lab/cli-os → Next.js).
 *
 * Les 12 StageKey correspondent strictement aux 12 modes polymorphes
 * exposés par `useStageStore` (stores/stage.ts). Pas de dérive : un stage
 * du shell = un mode du store.
 *
 * Les constantes (LEFT_RAIL_ORDER, STAGE_REGISTRY, getStageLabel) vivent
 * dans `./registry.ts` — ce fichier garde uniquement les types.
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
