/**
 * @vitest-environment jsdom
 *
 * MobileBottomNav — Navigation primaire mobile (Factory Cockpit).
 * Aligné sur le dock desktop : Dashboard / Chat / Mission (central) /
 * Commandeur / Connexions. Voice sort du bottom nav (accessible via Cmd+K
 * et hotkey ⌘⇧V).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "@/app/(user)/components/MobileBottomNav";
import { useStageStore } from "@/stores/stage";

// next/navigation est appelé directement par le composant ; on stubbe le
// router pour pouvoir asserter les push() sans monter un App Router complet.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn() }),
}));

describe("MobileBottomNav", () => {
  beforeEach(() => {
    pushMock.mockClear();
    useStageStore.setState({
      current: { mode: "cockpit" },
      history: [],
      lastAssetId: null,
      lastMissionId: null,
      commandeurOpen: false,
    });
  });

  it("rend les 5 boutons attendus (Dashboard, Chat, Mission, Cmd, Apps)", () => {
    render(<MobileBottomNav />);
    expect(screen.getByTestId("mobile-nav-cockpit")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-chat")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-mission")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-commandeur")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-connections")).toBeTruthy();
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

  it("Mission sans lastMissionId → setMode(mission, '')", () => {
    const setMode = vi.fn();
    useStageStore.setState({ setMode, lastMissionId: null });
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-mission"));
    expect(setMode).toHaveBeenCalledWith({ mode: "mission", missionId: "" });
  });

  it("Mission avec lastMissionId → setMode(mission, lastMissionId)", () => {
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

  it("Connexions → router.push(/connections)", () => {
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByTestId("mobile-nav-connections"));
    expect(pushMock).toHaveBeenCalledWith("/connections");
  });

  it("data-active=true sur le bouton du mode actif", () => {
    useStageStore.setState({ current: { mode: "mission", missionId: "m-1" } });
    render(<MobileBottomNav />);
    expect(screen.getByTestId("mobile-nav-mission").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-cockpit").getAttribute("data-active")).toBe("false");
  });
});
