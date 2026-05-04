/**
 * Selection Store — Zustand
 *
 * Sélection courante au cockpit (mode "select-then-act"). Alimente la
 * Strate 5 du ContextRail quand `useStageStore.current.mode === "cockpit"`.
 *
 * Pattern : clic sur un rôle agent dans la constellation système, ou sur
 * une mission/asset/report ailleurs au cockpit, pose une sélection. Le rail
 * droit affiche la fiche correspondante. Aucun side-effect Stage : la
 * navigation reste explicite via bouton "Ouvrir →", hotkey ⌘1-9, ou
 * Commandeur Cmd+K.
 *
 * En mode "chat", la Strate 5 lit `useFocalStore.focal` à la place — ce
 * store est ignoré dans les autres modes.
 *
 * Pas de persistance (RAM only). Reset au mount de la SPA.
 */

import { create } from "zustand";

export type SelectionKind = "agent" | "mission" | "asset" | "report";

export interface Selection {
  kind: SelectionKind;
  id: string;
  /** Snapshot minimal pour render immédiat sans refetch (peut être stale). */
  label?: string;
  meta?: Record<string, unknown>;
}

interface SelectionState {
  current: Selection | null;
  select: (sel: Selection) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  current: null,
  select: (sel) => set({ current: sel }),
  clear: () => set({ current: null }),
}));
