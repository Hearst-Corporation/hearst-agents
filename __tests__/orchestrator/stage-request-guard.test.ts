/**
 * stage-request-guard — vérifie que les event SSE `stage_request` passent
 * par `setModeFromTool` (et non `setMode`) pour respecter le guard 10s.
 *
 * On teste directement le store Zustand (useStageStore) plutôt que ChatDock
 * entier, car ChatDock dépend de Next.js router, fetch, et SSE — trop lourds
 * pour un test unitaire. Le contrat vérifié ici est :
 *   1. `setModeFromTool` existe et applique le payload quand aucun changement
 *      manuel récent (déjà couvert par __tests__/stores/stage.test.ts).
 *   2. Un event `stage_request` simulé avec `setModeFromTool` ne change PAS le
 *      mode si l'utilisateur a appelé `setMode` il y a < 10s.
 *   3. L'appel direct à `setMode` (bypass du guard) changerait bien le mode —
 *      ce qui confirme que ChatDock doit utiliser `setModeFromTool`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { StagePayload } from "@/stores/stage";
import { useStageStore } from "@/stores/stage";

const TOOL_OVERRIDE_GUARD_MS = 10_000;

function resetStore(overrides?: Partial<Parameters<typeof useStageStore.setState>[0]>) {
  useStageStore.setState({
    current: { mode: "cockpit" },
    history: [],
    lastAssetId: null,
    lastMissionId: null,
    lastManualChangeAt: null,
    commandeurOpen: false,
    commandeurPrefilledQuery: null,
    ...overrides,
  });
}

// ── Simule la réception d'un SSE stage_request ─────────────────────────────

/**
 * Dans ChatDock, le handler SSE fait exactement :
 *   if (event.type === "stage_request" && event.stage) {
 *     setStageModeFromTool(event.stage as StagePayload);
 *   }
 *
 * On reproduit ce comportement ici pour tester le contrat sans monter le
 * composant complet.
 */
function simulateSseStageRequest(payload: StagePayload) {
  useStageStore.getState().setModeFromTool(payload);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("stage-request guard — ChatDock utilise setModeFromTool", () => {
  beforeEach(() => resetStore());

  it("event stage_request applique le mode quand aucun changement manuel récent", () => {
    const payload: StagePayload = { mode: "asset", assetId: "asset-x" };
    simulateSseStageRequest(payload);
    expect(useStageStore.getState().current).toEqual(payload);
  });

  it("event stage_request est ignoré si l'user a changé de mode il y a < 10s", () => {
    // L'user navigue manuellement vers chat
    useStageStore.getState().setMode({ mode: "chat" });
    // Immédiatement après, un event SSE tente de changer vers asset
    simulateSseStageRequest({ mode: "asset", assetId: "asset-x" });
    // Le guard doit bloquer le tool override
    expect(useStageStore.getState().current).toEqual({ mode: "chat" });
  });

  it("event stage_request est appliqué si le changement manuel date de > 10s", () => {
    // Simule un changement manuel qui date de 11 secondes
    useStageStore.getState().setMode({ mode: "chat" });
    useStageStore.setState({ lastManualChangeAt: Date.now() - (TOOL_OVERRIDE_GUARD_MS + 1000) });

    simulateSseStageRequest({ mode: "asset", assetId: "asset-x" });
    expect(useStageStore.getState().current).toEqual({ mode: "asset", assetId: "asset-x" });
  });

  it("setModeFromTool ne met PAS à jour lastManualChangeAt (guard reste basé user)", () => {
    // Aucun changement manuel précédent
    useStageStore.setState({ lastManualChangeAt: null });
    simulateSseStageRequest({ mode: "kg" });
    // Après un tool override, lastManualChangeAt doit rester null
    expect(useStageStore.getState().lastManualChangeAt).toBeNull();
  });

  it("contrôle : setMode (bypass direct) CHANGERAIT le mode — preuve que ChatDock doit utiliser setModeFromTool", () => {
    // D'abord on simule un changement manuel récent
    useStageStore.getState().setMode({ mode: "chat" });

    // Si ChatDock utilisait setMode à la place de setModeFromTool, le mode
    // changerait immédiatement et écraserait le choix de l'utilisateur.
    // Ce test confirme que setMode ignore le guard.
    useStageStore.getState().setMode({ mode: "asset", assetId: "force-x" });
    expect(useStageStore.getState().current).toEqual({ mode: "asset", assetId: "force-x" });
    // → C'est pourquoi ChatDock DOIT utiliser setModeFromTool pour les SSE.
  });

  it("event stage_request avec payload asset persiste lastAssetId", () => {
    simulateSseStageRequest({ mode: "asset", assetId: "a-42" });
    expect(useStageStore.getState().lastAssetId).toBe("a-42");
  });

  it("multiple events SSE consécutifs — le dernier l'emporte si aucun guard", () => {
    const payload1: StagePayload = { mode: "browser", sessionId: "s-1" };
    const payload2: StagePayload = { mode: "meeting", meetingId: "m-1" };

    simulateSseStageRequest(payload1);
    expect(useStageStore.getState().current).toEqual(payload1);

    simulateSseStageRequest(payload2);
    expect(useStageStore.getState().current).toEqual(payload2);
  });
});
