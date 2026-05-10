import { create } from "zustand";

interface SpatialState {
  isExpanded: boolean;
  toggleExpanded: () => void;
}

export const useSpatialStore = create<SpatialState>((set) => ({
  isExpanded: false,
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
}));
