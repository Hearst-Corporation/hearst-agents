"use client";

/**
 * StageFooter — Dock de navigation primaire « Factory Cockpit ».
 *
 * Trois zones :
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  Statut agent   │   Dashboard · Chat · Mission   │   Cmd · Date │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Hiérarchie navigation post-pivot Factory Cockpit :
 *   - Footer (ce composant) = navigation PRIMAIRE
 *   - LeftRail              = navigation secondaire / présence système
 *   - Cmd+K / hotkeys ⌘1..9 = accès expert (registry complet des 12 stages)
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

import { useMemo } from "react";
import { useChatStageStore } from "@/stores/chat-stage";
import { useStageStore } from "@/stores/stage";

// ── Helpers ──────────────────────────────────────────────────────────────

function useStatusText() {
  const runState = useChatStageStore((s) => s.runState);
  if (runState === "streaming") return { label: "Run en cours", live: true } as const;
  if (runState === "error") return { label: "Erreur", live: false, error: true } as const;
  return { label: "Prêt", live: false } as const;
}

/** Format court FR : "lun. 16 mai". Stable côté serveur (toLocaleDateString
 *  est déterministe pour `fr-FR`). Recalculé par jour via dateTime ISO. */
function useTodayLabel() {
  const { isoDate, dayLabel } = useMemo(() => {
    const now = new Date();
    return {
      isoDate: now.toISOString().slice(0, 10),
      dayLabel: now.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    };
  }, []);
  return { isoDate, dayLabel };
}

// ── Sub-composants ───────────────────────────────────────────────────────

function StatusPill() {
  const status = useStatusText();
  const dotColor = status.error ? "var(--danger, rgba(255,120,120,0.95))" : "var(--accent-teal)";
  const shadow = status.error
    ? "0 0 0 3px color-mix(in srgb, var(--danger, rgba(255,120,120,0.4)) 18%, transparent)"
    : "var(--shadow-pulse-dot)";

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
      <span className="t-11 font-medium text-(--text-faint)">{status.label}</span>
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
      className="t-12 font-medium"
      style={{
        padding: "var(--space-1-5) var(--space-4)",
        borderRadius: "var(--radius-pill)",
        border: active
          ? "1px solid color-mix(in srgb, var(--accent-teal) 35%, transparent)"
          : "1px solid transparent",
        background: active
          ? "color-mix(in srgb, var(--accent-teal) 14%, transparent)"
          : "transparent",
        color: active ? "var(--text-l1)" : "var(--text-l2)",
        cursor: "pointer",
        transition: "all var(--duration-base) var(--ease-standard)",
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
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const { isoDate, dayLabel } = useTodayLabel();

  return (
    <nav
      aria-label="Navigation principale"
      className="vision-glass preserve-3d flex items-center whitespace-nowrap"
      style={{
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-pill)",
        transform: "translateZ(20px)",
        gap: "var(--space-4)",
      }}
    >
      {/* Zone gauche — statut agent */}
      <div className="flex items-center" style={{ paddingLeft: "var(--space-2)" }}>
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

      {/* Zone centre — Dashboard / Chat / Mission */}
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
          label="Mission"
          hotkey="⌘5"
          active={currentMode === "mission"}
          onClick={() => setMode({ mode: "mission", missionId: lastMissionId ?? "" })}
        />
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

      {/* Zone droite — Commandeur + Date */}
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={() => setCommandeurOpen(true)}
          aria-label="Ouvrir le Commandeur (⌘K)"
          title="Commandeur (⌘K)"
          className="t-12 font-medium"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1-5)",
            padding: "var(--space-1-5) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border-default)",
            background: "color-mix(in srgb, var(--mat-100) 60%, transparent)",
            color: "var(--text-l1)",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true">⌘</span>
          <span>Commandeur</span>
        </button>

        {/* Date — chip informatif non cliquable. Pas de route /agenda. */}
        <time
          dateTime={isoDate}
          className="t-11 font-medium text-(--text-faint)"
          style={{
            padding: "var(--space-1-5) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border-subtle, var(--border-default))",
            background: "color-mix(in srgb, var(--mat-100) 35%, transparent)",
          }}
        >
          {dayLabel}
        </time>
      </div>
    </nav>
  );
}
