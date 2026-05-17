/**
 * @vitest-environment jsdom
 *
 * MobileBottomNav — Navigation primaire mobile (Factory Cockpit).
 * Aligné sur le dock desktop : Dashboard / Chat / Demandes (central) /
 * Commandeur / Aujourd'hui. Voice sort du bottom nav (accessible via Cmd+K
 * et hotkey ⌘⇧V).
 *
 * Vocabulaire visible : « Demandes » → code mode `"mission"`. Le testid
 * reste `mobile-nav-mission` pour ne pas casser les sélecteurs existants.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "@/app/(user)/components/MobileBottomNav";
import { useStageStore } from "@/stores/stage";

describe("MobileBottomNav", () => {
  beforeEach(() => {
    useStageStore.setState({
      current: { mode: "cockpit" },
      history: [],
      lastAssetId: null,
      lastMissionId: null,
      commandeurOpen: false,
    });
  });

  it("rend les 5 boutons attendus (Dashboard, Chat, Demandes, Commandeur, Aujourd'hui)", () => {
    render(<MobileBottomNav />);
    expect(screen.getByTestId("mobile-nav-cockpit")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-chat")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-mission")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-commandeur")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-today")).toBeTruthy();
  });

  it("Cockpit → setMode(cockpit)", () => {
    const setMode = vi.fn();
    useStageStore.setState({ setMode });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-cockpit"));
    expect(setMode).toHaveBeenCalledWith({ mode: "cockpit" });
  });

  it("Chat → setMode(chat)", () => {
    const setMode = vi.fn();
    useStageStore.setState({ setMode });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-chat"));
    expect(setMode).toHaveBeenCalledWith({ mode: "chat" });
  });

  it("Demandes sans lastMissionId → setMode(mission, '')", () => {
    const setMode = vi.fn();
    useStageStore.setState({ setMode, lastMissionId: null });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-mission"));
    expect(setMode).toHaveBeenCalledWith({ mode: "mission", missionId: "" });
  });

  it("Demandes avec lastMissionId → setMode(mission, lastMissionId)", () => {
    const setMode = vi.fn();
    useStageStore.setState({ setMode, lastMissionId: "mission-42" });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-mission"));
    expect(setMode).toHaveBeenCalledWith({ mode: "mission", missionId: "mission-42" });
  });

  it("Commandeur → setCommandeurOpen(true)", () => {
    const setCommandeurOpen = vi.fn();
    useStageStore.setState({ setCommandeurOpen });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-commandeur"));
    expect(setCommandeurOpen).toHaveBeenCalledWith(true);
  });

  it("Aujourd'hui → setCommandeurOpen(true, { prefilledQuery: 'brief du jour' })", () => {
    const setCommandeurOpen = vi.fn();
    useStageStore.setState({ setCommandeurOpen });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-today"));
    expect(setCommandeurOpen).toHaveBeenCalledWith(true, { prefilledQuery: "brief du jour" });
  });

  it("data-active=true sur le bouton du mode actif", () => {
    useStageStore.setState({ current: { mode: "mission", missionId: "m-1" } });
    render(<MobileBottomNav />);
    expect(screen.getByTestId("mobile-nav-mission").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-cockpit").getAttribute("data-active")).toBe("false");
  });
});
