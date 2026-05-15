/**
 * Active Space store (Q3-C foundation) — multi-projets / silos logiques.
 *
 * Couvre :
 *  - état initial : activeSpaceId = "personal", 3 spaces (DEFAULT_SPACES)
 *  - setActiveSpace : update + refus si id absent (garde-fou)
 *  - addSpace : ajout + idempotent par id (remplace, pas duplique)
 *  - removeSpace : retire + refus si dernier + switch auto si actif
 *  - persistance : localStorage.setItem appelé après update
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "hearst-active-space";

/**
 * Pré-installation du localStorage AVANT que zustand persist ne capture
 * `window.localStorage` à l'init du module store. `vi.hoisted` garantit
 * l'exécution avant les imports statiques (ESM hoisting friendly).
 */
const ls = vi.hoisted(() => {
  const store: Record<string, string> = {};
  const setItem = (k: string, v: string) => {
    store[k] = v;
  };
  const getItem = (k: string) => store[k] ?? null;
  const removeItem = (k: string) => {
    delete store[k];
  };
  const clear = () => {
    for (const k of Object.keys(store)) delete store[k];
  };
  const fakeWindow = {
    localStorage: { setItem, getItem, removeItem, clear, key: () => null, length: 0 },
  };
  // Patch global : zustand persist appelle `window.localStorage` directement.
  (globalThis as unknown as { window: typeof fakeWindow }).window = fakeWindow;
  (globalThis as unknown as { localStorage: typeof fakeWindow.localStorage }).localStorage =
    fakeWindow.localStorage;
  return { store, fakeWindow };
});

import { DEFAULT_SPACES, type SpaceConfig, useActiveSpace } from "@/stores/active-space";

describe("useActiveSpace store", () => {
  beforeEach(() => {
    // Reset état canonique du store.
    useActiveSpace.setState({
      activeSpaceId: "personal",
      spaces: [...DEFAULT_SPACES],
    });
    // Reset le storage backing — sans toucher la référence (que zustand a capturée).
    for (const k of Object.keys(ls.store)) delete ls.store[k];
  });

  describe("état initial", () => {
    it("activeSpaceId === 'personal'", () => {
      expect(useActiveSpace.getState().activeSpaceId).toBe("personal");
    });

    it("expose 3 spaces par défaut (personal, side-project, venture)", () => {
      const spaces = useActiveSpace.getState().spaces;
      expect(spaces).toHaveLength(3);
      expect(spaces.map((s) => s.id)).toEqual(["personal", "side-project", "venture"]);
    });

    it("DEFAULT_SPACES utilise des CSS vars (jamais hex en dur)", () => {
      for (const s of DEFAULT_SPACES) {
        expect(s.color.startsWith("var(--")).toBe(true);
      }
    });
  });

  describe("setActiveSpace", () => {
    it("met à jour activeSpaceId quand l'id existe", () => {
      useActiveSpace.getState().setActiveSpace("side-project");
      expect(useActiveSpace.getState().activeSpaceId).toBe("side-project");
    });

    it("ignore un id inconnu (refus, pas crash)", () => {
      useActiveSpace.getState().setActiveSpace("inconnu");
      expect(useActiveSpace.getState().activeSpaceId).toBe("personal");
    });

    it("change vers venture sans casser la liste de spaces", () => {
      const before = useActiveSpace.getState().spaces;
      useActiveSpace.getState().setActiveSpace("venture");
      expect(useActiveSpace.getState().activeSpaceId).toBe("venture");
      expect(useActiveSpace.getState().spaces).toEqual(before);
    });
  });

  describe("addSpace", () => {
    it("ajoute un nouveau space à la liste", () => {
      const newSpace: SpaceConfig = {
        id: "client-x",
        label: "Client X",
        color: "var(--accent-teal)",
      };
      useActiveSpace.getState().addSpace(newSpace);
      const spaces = useActiveSpace.getState().spaces;
      expect(spaces).toHaveLength(4);
      expect(spaces.find((s) => s.id === "client-x")).toEqual(newSpace);
    });

    it("idempotent : un id existant remplace (pas de duplicate)", () => {
      const overridden: SpaceConfig = {
        id: "personal",
        label: "Perso renommé",
        color: "var(--gold)",
      };
      useActiveSpace.getState().addSpace(overridden);
      const spaces = useActiveSpace.getState().spaces;
      expect(spaces).toHaveLength(3);
      const personal = spaces.find((s) => s.id === "personal");
      expect(personal?.label).toBe("Perso renommé");
      expect(personal?.color).toBe("var(--gold)");
    });
  });

  describe("removeSpace", () => {
    it("retire le space ciblé de la liste", () => {
      useActiveSpace.getState().removeSpace("venture");
      const spaces = useActiveSpace.getState().spaces;
      expect(spaces).toHaveLength(2);
      expect(spaces.find((s) => s.id === "venture")).toBeUndefined();
    });

    it("refuse de supprimer le dernier space (au moins 1 requis)", () => {
      useActiveSpace.setState({
        activeSpaceId: "solo",
        spaces: [{ id: "solo", label: "Solo", color: "var(--accent-teal)" }],
      });
      useActiveSpace.getState().removeSpace("solo");
      expect(useActiveSpace.getState().spaces).toHaveLength(1);
      expect(useActiveSpace.getState().spaces[0].id).toBe("solo");
    });

    it("supprime le space actif → switch automatique vers le 1er restant", () => {
      // Personal est actif par défaut ; on le supprime.
      useActiveSpace.getState().removeSpace("personal");
      const state = useActiveSpace.getState();
      expect(state.spaces.find((s) => s.id === "personal")).toBeUndefined();
      // Le 1er restant après filter = side-project.
      expect(state.activeSpaceId).toBe("side-project");
    });

    it("supprime un space non-actif → activeSpaceId inchangé", () => {
      useActiveSpace.getState().removeSpace("venture");
      expect(useActiveSpace.getState().activeSpaceId).toBe("personal");
    });
  });

  describe("persist (localStorage)", () => {
    it("setActiveSpace persiste l'état sous la clé hearst-active-space", () => {
      useActiveSpace.getState().setActiveSpace("side-project");
      // zustand persist sérialise via JSON.stringify → on lit le store directement.
      const raw = ls.store[STORAGE_KEY];
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed.state.activeSpaceId).toBe("side-project");
    });

    it("addSpace persiste la nouvelle liste", () => {
      useActiveSpace.getState().addSpace({
        id: "client-y",
        label: "Client Y",
        color: "var(--accent-llm)",
      });
      const raw = ls.store[STORAGE_KEY];
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed.state.spaces.find((s: SpaceConfig) => s.id === "client-y")).toBeTruthy();
    });

    it("removeSpace persiste la liste filtrée", () => {
      useActiveSpace.getState().removeSpace("venture");
      const raw = ls.store[STORAGE_KEY];
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed.state.spaces.find((s: SpaceConfig) => s.id === "venture")).toBeUndefined();
    });
  });
});
