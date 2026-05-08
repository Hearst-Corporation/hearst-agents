/**
 * Tests invariants — TimelineRail · PulseBar · Commandeur
 *
 * Ces composants sont des "use client" qui consomment des stores Zustand.
 * On teste les invariants via les stores directement (pas de render jsdom)
 * pour couvrir les contrats comportementaux critiques sans la complexité
 * du setup React.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Stores ──────────────────────────────────────────────────────

import { useNavigationStore } from "@/stores/navigation";
import { useStageStore } from "@/stores/stage";
import { useRuntimeStore } from "@/stores/runtime";

// ─────────────────────────────────────────────────────────────────────────────
// TimelineRail invariants (via useNavigationStore)
// ─────────────────────────────────────────────────────────────────────────────

describe("TimelineRail invariants — navigation store", () => {
  beforeEach(() => {
    useNavigationStore.setState({
      threads: [],
      activeThreadId: null,
    });
  });

  it("I-1 : setActiveThread positionne activeThreadId", () => {
    const { addThread, setActiveThread } = useNavigationStore.getState();
    const id = addThread("Test", "home");
    setActiveThread(id);
    expect(useNavigationStore.getState().activeThreadId).toBe(id);
  });

  it("I-2 : setActiveThread(null) désélectionne le thread", () => {
    const { addThread, setActiveThread } = useNavigationStore.getState();
    const id = addThread("Test", "home");
    setActiveThread(id);
    setActiveThread(null);
    expect(useNavigationStore.getState().activeThreadId).toBeNull();
  });

  it("I-3 : addThread retourne un id string non-vide", () => {
    const { addThread } = useNavigationStore.getState();
    const id = addThread("Mon thread", "home");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("I-4 : les threads créés sont bien dans la liste", () => {
    const { addThread } = useNavigationStore.getState();
    const id1 = addThread("Thread A", "home");
    const id2 = addThread("Thread B", "home");
    const threads = useNavigationStore.getState().threads;
    expect(threads.some((t) => t.id === id1)).toBe(true);
    expect(threads.some((t) => t.id === id2)).toBe(true);
  });

  it("I-5 : setActiveThread sur thread existant le sélectionne", () => {
    const { addThread, setActiveThread } = useNavigationStore.getState();
    const id = addThread("Thread C", "home");
    setActiveThread(id);
    expect(useNavigationStore.getState().activeThreadId).toBe(id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PulseBar invariants (via useRuntimeStore + useStageStore)
// ─────────────────────────────────────────────────────────────────────────────

describe("PulseBar invariants — runtime + stage state", () => {
  beforeEach(() => {
    useRuntimeStore.setState({ coreState: "idle", flowLabel: null });
    useStageStore.setState({ commandeurOpen: false, commandeurPrefilledQuery: null });
  });

  it("I-1 : coreState idle au démarrage", () => {
    expect(useRuntimeStore.getState().coreState).toBe("idle");
  });

  it("I-2 : startRun passe en streaming", () => {
    useRuntimeStore.getState().startRun("run-1");
    expect(useRuntimeStore.getState().coreState).toBe("streaming");
  });

  it("I-3 : completeRun repasse en idle", () => {
    useRuntimeStore.getState().startRun("run-1");
    useRuntimeStore.getState().completeRun();
    expect(useRuntimeStore.getState().coreState).toBe("idle");
  });

  it("I-4 : failRun passe en error avec le label", () => {
    useRuntimeStore.getState().startRun("run-1");
    useRuntimeStore.getState().failRun("Timeout");
    expect(useRuntimeStore.getState().coreState).toBe("error");
    expect(useRuntimeStore.getState().flowLabel).toBe("Timeout");
  });

  it("I-5 : setCommandeurOpen ouvre le commandeur", () => {
    useStageStore.getState().setCommandeurOpen(true);
    expect(useStageStore.getState().commandeurOpen).toBe(true);
  });

  it("I-6 : setCommandeurOpen avec prefilledQuery la stocke", () => {
    useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "recherche" });
    expect(useStageStore.getState().commandeurPrefilledQuery).toBe("recherche");
  });

  it("I-7 : fermer le commandeur efface la prefilledQuery", () => {
    useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "test" });
    useStageStore.getState().setCommandeurOpen(false);
    expect(useStageStore.getState().commandeurPrefilledQuery).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Commandeur invariants (via useStageStore)
// ─────────────────────────────────────────────────────────────────────────────

describe("Commandeur invariants — stage store", () => {
  beforeEach(() => {
    useStageStore.setState({
      commandeurOpen: false,
      commandeurPrefilledQuery: null,
    });
  });

  it("I-1 : commandeurOpen = false par défaut", () => {
    expect(useStageStore.getState().commandeurOpen).toBe(false);
  });

  it("I-2 : toggleCommandeur inverse l'état", () => {
    useStageStore.getState().toggleCommandeur();
    expect(useStageStore.getState().commandeurOpen).toBe(true);
    useStageStore.getState().toggleCommandeur();
    expect(useStageStore.getState().commandeurOpen).toBe(false);
  });

  it("I-3 : setCommandeurOpen(true) puis setMode bascule le Stage", () => {
    useStageStore.getState().setCommandeurOpen(true);
    useStageStore.getState().setMode({ mode: "chat" });
    expect(useStageStore.getState().current.mode).toBe("chat");
    // Le commandeur reste ouvert indépendamment du mode
    expect(useStageStore.getState().commandeurOpen).toBe(true);
  });

  it("I-4 : prefilledQuery est null quand on ferme", () => {
    useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "lancer" });
    expect(useStageStore.getState().commandeurPrefilledQuery).toBe("lancer");
    useStageStore.getState().setCommandeurOpen(false);
    expect(useStageStore.getState().commandeurPrefilledQuery).toBeNull();
  });

  it("I-5 : setMode ne touche pas à commandeurOpen", () => {
    useStageStore.getState().setCommandeurOpen(true);
    useStageStore.getState().setMode({ mode: "cockpit" });
    expect(useStageStore.getState().commandeurOpen).toBe(true);
  });
});
