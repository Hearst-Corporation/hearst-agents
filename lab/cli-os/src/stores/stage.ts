import { create } from "zustand";

export type StageId =
  | "home"
  | "chat"
  | "mission"
  | "asset"
  | "browser"
  | "voice"
  | "meeting"
  | "artifact"
  | "kg"
  | "briefing"
  | "rapport"
  | "signal"
  | "apps"
  | "charts"
  | "cockpit-legacy";

interface StageStore {
  current: StageId;
  setStage: (id: StageId) => void;
}

export const useStageStore = create<StageStore>((set) => ({
  current: "home",
  setStage: (id) => set({ current: id }),
}));
