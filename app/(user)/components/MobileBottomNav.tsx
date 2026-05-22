"use client";

/**
 * MobileBottomNav — Navigation primaire mobile.
 *
 * Aligné sur le dock desktop StageFooter (Factory Cockpit) :
 *   Dashboard · Chat · Demandes (central emphasis) · Commandeur · Aujourd'hui
 *
 * Vocabulaire visible : « Demandes » → code mode `"mission"` (rename UI
 * 2026-05). Le testid reste `mobile-nav-mission` pour ne pas casser les
 * specs Vitest existantes ; types/store/routes inchangés.
 *
 * "Aujourd'hui" est un chip non dangereux qui ouvre le Commandeur prérempli
 * sur "brief du jour" (pas de route /agenda dédiée). Voice reste accessible
 * via Commandeur (⌘K) et hotkey ⌘⇧V.
 *
 * Visible uniquement < md (Tailwind `md:hidden`). Fixed bottom, safe-area
 * inset bottom respecté pour iOS notch.
 *
 * Tokens uniquement (cf. CLAUDE.md). Glyphes texte minimalistes pour rester
 * cohérent avec PulseBar/ghost-icons.
 */

import { useStageStore } from "@/stores/stage";

interface NavItem {
  id: "cockpit" | "chat" | "mission" | "commandeur" | "today";
  label: string;
  glyph: string;
  emphasis?: boolean;
}

const ITEMS: NavItem[] = [
  { id: "cockpit", label: "Dashboard", glyph: "▦" },
  { id: "chat", label: "Chat", glyph: "✱" },
  { id: "mission", label: "Demandes", glyph: "◎", emphasis: true },
  { id: "commandeur", label: "Commandeur", glyph: "⌘" },
  { id: "today", label: "Aujourd'hui", glyph: "☼" },
];

export function MobileBottomNav() {
  const setMode = useStageStore((s) => s.setMode);
  const currentMode = useStageStore((s) => s.current.mode);
  const lastMissionId = useStageStore((s) => s.lastMissionId);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const commandeurOpen = useStageStore((s) => s.commandeurOpen);

  const handlePress = (id: NavItem["id"]) => {
    switch (id) {
      case "cockpit":
        setMode({ mode: "cockpit" });
        break;
      case "chat":
        setMode({ mode: "chat" });
        break;
      case "mission":
        setMode({ mode: "mission", missionId: lastMissionId ?? "" });
        break;
      case "commandeur":
        setCommandeurOpen(true);
        break;
      case "today":
        setCommandeurOpen(true, { prefilledQuery: "brief du jour" });
        break;
    }
  };

  const isActive = (id: NavItem["id"]) => {
    if (id === "cockpit") return currentMode === "cockpit";
    if (id === "chat") return currentMode === "chat";
    if (id === "mission") return currentMode === "mission";
    return false;
  };

  return (
    <nav
      aria-label="Navigation mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch justify-between"
      style={{
        zIndex: "var(--z-sticky)" as unknown as number,
        background: "var(--bg)",
        borderTop: "1px solid var(--border-default)",
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-2)",
        paddingTop: "var(--space-2)",
        paddingBottom: "calc(var(--space-2) + env(safe-area-inset-bottom, 0px))",
        gap: "var(--space-1)",
      }}
    >
      {ITEMS.map((item) => {
        const active = isActive(item.id);
        const isCommandeurButton = item.id === "commandeur" || item.id === "today";
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handlePress(item.id)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            {...(isCommandeurButton && { "aria-expanded": commandeurOpen })}
            data-testid={`mobile-nav-${item.id}`}
            data-active={active}
            className="flex flex-col items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover)"
            style={{
              flex: item.emphasis ? "1.6" : "1",
              padding: "var(--space-2)",
              minHeight: "var(--size-touch-target)",
              minWidth: "var(--size-touch-target)",
              borderRadius: "var(--radius-md)",
              border: "none",
              cursor: "pointer",
              gap: "var(--space-1)",
              background: item.emphasis
                ? active
                  ? "var(--accent-teal)"
                  : "var(--accent-teal-surface)"
                : active
                  ? "var(--surface-1)"
                  : "transparent",
              color: item.emphasis
                ? active
                  ? "var(--text-on-accent-teal)"
                  : "var(--accent-teal)"
                : active
                  ? "var(--accent-teal)"
                  : "var(--text-muted)",
            }}
          >
            <span aria-hidden="true" className="t-15" style={{ lineHeight: 1 }}>
              {item.glyph}
            </span>
            <span className="t-11 font-light">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
