// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Contrat hub-mode de <ScreenShell> (cf. @hearst/hub-sdk).
 *
 * On mocke `useHubMode` — on teste NOTRE câblage (showHeader ?? !isHub),
 * pas la détection interne du SDK (consommé tel quel, jamais modifié).
 *
 * Couvre les scénarios 1 & 2 de façon déterministe :
 *  - standalone (isHub=false) → header présent, app identique → no-op
 *  - hub (isHub=true)         → header masqué, contenu plein cadre
 *  - override explicite showHeader → priorité sur la dérivation hub
 */

const hub = vi.hoisted(() => ({ isHub: false }));

vi.mock("@hearst/hub-sdk", () => ({
  useHubMode: () => ({
    isHub: hub.isHub,
    ready: true,
    accent: undefined,
    productCtx: null,
    cap: [],
  }),
}));

import { ScreenShell } from "../app/(user)/components/ui/ScreenShell";

afterEach(() => {
  cleanup();
  hub.isHub = false;
});

const TITLE = "Titre écran sentinelle";

describe("ScreenShell — contrat hub-mode", () => {
  it("standalone (isHub=false) : header rendu, contenu rendu (no-op)", () => {
    hub.isHub = false;
    render(
      <ScreenShell title={TITLE} stats={<span>bande-stats</span>}>
        <p>contenu-enfant</p>
      </ScreenShell>,
    );
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText("bande-stats")).toBeTruthy();
    expect(screen.getByText("contenu-enfant")).toBeTruthy();
  });

  it("hub (isHub=true) : header ET bande stats masqués, contenu plein cadre", () => {
    hub.isHub = true;
    render(
      <ScreenShell title={TITLE} stats={<span>bande-stats</span>}>
        <p>contenu-enfant</p>
      </ScreenShell>,
    );
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(screen.queryByText("bande-stats")).toBeNull();
    expect(screen.getByText("contenu-enfant")).toBeTruthy();
  });

  it("override explicite showHeader={true} : header rendu même en hub", () => {
    hub.isHub = true;
    render(
      <ScreenShell title={TITLE} showHeader>
        <p>contenu-enfant</p>
      </ScreenShell>,
    );
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText("contenu-enfant")).toBeTruthy();
  });

  it("override explicite showHeader={false} : header masqué même en standalone", () => {
    hub.isHub = false;
    render(
      <ScreenShell title={TITLE} showHeader={false}>
        <p>contenu-enfant</p>
      </ScreenShell>,
    );
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(screen.getByText("contenu-enfant")).toBeTruthy();
  });
});
