"use client";

/**
 * StageFooter — Dock de navigation primaire « Factory Cockpit ».
 *
 * Trois zones :
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  Statut agent   │   Dashboard · Chat · Demandes   │  Cmd · Date │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Hiérarchie navigation post-pivot Factory Cockpit :
 *   - Footer (ce composant) = navigation PRIMAIRE
 *   - LeftRail              = navigation secondaire / présence système
 *   - Cmd+K / hotkeys ⌘1..9 = accès expert (registry complet des 12 stages)
 *
 * Vocabulaire visible : « Demandes » → code mode `"mission"` (rename UI
 * 2026-05 pour parler à monsieur tout le monde ; types/store/routes
 * inchangés).
 *
 * Aucun élément n'est faussement actif :
 *   - Zone gauche  : <output role="status"> qui lit useChatStageStore.runState
 *   - Zone centre  : 3 <button> câblés à setMode() (cockpit / chat / mission)
 *   - Zone droite  : Commandeur → setCommandeurOpen(true) ; Date → <time>
 *                    non cliquable (pas de fausse route /agenda).
 *
 * Rendu uniquement par ChatDock (cf. ChatDock.tsx:468) au-dessus du
 * composer. Pas de translateX/translateY, le parent gère le placement.
 */

import { useChatStageStore } from "@/stores/chat-stage";
import { useStageStore } from "@/stores/stage";

// ── Helpers ──────────────────────────────────────────────────────────────

function useStatusText() {
  const runState = useChatStageStore((s) => s.runState);
  if (runState === "streaming") return { label: "Run en cours", live: true } as const;
  if (runState === "error") return { label: "Erreur", live: false, error: true } as const;
  return { label: "Prêt", live: false } as const;
}

// ── Sub-composants ───────────────────────────────────────────────────────

function StatusPill() {
  const status = useStatusText();
  const dotColor = status.error ? "var(--text-l1)" : "white";
  const shadow = "none";

  return (
    <output
      className="flex items-center"
      style={{ gap: "var(--space-2-5)" }}
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        aria-hidden="true"
        className={`block shrink-0 ${status.live ? "animate-pulse" : ""}`}
        style={{
          width: "var(--space-1-5)",
          height: "var(--space-1-5)",
          borderRadius: "var(--radius-pill)",
          background: dotColor,
          boxShadow: shadow,
        }}
      />
      <span className="t-11 font-medium text-text-faint">{status.label}</span>
    </output>
  );
}

interface NavButtonProps {
  label: string;
  active: boolean;
  hotkey?: string;
  onClick: () => void;
}

function NavButton({ label, active, hotkey, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={hotkey ? `${label} (${hotkey})` : label}
      title={hotkey ? `${label} (${hotkey})` : label}
      className="t-11 2xl:t-12"
      style={{
        padding: "var(--space-1-5) var(--space-4)",
        borderRadius: "var(--radius-pill)",
        background: active ? "var(--text)" : "transparent",
        color: active ? "var(--bg)" : "var(--text-faint)",
        fontWeight: active ? "var(--weight-semibold)" : "var(--weight-medium)",
        border: "none",
        cursor: "pointer",
        transition: "all var(--duration-fast) var(--ease-out-soft)",
      }}
    >
      {label}
    </button>
  );
}

// ── Composant principal ──────────────────────────────────────────────────

export function StageFooter() {
  const currentMode = useStageStore((s) => s.current.mode);
  const lastMissionId = useStageStore((s) => s.lastMissionId);
  const setMode = useStageStore((s) => s.setMode);

  return (
    <nav
      aria-label="Navigation principale"
      className="flex items-center"
      style={{
        gap: "var(--space-2)",
        paddingLeft: "var(--space-1-5)",
      }}
    >
      {/* Zone gauche — statut agent */}
      <div className="flex items-center" style={{ paddingLeft: "var(--space-1)" }}>
        <StatusPill />
      </div>

      {/* Séparateur */}
      <span
        aria-hidden="true"
        className="shrink-0"
        style={{
          width: "1px",
          height: "var(--space-4)",
          background: "var(--border-default)",
        }}
      />

      {/* Zone centre — Dashboard / Chat / Demandes */}
      <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
        <NavButton
          label="Dashboard"
          hotkey="⌘1"
          active={currentMode === "cockpit"}
          onClick={() => setMode({ mode: "cockpit" })}
        />
        <NavButton
          label="Chat"
          hotkey="⌘2"
          active={currentMode === "chat"}
          onClick={() => setMode({ mode: "chat" })}
        />
        <NavButton
          label="Demandes"
          hotkey="⌘9"
          active={currentMode === "mission"}
          onClick={() => setMode({ mode: "mission", missionId: lastMissionId ?? "" })}
        />
      </div>
    </nav>
  );
}
