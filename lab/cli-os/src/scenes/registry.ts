import type { ComponentType } from "react";
import { CockpitScene } from "./CockpitScene";

export interface Scene {
  path: string;
  label: string;
  Component: ComponentType;
}

/**
 * Registry des scènes prototypées dans le lab.
 * Chaque scène = une exploration UX/UI ciblée, sans logique métier.
 * Le re-skin est total ; la sémantique pointe vers les surfaces réelles via navigation-truth.
 */
export const SCENES: Scene[] = [
  {
    path: "/cockpit",
    label: "Cockpit — première vue",
    Component: CockpitScene,
  },
];
