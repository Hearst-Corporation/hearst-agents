import { create } from 'zustand';

export type SpatialEntityId = string;
export type FocusedDepth = 'glance' | 'focus' | 'deep' | null;

interface SpatialSelectionState {
  hovered: SpatialEntityId | null;
  selected: SpatialEntityId[];
  pinned: SpatialEntityId[];
  focusedDepth: FocusedDepth;
  
  hover: (id: SpatialEntityId | null) => void;
  select: (id: SpatialEntityId, opts?: { multi?: boolean }) => void;
  unselect: (id: SpatialEntityId) => void;
  unselectAll: () => void;
  pin: (id: SpatialEntityId) => void;
  unpin: (id: SpatialEntityId) => void;
  togglePin: (id: SpatialEntityId) => void;
  setDepth: (depth: FocusedDepth) => void;
}

export const useSpatialSelection = create<SpatialSelectionState>((set) => ({
  hovered: null,
  selected: [],
  pinned: [],
  focusedDepth: null,

  hover: (id) => set({ hovered: id }),

  select: (id, opts) => set((state) => {
    const isAlreadySelected = state.selected.includes(id);
    let nextSelected: string[];

    if (opts?.multi) {
      nextSelected = isAlreadySelected 
        ? state.selected.filter(sid => sid !== id)
        : [...state.selected, id];
    } else {
      nextSelected = [id];
    }

    return { 
      selected: nextSelected,
      focusedDepth: nextSelected.length > 0 ? 'focus' : null 
    };
  }),

  unselect: (id) => set((state) => {
    const nextSelected = state.selected.filter(sid => sid !== id);
    return { 
      selected: nextSelected,
      focusedDepth: nextSelected.length > 0 ? state.focusedDepth : null
    };
  }),

  unselectAll: () => set({ selected: [], focusedDepth: null }),

  pin: (id) => set((state) => ({
    pinned: state.pinned.includes(id) ? state.pinned : [...state.pinned, id]
  })),

  unpin: (id) => set((state) => ({
    pinned: state.pinned.filter(sid => sid !== id)
  })),

  togglePin: (id) => set((state) => ({
    pinned: state.pinned.includes(id) 
      ? state.pinned.filter(sid => sid !== id)
      : [...state.pinned, id]
  })),

  setDepth: (depth) => set({ focusedDepth: depth })
}));

export function useSpatialEntityState(id: SpatialEntityId) {
  const hovered = useSpatialSelection((s) => s.hovered);
  const selected = useSpatialSelection((s) => s.selected);
  const pinned = useSpatialSelection((s) => s.pinned);

  const isHovered = hovered === id;
  const isSelected = selected.includes(id);
  const isPinned = pinned.includes(id);
  const isDefocused = selected.length > 0 && !isSelected && !isPinned;
  const isActive = isSelected || isPinned;

  return { isHovered, isSelected, isPinned, isDefocused, isActive };
}
