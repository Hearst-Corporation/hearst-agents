"use client";

import { create } from "zustand";

/**
 * Store de sélection spatiale (cockpit 3D R&D).
 *
 * Gère la sélection / hover / pin sur les panels 3D du cockpit /spatial-rnd.
 * Volontairement isolé : ne touche pas aux stores de production
 * (useStageStore, useFocalStore) tant que le pattern n'est pas validé.
 */

export type SpatialEntityId = "brief" | "kpi" | "mission" | "assets" | "agent" | string;

interface SpatialSelectionState {
  hovered: SpatialEntityId | null;
  selectedId: SpatialEntityId | null;
  pinnedIds: SpatialEntityId[];

  hover: (id: SpatialEntityId | null) => void;
  select: (id: SpatialEntityId | null) => void;
  togglePin: (id: SpatialEntityId) => void;
  unselectAll: () => void;
}

export const useSpatialSelectionStore = create<SpatialSelectionState>((set, get) => ({
  hovered: null,
  selectedId: null,
  pinnedIds: [],

  hover: (id) => set({ hovered: id }),
  select: (id) => set({ selectedId: id }),
  togglePin: (id) => {
    const { pinnedIds } = get();
    if (pinnedIds.includes(id)) {
      set({ pinnedIds: pinnedIds.filter((p) => p !== id) });
    } else {
      set({ pinnedIds: [...pinnedIds, id] });
    }
  },
  unselectAll: () => set({ selectedId: null }),
}));

/**
 * Hook helper : récupère l'état visuel courant d'une entité.
 *
 * - isHovered : curseur dessus
 * - isSelected : panel sélectionné (un seul à la fois, hors pin)
 * - isPinned : épinglé (peut coexister avec selected)
 * - isFocal : selected OU pinned (le panel doit être mis en avant)
 * - isDefocused : un autre panel est focal → ce panel doit reculer dans le flou
 */
export function useSpatialEntityState(id: SpatialEntityId): {
  isHovered: boolean;
  isSelected: boolean;
  isPinned: boolean;
  isFocal: boolean;
  isDefocused: boolean;
} {
  const hovered = useSpatialSelectionStore((s) => s.hovered);
  const selectedId = useSpatialSelectionStore((s) => s.selectedId);
  const pinnedIds = useSpatialSelectionStore((s) => s.pinnedIds);

  const isHovered = hovered === id;
  const isSelected = selectedId === id;
  const isPinned = pinnedIds.includes(id);
  const isFocal = isSelected || isPinned;

  const someoneElseIsFocal =
    (selectedId !== null && selectedId !== id) || pinnedIds.some((p) => p !== id);
  const isDefocused = !isFocal && someoneElseIsFocal;

  return { isHovered, isSelected, isPinned, isFocal, isDefocused };
}
