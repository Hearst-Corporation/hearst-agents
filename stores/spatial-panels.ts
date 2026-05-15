"use client";

import { create } from "zustand";
import {
  MAX_ACTIVE_PANELS,
  SPATIAL_PANEL_CONFIG,
  type SpatialPanelCategory,
  type SpatialPanelType,
} from "@/lib/spatial/panel-types";

/**
 * Store du registre dynamique des panels du cockpit spatial.
 *
 * Source de vérité unique pour ce qui est ouvert, quand, dans quel ordre.
 *
 * Pattern : full event-driven. L'agent (via subscribers stores existants)
 * et les actions internes ouvrent/ferment des panels. L'utilisateur ne
 * gère pas l'état (sauf Esc pour défocaliser).
 *
 * Éjection : quand on dépasse MAX_ACTIVE_PANELS, on éjecte le panel le moins
 * prioritaire (puis le plus ancien à priorité égale).
 *
 * Voir aussi : lib/spatial/panel-types.ts, lib/spatial/panel-orbit.ts
 */

export type PanelInstanceId = string;

export interface SpatialPanelInstance {
  /** ID unique d'instance. Permet 2 instances du même type (rare). */
  id: PanelInstanceId;
  type: SpatialPanelType;
  /** Données arbitraires passées au composant cible (focalId, missionId, etc.). */
  payload?: Record<string, unknown>;
  /** Timestamp d'ouverture, sert au TTL et au ranking. */
  openedAt: number;
  /** Index d'orbite assigné (0 = vedette, 5 = arrière-plan extrême). */
  orbitIndex: number;
}

interface SpatialPanelsState {
  panels: SpatialPanelInstance[];
  focusedId: PanelInstanceId | null;

  /**
   * Ouvre un panel. Si un panel du même type avec mêmes payload existe déjà,
   * il reçoit le focus au lieu d'ouvrir un doublon. Retourne l'ID d'instance.
   */
  open: (type: SpatialPanelType, payload?: Record<string, unknown>) => PanelInstanceId;

  /** Ferme un panel par ID (animation gérée par AnimatePresence). */
  close: (id: PanelInstanceId) => void;

  /** Ferme tous les panels d'un type donné (utile : "ferme toutes les approvals"). */
  closeByType: (type: SpatialPanelType) => void;

  /** Donne le focus à un panel (lui assigne orbit 0, défocalise les autres). */
  focus: (id: PanelInstanceId | null) => void;

  /** Défocalise sans rien fermer (Esc). */
  defocus: () => void;

  /**
   * Synchronise un panel "sticky" : si la condition est vraie, ouvre s'il
   * n'existe pas. Si fausse, ferme s'il existe. Idempotent.
   */
  sync: (type: SpatialPanelType, condition: boolean, payload?: Record<string, unknown>) => void;

  /** Helper : récupère un panel par type (premier trouvé) ou null. */
  getByType: (type: SpatialPanelType) => SpatialPanelInstance | null;
}

let instanceCounter = 0;
function newInstanceId(type: SpatialPanelType): PanelInstanceId {
  instanceCounter += 1;
  return `panel-${type}-${instanceCounter}-${Date.now().toString(36)}`;
}

/**
 * Calcule les orbitIndex pour une liste de panels triée par priorité décroissante
 * (et timestamp d'ouverture décroissant à priorité égale).
 * Le plus prioritaire reçoit orbitIndex 0, etc.
 */
function processPanels(panels: SpatialPanelInstance[]): SpatialPanelInstance[] {
  const sorted = [...panels].sort((a, b) => {
    const pa = SPATIAL_PANEL_CONFIG[a.type].priority;
    const pb = SPATIAL_PANEL_CONFIG[b.type].priority;
    if (pa !== pb) return pb - pa; // plus haute priorité = orbit plus proche
    return b.openedAt - a.openedAt; // plus récent = orbit plus proche
  });

  // Applique l'éjection après le tri
  const ejected = sorted.slice(0, MAX_ACTIVE_PANELS);

  return ejected.map((p, i) => ({ ...p, orbitIndex: i }));
}

export const useSpatialPanelsStore = create<SpatialPanelsState>((set, get) => ({
  panels: [],
  focusedId: null,

  open: (type, payload) => {
    const existing = get().panels.find(
      (p) => p.type === type && JSON.stringify(p.payload ?? {}) === JSON.stringify(payload ?? {}),
    );
    if (existing) {
      set({ focusedId: existing.id });
      return existing.id;
    }

    const id = newInstanceId(type);
    const newPanel: SpatialPanelInstance = {
      id,
      type,
      payload,
      openedAt: Date.now(),
      orbitIndex: 0,
    };

    set((state) => {
      const panelsWithNew = [...state.panels, newPanel];
      return {
        panels: processPanels(panelsWithNew),
        focusedId: id,
      };
    });

    return id;
  },

  close: (id) => {
    set((state) => {
      const filteredPanels = state.panels.filter((p) => p.id !== id);
      return {
        panels: processPanels(filteredPanels),
        focusedId: state.focusedId === id ? null : state.focusedId,
      };
    });
  },

  closeByType: (type) => {
    set((state) => {
      const filteredPanels = state.panels.filter((p) => p.type !== type);
      const stillHasFocused = filteredPanels.some((p) => p.id === state.focusedId);
      return {
        panels: processPanels(filteredPanels),
        focusedId: stillHasFocused ? state.focusedId : null,
      };
    });
  },

  focus: (id) => {
    set({ focusedId: id });
  },

  defocus: () => {
    set({ focusedId: null });
  },

  sync: (type, condition, payload) => {
    const existing = get().panels.find((p) => p.type === type);
    if (condition && !existing) {
      get().open(type, payload);
    } else if (!condition && existing) {
      get().close(existing.id);
    } else if (condition && existing && payload) {
      // Update payload silencieusement
      set((state) => ({
        panels: state.panels.map((p) => (p.id === existing.id ? { ...p, payload } : p)),
      }));
    }
  },

  getByType: (type) => {
    return get().panels.find((p) => p.type === type) ?? null;
  },
}));

/**
 * Helper : retourne la catégorie comportementale d'un panel.
 */
export function panelCategory(panel: SpatialPanelInstance): SpatialPanelCategory {
  return SPATIAL_PANEL_CONFIG[panel.type].category;
}

/**
 * Helper : retourne true s'il y a au moins un panel interruptif ouvert.
 * Utilisé pour dim global de la scène (overlay modal).
 */
export function hasInterruptive(panels: SpatialPanelInstance[]): boolean {
  return panels.some((p) => SPATIAL_PANEL_CONFIG[p.type].category === "interruptive");
}
