import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "@/stores/selection";

describe("useSelectionStore", () => {
  beforeEach(() => {
    useSelectionStore.setState({ current: null });
  });

  it("démarre vide", () => {
    expect(useSelectionStore.getState().current).toBeNull();
  });

  it("select pose la sélection courante", () => {
    useSelectionStore.getState().select({ kind: "agent", id: "pilot" });
    expect(useSelectionStore.getState().current).toEqual({
      kind: "agent",
      id: "pilot",
    });
  });

  it("select remplace la sélection précédente (pas de stack)", () => {
    useSelectionStore.getState().select({ kind: "agent", id: "pilot" });
    useSelectionStore.getState().select({ kind: "asset", id: "asset-42" });
    expect(useSelectionStore.getState().current).toEqual({
      kind: "asset",
      id: "asset-42",
    });
  });

  it("clear remet à null", () => {
    useSelectionStore.getState().select({ kind: "mission", id: "m1" });
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().current).toBeNull();
  });

  it("préserve label et meta quand fournis", () => {
    useSelectionStore.getState().select({
      kind: "report",
      id: "r1",
      label: "Bilan hebdo",
      meta: { specId: "weekly" },
    });
    const cur = useSelectionStore.getState().current;
    expect(cur?.label).toBe("Bilan hebdo");
    expect(cur?.meta).toEqual({ specId: "weekly" });
  });
});
