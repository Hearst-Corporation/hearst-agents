/**
 * @vitest-environment jsdom
 *
 * Stage — routing polymorphe : vérifie que le bon sub-stage est rendu
 * selon `useStageStore.current.mode`.
 *
 * Les sous-composants sont tous mockés pour éviter les dépendances
 * profondes (fetches, contexts, etc.).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStageStore } from "@/stores/stage";

// ── Mocks des sous-composants ─────────────────────────────────────────
vi.mock("@/app/(user)/components/stages/CockpitStage", () => ({
  CockpitStage: () => <div data-testid="CockpitStage" />,
}));
vi.mock("@/app/(user)/components/stages/ChatStage", () => ({
  ChatStage: () => <div data-testid="ChatStage" />,
}));
vi.mock("@/app/(user)/components/stages/AssetStage", () => ({
  AssetStage: () => <div data-testid="AssetStage" />,
}));
vi.mock("@/app/(user)/components/stages/AssetCompareStage", () => ({
  AssetCompareStage: () => <div data-testid="AssetCompareStage" />,
}));
vi.mock("@/app/(user)/components/stages/MissionStage", () => ({
  MissionStage: () => <div data-testid="MissionStage" />,
}));
vi.mock("@/app/(user)/components/stages/BrowserStage", () => ({
  BrowserStage: () => <div data-testid="BrowserStage" />,
}));
vi.mock("@/app/(user)/components/stages/MeetingStage", () => ({
  MeetingStage: () => <div data-testid="MeetingStage" />,
}));
vi.mock("@/app/(user)/components/stages/KnowledgeStage", () => ({
  KnowledgeStage: () => <div data-testid="KnowledgeStage" />,
}));
vi.mock("@/app/(user)/components/stages/VoiceStage", () => ({
  VoiceStage: () => <div data-testid="VoiceStage" />,
}));
vi.mock("@/app/(user)/components/stages/SimulationStage", () => ({
  SimulationStage: () => <div data-testid="SimulationStage" />,
}));
vi.mock("@/app/(user)/components/stages/ArtifactStage", () => ({
  ArtifactStage: () => <div data-testid="ArtifactStage" />,
}));

import { Stage } from "@/app/(user)/components/Stage";

const defaultProps = {
  messages: [],
  onSubmit: async () => {},
  hasMessages: false,
};

describe("Stage — routing polymorphe (11 modes)", () => {
  beforeEach(() => {
    useStageStore.setState({
      current: { mode: "chat" },
      history: [],
      lastAssetId: null,
      lastMissionId: null,
      lastManualChangeAt: null,
      commandeurOpen: false,
      commandeurPrefilledQuery: null,
    });
  });

  it("rend CockpitStage quand mode='cockpit'", () => {
    useStageStore.setState({ current: { mode: "cockpit" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("CockpitStage")).toBeTruthy();
  });

  it("rend ChatStage quand mode='chat'", () => {
    useStageStore.setState({ current: { mode: "chat" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("ChatStage")).toBeTruthy();
  });

  it("rend AssetStage quand mode='asset'", () => {
    useStageStore.setState({ current: { mode: "asset", assetId: "a-1" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("AssetStage")).toBeTruthy();
  });

  it("rend MissionStage quand mode='mission'", () => {
    useStageStore.setState({ current: { mode: "mission", missionId: "m-1" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("MissionStage")).toBeTruthy();
  });

  it("rend BrowserStage quand mode='browser'", () => {
    useStageStore.setState({ current: { mode: "browser", sessionId: "s-1" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("BrowserStage")).toBeTruthy();
  });

  it("rend VoiceStage quand mode='voice'", () => {
    useStageStore.setState({ current: { mode: "voice" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("VoiceStage")).toBeTruthy();
  });

  it("rend SimulationStage quand mode='simulation'", () => {
    useStageStore.setState({ current: { mode: "simulation" } });
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId("SimulationStage")).toBeTruthy();
  });

  it("rend null (sans throw) quand mode est inconnu", () => {
    // Cast nécessaire pour simuler un mode hors des 11 valides
    useStageStore.setState({ current: { mode: "invalid_mode" as never } });
    const { container } = render(<Stage {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });
});
