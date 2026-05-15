/**
 * useBuilderStore — pont entre la page /missions/builder et le ContextRail.
 *
 * La page enregistre ses handlers (onAdd, onChange, onDelete) et expose
 * le node sélectionné. Le ContextRailForMissionsAdmin les consomme quand
 * pathname === "/missions/builder".
 */

import { create } from "zustand";
import type { PaletteEntry } from "@/app/(user-legacy)/components/missions/builder/NodePalette";
import type { WorkflowNode } from "@/lib/workflows/types";

interface BuilderHandlers {
  onAdd: (entry: PaletteEntry) => void;
  onChange: (patch: Partial<WorkflowNode>) => void;
  onDelete: () => void;
}

interface BuilderState {
  selectedNode: WorkflowNode | null;
  handlers: BuilderHandlers | null;
  setSelectedNode: (node: WorkflowNode | null) => void;
  registerHandlers: (handlers: BuilderHandlers) => void;
  clearHandlers: () => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  selectedNode: null,
  handlers: null,
  setSelectedNode: (node) => set({ selectedNode: node }),
  registerHandlers: (handlers) => set({ handlers }),
  clearHandlers: () => set({ handlers: null, selectedNode: null }),
}));
