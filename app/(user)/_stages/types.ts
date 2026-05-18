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

/** Cubic-bezier partagé par toutes les animations visionOS des stages. */
export const VISION_EASE = [0.22, 1, 0.36, 1] as const;

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
  /** Handler optionnel — si absent, les actions ne sont pas rendues comme interactives. */
  onActionClick?: (action: string) => void;
  /** Handler optionnel — si absent, les modes ne sont pas rendus comme interactifs. */
  onModeClick?: (mode: string) => void;
};

export type StageDef = {
  key: StageKey;
  label: string;
  navLabel: string;
  /** Phrase courte FR décrivant ce que fait le Stage (tooltip + sous-titre). */
  tagline?: string;
  hotkey?: string;
  footer: FooterConfig;
  railTitle: string;
};
