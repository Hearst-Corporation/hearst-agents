import { create } from "zustand";

interface SpatialState {
  isExpanded: boolean;
  activeAgent: string | null;
  toggleExpanded: () => void;
  setActiveAgent: (agentId: string | null) => void;
}

export const useSpatialStore = create<SpatialState>((set) => ({
  isExpanded: false,
  activeAgent: null,
  toggleExpanded: () => set((state) => ({ 
    isExpanded: !state.isExpanded,
    // On ferme l'agent actif si on replie toute la scène
    activeAgent: state.isExpanded ? null : state.activeAgent 
  })),
  setActiveAgent: (agentId) => set({ activeAgent: agentId }),
}));
