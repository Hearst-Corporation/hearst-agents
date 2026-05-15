import { beforeEach, describe, expect, it } from "vitest";
import { type FocalObject, useFocalStore } from "@/stores/focal";

const baseFocal = (id: string, overrides: Partial<FocalObject> = {}): FocalObject => ({
  id,
  type: "report",
  status: "ready",
  title: `Focal ${id}`,
  body: "Contenu valide.",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("useFocalStore — focal-extended (invariants P0)", () => {
  beforeEach(() => {
    useFocalStore.setState({
      focal: null,
      secondary: [],
      isFocused: false,
      hasContent: false,
      isVisible: false,
      pinnedFocalKey: null,
    });
  });

  // ── Pin lock ────────────────────────────────────────────────

  it("pin lock : hydrateThreadState ne remplace pas un focal pinné par un autre asset", () => {
    useFocalStore.getState().setFocal(baseFocal("asset-1-focal", { sourceAssetId: "asset-1" }));
    expect(useFocalStore.getState().pinnedFocalKey).toBe("asset-1");

    useFocalStore
      .getState()
      .hydrateThreadState(baseFocal("asset-2-focal", { sourceAssetId: "asset-2" }), []);

    expect(useFocalStore.getState().focal?.sourceAssetId).toBe("asset-1");
    expect(useFocalStore.getState().focal?.id).toBe("asset-1-focal");
  });

  // ── Clear pin ──────────────────────────────────────────────

  it("clear pin : après clearFocal(), hydrateThreadState remplace le focal (pin libéré)", () => {
    useFocalStore.getState().setFocal(baseFocal("old", { sourceAssetId: "asset-old" }));
    useFocalStore.getState().clearFocal();
    expect(useFocalStore.getState().pinnedFocalKey).toBeNull();

    const newFocal = baseFocal("new", { sourceAssetId: "asset-new" });
    useFocalStore.getState().hydrateThreadState(newFocal, []);

    expect(useFocalStore.getState().focal?.id).toBe("new");
    expect(useFocalStore.getState().focal?.sourceAssetId).toBe("asset-new");
  });

  // ── Pin match update ───────────────────────────────────────

  it("pin match update : hydrateThreadState met à jour le contenu quand même sourceAssetId", () => {
    useFocalStore
      .getState()
      .setFocal(baseFocal("asset-1-focal", { sourceAssetId: "asset-1", title: "v1" }));
    expect(useFocalStore.getState().pinnedFocalKey).toBe("asset-1");

    useFocalStore
      .getState()
      .hydrateThreadState(
        baseFocal("asset-1-focal", { sourceAssetId: "asset-1", title: "v2" }),
        [],
      );

    expect(useFocalStore.getState().focal?.title).toBe("v2");
    expect(useFocalStore.getState().pinnedFocalKey).toBe("asset-1");
  });

  // ── isValidContent — rejets ────────────────────────────────

  it("isValidContent rejette un focal avec 'Aucun email trouvé' dans le title", () => {
    useFocalStore
      .getState()
      .setFocal(baseFocal("bad-1", { title: "Aucun email trouvé", body: "Aucun email trouvé" }));
    // focal doit rester null (contenu invalide)
    expect(useFocalStore.getState().focal).toBeNull();
  });

  it("isValidContent rejette un focal avec 'Accès non autorisé' dans le body", () => {
    useFocalStore.getState().setFocal(baseFocal("bad-2", { body: "Accès non autorisé" }));
    expect(useFocalStore.getState().focal).toBeNull();
  });

  // ── Secondary history ──────────────────────────────────────

  it("secondary history : 3 setFocal successifs → secondary contient les 2 premiers (max 3)", () => {
    const f1 = baseFocal("f1");
    const f2 = baseFocal("f2");
    const f3 = baseFocal("f3");

    useFocalStore.getState().setFocal(f1);
    useFocalStore.getState().setFocal(f2);
    useFocalStore.getState().setFocal(f3);

    const { secondary } = useFocalStore.getState();
    // f2 pushes f1 into secondary, f3 pushes f2 into secondary (f1 still there)
    expect(secondary).toHaveLength(2);
    expect(secondary[0].id).toBe("f2");
    expect(secondary[1].id).toBe("f1");
  });
});
