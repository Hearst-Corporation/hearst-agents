/**
 * Contract test — `useStageStore` (Stream C, squad-adrien 2026-05-17, itération 2).
 *
 * Ce test PIN la surface publique du store Stage identifiée par graphify AST
 * comme la **vertèbre du cockpit polymorphe** (pivot 2026-04-29) :
 *   - 60 edges, 18 communautés traversées
 *   - Risque : "god store" si chaque nouveau mode rajoute des slices sans contrôle
 *
 * Objectif : toute extension future (nouveau mode, nouvelle clé state, nouvelle
 * action) DOIT casser ce test → l'auteur est forcé d'être conscient et explicite.
 *
 * Règle d'or : on PIN, on NE MODIFIE PAS `stores/stage.ts` à des fins de logique.
 * Seul un export nommé supplémentaire (`TOOL_OVERRIDE_GUARD_MS`) a été ajouté
 * pour permettre le pin de l'invariant 10s. Si un test casse ici, soit on met à
 * jour le pin (extension consciente), soit on rollback la dérive.
 *
 * --- Note sur la duplication ALL_MODES vs EXPECTED_MODES ---
 * Les modes sont listés 2× volontairement :
 *   - `ALL_MODES` typé `Record<StageMode, true>` est un **type-level guard** :
 *     TypeScript casse au typecheck si la union `StageMode` change (ajout/retrait
 *     d'un mode sans mise à jour de la liste).
 *   - `EXPECTED_MODES` typé `readonly [...] satisfies ReadonlyArray<StageMode>`
 *     fournit l'**ordre canonique runtime** pour les itérations (`it.each`,
 *     assertions strictes `Object.keys(...).sort()`).
 * Si vous ajoutez un mode, mettez à jour les DEUX listes — TypeScript vous y
 * forcera via l'erreur de typecheck.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STAGE_HOTKEYS,
  type StageMode,
  type StagePayload,
  TOOL_OVERRIDE_GUARD_MS,
  useStageStore,
} from "@/stores/stage";

/**
 * Reset global du singleton Zustand entre chaque test.
 *
 * Cible le P2 review it2 : sans ce reset, un test qui appelle `setMode`,
 * `setModeFromTool` ou `setState` laisse des résidus sur le singleton —
 * fragile pour les tests qui suivent (et piège pour futur dev qui ajouterait
 * un test au milieu du file). On ré-initialise explicitement toutes les clés
 * du `StageState` (cf. `EXPECTED_STATE_KEYS` ci-dessous).
 *
 * Note : le premier describe utilise `vi.resetModules()` + import dynamique
 * pour pin l'état initial d'un store FRESH, et n'est donc pas affecté par
 * ce reset (singleton différent à chaque test). Le reset reste utile pour
 * les autres describes qui partagent l'import statique en haut du fichier.
 */
afterEach(() => {
  useStageStore.setState({
    current: { mode: "cockpit" },
    history: [],
    lastAssetId: null,
    lastMissionId: null,
    lastManualChangeAt: null,
    commandeurOpen: false,
    commandeurPrefilledQuery: null,
  });
});

/**
 * Liste exhaustive des modes attendus. Utilisée comme `Record<StageMode, true>`
 * pour que TypeScript force la mise à jour si un mode est ajouté/retiré dans
 * la discriminated union — cf. typecheck error si oubli.
 */
const ALL_MODES: Record<StageMode, true> = {
  cockpit: true,
  chat: true,
  asset: true,
  asset_compare: true,
  mission: true,
  browser: true,
  meeting: true,
  kg: true,
  voice: true,
  simulation: true,
  artifact: true,
  signal: true,
};

const EXPECTED_MODES = [
  "cockpit",
  "chat",
  "asset",
  "asset_compare",
  "mission",
  "browser",
  "meeting",
  "kg",
  "voice",
  "simulation",
  "artifact",
  "signal",
] as const satisfies ReadonlyArray<StageMode>;

/**
 * Clés du `StageState` attendues. Toute addition/suppression doit être
 * délibérée et casser ce snapshot.
 */
const EXPECTED_STATE_KEYS = [
  // données
  "current",
  "history",
  "lastAssetId",
  "lastMissionId",
  "commandeurOpen",
  "commandeurPrefilledQuery",
  "lastManualChangeAt",
  // actions
  "setMode",
  "setModeFromTool",
  "back",
  "reset",
  "setCommandeurOpen",
  "toggleCommandeur",
  "consumeCommandeurPrefilledQuery",
] as const;

/** Actions exposées par le store — chacune doit rester `function`. */
const EXPECTED_ACTIONS = [
  "setMode",
  "setModeFromTool",
  "back",
  "reset",
  "setCommandeurOpen",
  "toggleCommandeur",
  "consumeCommandeurPrefilledQuery",
] as const;

/**
 * Pin exhaustif des hotkeys ⌘1..0. Toute modification du mapping doit casser
 * ce test — si vous changez ⌘3 = "asset" en autre chose, la doc commentaire
 * de `setMode` (cf. stores/stage.ts) doit suivre. Inclut `key` ET `mode`.
 */
const EXPECTED_HOTKEYS: ReadonlyArray<{ key: string; mode: StageMode }> = [
  { key: "1", mode: "cockpit" },
  { key: "2", mode: "chat" },
  { key: "3", mode: "asset" },
  { key: "4", mode: "browser" },
  { key: "5", mode: "meeting" },
  { key: "6", mode: "kg" },
  { key: "7", mode: "voice" },
  { key: "8", mode: "simulation" },
  { key: "9", mode: "mission" },
  { key: "0", mode: "artifact" },
];

describe("useStageStore — contract", () => {
  /**
   * Premier describe : utilise `vi.resetModules()` + `await import(...)` pour
   * obtenir une **instance fraîche** du singleton et lire son état initial
   * tel que défini dans `create<StageState>(...)`. Sans ça, on testerait des
   * valeurs setState'ées par d'autres tests — faux pass garanti (cf. P1 it1).
   *
   * Tous les describes SUIVANTS utilisent l'import statique de
   * `useStageStore` en haut du fichier — c'est volontaire : on pin la
   * surface du singleton **partagé** par l'app. Entre chaque test, le
   * `afterEach` global ci-dessus reset toutes les clés du state, garantissant
   * l'isolation sans avoir à re-importer dynamiquement à chaque fois.
   */
  describe("Initial state — singleton frais (vi.resetModules)", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("cockpit par défaut, history vide, slices null (singleton fresh)", async () => {
      const mod = await import("@/stores/stage");
      const fresh = mod.useStageStore.getState();
      expect(fresh.current).toEqual({ mode: "cockpit" });
      expect(fresh.history).toEqual([]);
      expect(fresh.lastAssetId).toBeNull();
      expect(fresh.lastMissionId).toBeNull();
      expect(fresh.lastManualChangeAt).toBeNull();
      expect(fresh.commandeurOpen).toBe(false);
      expect(fresh.commandeurPrefilledQuery).toBeNull();
    });

    it("history est typé comme array (push-only via setMode/setModeFromTool)", async () => {
      const mod = await import("@/stores/stage");
      expect(Array.isArray(mod.useStageStore.getState().history)).toBe(true);
    });
  });

  describe("StageMode (discriminated union)", () => {
    it("pin la liste exhaustive des 12 modes du cockpit polymorphe", () => {
      const keys = Object.keys(ALL_MODES).sort();
      expect(keys).toEqual([...EXPECTED_MODES].sort());
      expect(keys).toHaveLength(12);
    });

    it("STAGE_HOTKEYS référence uniquement des modes valides du contrat", () => {
      for (const entry of STAGE_HOTKEYS) {
        expect(ALL_MODES[entry.mode]).toBe(true);
      }
    });
  });

  describe("STAGE_HOTKEYS — pin exhaustif du mapping ⌘1..0", () => {
    it("expose exactement 10 hotkeys (⌘1..9 + ⌘0)", () => {
      expect(STAGE_HOTKEYS).toHaveLength(EXPECTED_HOTKEYS.length);
      expect(STAGE_HOTKEYS).toHaveLength(10);
    });

    it.each(EXPECTED_HOTKEYS)("hotkey ⌘$key → mode '$mode'", ({ key, mode }) => {
      const found = STAGE_HOTKEYS.find((h) => h.key === key);
      expect(found).toBeDefined();
      expect(found?.mode).toBe(mode);
    });

    it("aucune hotkey en doublon (un `key` unique par entrée)", () => {
      const keys = STAGE_HOTKEYS.map((h) => h.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("snapshot strict du tableau (ordre, key, mode)", () => {
      // Si quelqu'un réordonne les hotkeys ou change un mapping, ce test casse.
      expect([...STAGE_HOTKEYS]).toEqual(EXPECTED_HOTKEYS);
    });

    // ── Pins négatifs : 2 modes existent SANS hotkey directe (12 modes - 10 hotkeys) ──
    // Si un futur dev câble une hotkey sur asset_compare ou signal sans documenter
    // l'intention, ces tests cassent → discussion obligée.

    it("asset_compare n'a pas de hotkey directe (accès via Commandeur uniquement)", () => {
      expect(STAGE_HOTKEYS.find((h) => h.mode === "asset_compare")).toBeUndefined();
    });

    it("signal n'a pas de hotkey directe (accès via timeline drill-down)", () => {
      expect(STAGE_HOTKEYS.find((h) => h.mode === "signal")).toBeUndefined();
    });
  });

  describe("Invariants sémantiques — constantes pin", () => {
    it("TOOL_OVERRIDE_GUARD_MS === 10_000 (garde-fou tool override)", () => {
      // Pin l'invariant : si quelqu'un descend la garde à 1ms ou la monte à 1h,
      // la sémantique de setModeFromTool change radicalement.
      expect(TOOL_OVERRIDE_GUARD_MS).toBe(10_000);
      expect(typeof TOOL_OVERRIDE_GUARD_MS).toBe("number");
    });
  });

  describe("StagePayload (discriminated union)", () => {
    /**
     * Un payload de référence par mode — vérifie au runtime que la
     * construction respecte le tag `mode` et passe le typecheck strict.
     * Toute modification d'une variante (ex: `assetId` → `id`) casse ici.
     */
    const PAYLOAD_FIXTURES: Record<StageMode, StagePayload> = {
      cockpit: { mode: "cockpit" },
      chat: { mode: "chat", threadId: "thread-1" },
      asset: { mode: "asset", assetId: "asset-1", variantKind: "v1" },
      asset_compare: { mode: "asset_compare", assetIds: ["a-1", "a-2"] },
      mission: { mode: "mission", missionId: "mission-1" },
      browser: { mode: "browser", sessionId: "browser-session-1" },
      meeting: { mode: "meeting", meetingId: "meeting-1" },
      kg: { mode: "kg", entityId: "entity-1", query: "q" },
      voice: { mode: "voice", sessionId: "voice-1" },
      simulation: { mode: "simulation", scenario: "scn-1" },
      artifact: {
        mode: "artifact",
        artifactId: "artifact-1",
        code: "print(1)",
        language: "python",
      },
      signal: { mode: "signal", selectedSignalId: "sig-1" },
    };

    it.each(EXPECTED_MODES)("expose une variante pour le mode '%s'", (mode) => {
      const payload = PAYLOAD_FIXTURES[mode];
      expect(payload.mode).toBe(mode);
    });

    it("le tag discriminant `mode` est présent sur chaque variante", () => {
      for (const mode of EXPECTED_MODES) {
        expect(PAYLOAD_FIXTURES[mode]).toHaveProperty("mode", mode);
      }
    });

    it("artifact.language est restreint à 'python' | 'node'", () => {
      // Test type-level encodé dans le fixture (compilation = preuve).
      // Au runtime on valide que la valeur du fixture est bien dans la liste.
      const fixture = PAYLOAD_FIXTURES.artifact;
      if (fixture.mode !== "artifact") throw new Error("type guard");
      expect(["python", "node"]).toContain(fixture.language);
    });
  });

  describe("StageState — surface (clés)", () => {
    it("pin la liste exhaustive des clés du state (data + actions)", () => {
      const state = useStageStore.getState();
      const keys = Object.keys(state).sort();
      expect(keys).toEqual([...EXPECTED_STATE_KEYS].sort());
    });

    it("ne contient aucune clé hors contrat (détecte les slices fantômes)", () => {
      const state = useStageStore.getState();
      const allowed = new Set<string>(EXPECTED_STATE_KEYS as readonly string[]);
      for (const key of Object.keys(state)) {
        expect(allowed.has(key)).toBe(true);
      }
    });
  });

  describe("Actions exposées — typeof === 'function'", () => {
    it.each(EXPECTED_ACTIONS)("expose l'action '%s' en tant que function", (action) => {
      const state = useStageStore.getState();
      const fn = state[action];
      expect(typeof fn).toBe("function");
    });

    it("le nombre d'actions exposées matche le contrat (détecte ajout/suppression)", () => {
      const state = useStageStore.getState();
      const actionCount = Object.values(state).filter((v) => typeof v === "function").length;
      expect(actionCount).toBe(EXPECTED_ACTIONS.length);
    });
  });

  describe("Invariants comportementaux pinnés (minimum vital)", () => {
    /**
     * Le scope d'un *contract test* reste la **surface**, pas le comportement
     * (qui est dans `__tests__/stores/stage.test.ts`). On pin néanmoins les
     * 3 invariants critiques documentés dans le JSDoc de `stores/stage.ts` —
     * leur dérive silencieuse casserait le contrat sémantique sans casser
     * la surface (signature). cf. P3-6 review it2.
     */

    it("back() est no-op si history vide", () => {
      const before = useStageStore.getState();
      useStageStore.getState().back();
      const after = useStageStore.getState();
      expect(after.current).toEqual(before.current);
      expect(after.history).toEqual(before.history);
    });

    it("consumeCommandeurPrefilledQuery est one-shot (reset à null après lecture)", () => {
      useStageStore.setState({ commandeurPrefilledQuery: "ma query" });
      const first = useStageStore.getState().consumeCommandeurPrefilledQuery();
      expect(first).toBe("ma query");
      expect(useStageStore.getState().commandeurPrefilledQuery).toBeNull();

      const second = useStageStore.getState().consumeCommandeurPrefilledQuery();
      expect(second).toBeNull();
    });

    it("toggleCommandeur alterne open ↔ closed", () => {
      useStageStore.setState({ commandeurOpen: false });
      useStageStore.getState().toggleCommandeur();
      expect(useStageStore.getState().commandeurOpen).toBe(true);
      useStageStore.getState().toggleCommandeur();
      expect(useStageStore.getState().commandeurOpen).toBe(false);
    });
  });

  describe("StageEntry — shape du payload historisé", () => {
    it("history pousse des entries { payload, ts } à chaque setMode", () => {
      useStageStore.setState({
        current: { mode: "cockpit" },
        history: [],
        lastManualChangeAt: null,
      });
      useStageStore.getState().setMode({ mode: "chat", threadId: "t-1" });

      const hist = useStageStore.getState().history;
      expect(hist).toHaveLength(1);
      const entry = hist[0];
      expect(entry).toHaveProperty("payload");
      expect(entry).toHaveProperty("ts");
      expect(entry.payload).toEqual({ mode: "cockpit" });
      // Assertion anti-flaky : on valide la shape (number fini > 0) plutôt
      // qu'une fenêtre Date.now() before/after qui peut être instable si
      // before === after au même ms. cf. P2 review Stage 4.
      expect(typeof entry.ts).toBe("number");
      expect(entry.ts).toBeGreaterThan(0);
      expect(Number.isFinite(entry.ts)).toBe(true);
    });
  });
});
