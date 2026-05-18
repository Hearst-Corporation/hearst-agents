// @vitest-environment jsdom
/**
 * Tests unitaires — app/(user)/_shell/RightRail.tsx
 *
 * Vérifie :
 *  1. Les deux onglets (Contexte / Kimi) sont présents dans le DOM.
 *  2. Le panneau "Contexte" est visible par défaut.
 *  3. Un clic sur l'onglet "Kimi" affiche le panneau Kimi.
 *  4. Le rail rend les items du stage actif dans le panneau Contexte.
 *  5. Un panneau vide affiche le message "Aucun signal".
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Framer Motion — rend les enfants directement sans animation
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// @hearst/cockpit-shell — ChatKimi rendu comme stub minimal
vi.mock("@hearst/cockpit-shell", () => ({
  ChatKimi: ({ productName }: { productName: string }) => (
    <div data-testid="chat-kimi-stub">{productName}</div>
  ),
}));

import { RightRail } from "../../app/(user)/_shell/RightRail";
import type { RailItem } from "../../app/(user)/_stages/types";

afterEach(() => {
  cleanup();
});

const ITEMS_MOCK: RailItem[] = [
  { t: "Signal chaud", s: "SIGNAL_HOT", hot: true },
  { t: "Signal froid", s: "SIGNAL_COLD", hot: false },
];

describe("RightRail — onglets", () => {
  it("affiche les deux onglets Contexte et Kimi", () => {
    render(<RightRail title="Test Rail" items={[]} />);

    expect(screen.getByRole("tab", { name: "Contexte" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Kimi" })).toBeTruthy();
  });

  it("onglet Contexte est sélectionné par défaut (aria-selected=true)", () => {
    render(<RightRail title="Test Rail" items={[]} />);

    const tabContexte = screen.getByRole("tab", { name: "Contexte" });
    expect(tabContexte.getAttribute("aria-selected")).toBe("true");

    const tabKimi = screen.getByRole("tab", { name: "Kimi" });
    expect(tabKimi.getAttribute("aria-selected")).toBe("false");
  });

  it("panneau Contexte est visible par défaut (panneau Kimi masqué)", () => {
    render(<RightRail title="Contexte actif" items={[]} />);

    const panelContexte = document.getElementById("panel-context");
    const panelKimi = document.getElementById("panel-kimi");

    expect(panelContexte).not.toBeNull();
    expect(panelContexte!.hasAttribute("hidden")).toBe(false);

    expect(panelKimi).not.toBeNull();
    expect(panelKimi!.hasAttribute("hidden")).toBe(true);
  });

  it("clic sur Kimi → panneau Kimi visible, panneau Contexte masqué", () => {
    render(<RightRail title="Test Rail" items={[]} />);

    const tabKimi = screen.getByRole("tab", { name: "Kimi" });
    fireEvent.click(tabKimi);

    const panelContexte = document.getElementById("panel-context");
    const panelKimi = document.getElementById("panel-kimi");

    expect(panelContexte!.hasAttribute("hidden")).toBe(true);
    expect(panelKimi!.hasAttribute("hidden")).toBe(false);

    // Le composant ChatKimi est bien rendu
    expect(screen.getByTestId("chat-kimi-stub")).toBeTruthy();
  });

  it("clic sur Kimi puis retour Contexte → panneau Contexte visible à nouveau", () => {
    render(<RightRail title="Test Rail" items={[]} />);

    fireEvent.click(screen.getByRole("tab", { name: "Kimi" }));
    fireEvent.click(screen.getByRole("tab", { name: "Contexte" }));

    const panelContexte = document.getElementById("panel-context");
    expect(panelContexte!.hasAttribute("hidden")).toBe(false);
  });
});

describe("RightRail — contenu Contexte", () => {
  it("affiche le titre du stage dans le panneau Contexte", () => {
    render(<RightRail title="Missions actives" items={[]} />);
    expect(screen.getByText("Missions actives")).toBeTruthy();
  });

  it("affiche le message vide si items=[]", () => {
    render(<RightRail title="Stage vide" items={[]} />);
    expect(screen.getByText(/Aucun signal/)).toBeTruthy();
  });

  it("rend les items du stage actif", () => {
    render(<RightRail title="Stage avec items" items={ITEMS_MOCK} />);

    expect(screen.getByText("Signal chaud")).toBeTruthy();
    expect(screen.getByText("Signal froid")).toBeTruthy();
    expect(screen.getByText("SIGNAL_HOT")).toBeTruthy();
    expect(screen.getByText("SIGNAL_COLD")).toBeTruthy();
  });

  it("n'affiche pas le message vide si items non vides", () => {
    render(<RightRail title="Stage avec items" items={ITEMS_MOCK} />);
    expect(screen.queryByText(/Aucun signal/)).toBeNull();
  });
});
