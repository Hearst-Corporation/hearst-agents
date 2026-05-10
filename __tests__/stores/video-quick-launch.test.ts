/**
 * VideoQuickLaunch store (S2-A + Q3-A) — toggle volatil du panel ⌘G.
 *
 * Couvre :
 *  - état initial fermé
 *  - openLauncher / close / toggle
 *  - idempotence des opens consécutifs
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useVideoQuickLaunchStore } from "@/stores/video-quick-launch";

describe("useVideoQuickLaunchStore", () => {
  beforeEach(() => {
    useVideoQuickLaunchStore.setState({ open: false });
  });

  it("démarre fermé (open: false)", () => {
    expect(useVideoQuickLaunchStore.getState().open).toBe(false);
  });

  it("openLauncher() passe open à true", () => {
    useVideoQuickLaunchStore.getState().openLauncher();
    expect(useVideoQuickLaunchStore.getState().open).toBe(true);
  });

  it("close() repasse open à false", () => {
    useVideoQuickLaunchStore.getState().openLauncher();
    useVideoQuickLaunchStore.getState().close();
    expect(useVideoQuickLaunchStore.getState().open).toBe(false);
  });

  it("close() reste à false si déjà fermé (idempotent)", () => {
    useVideoQuickLaunchStore.getState().close();
    expect(useVideoQuickLaunchStore.getState().open).toBe(false);
  });

  it("toggle() alterne open/close", () => {
    expect(useVideoQuickLaunchStore.getState().open).toBe(false);
    useVideoQuickLaunchStore.getState().toggle();
    expect(useVideoQuickLaunchStore.getState().open).toBe(true);
    useVideoQuickLaunchStore.getState().toggle();
    expect(useVideoQuickLaunchStore.getState().open).toBe(false);
    useVideoQuickLaunchStore.getState().toggle();
    expect(useVideoQuickLaunchStore.getState().open).toBe(true);
  });

  it("openLauncher() consécutifs : reste open (idempotent)", () => {
    useVideoQuickLaunchStore.getState().openLauncher();
    useVideoQuickLaunchStore.getState().openLauncher();
    useVideoQuickLaunchStore.getState().openLauncher();
    expect(useVideoQuickLaunchStore.getState().open).toBe(true);
  });

  it("openLauncher() après toggle (open=true) reste open", () => {
    useVideoQuickLaunchStore.getState().toggle();
    expect(useVideoQuickLaunchStore.getState().open).toBe(true);
    useVideoQuickLaunchStore.getState().openLauncher();
    expect(useVideoQuickLaunchStore.getState().open).toBe(true);
  });
});
