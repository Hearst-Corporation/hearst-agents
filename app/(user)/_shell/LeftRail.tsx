"use client";

import { useSession } from "next-auth/react";
import { useStageStore } from "@/stores/stage";

/**
 * LeftRail — présence système + raccourcis secondaires (Factory Cockpit).
 *
 * Refonte post-pivot navigation 2026-05-16 :
 *   - **Footer** porte désormais la navigation PRIMAIRE
 *     (Dashboard / Chat / Mission + Commandeur + Date).
 *   - LeftRail devient DISCRET : logo, avatar, statut session, et
 *     quelques raccourcis secondaires vers des destinations RÉELLES
 *     (route existante ou ouverture du Commandeur).
 *
 * Aucun bouton ne pointe vers une route inexistante. Les 12 stages
 * restent accessibles via :
 *   - Footer (les 3 plus utilisés : Dashboard, Chat, Mission)
 *   - Hotkeys ⌘1..⌘9 / ⌘0 (cf. app/hooks/use-global-hotkeys.ts)
 *   - Commandeur (⌘K) — registry complet
 *
 * Largeur 88px conservée pour ne pas casser le layout Shell.tsx
 * (composant LOCKED après P2).
 */

// ── Sub-composants ────────────────────────────────────────────────────

function UserAvatar() {
  const { data: session } = useSession();
  const image = session?.user?.image;
  const name = session?.user?.name ?? "?";
  const initial = name.charAt(0).toUpperCase();

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="size-10 rounded-full object-cover"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
      />
    );
  }
  return (
    <div
      className="flex size-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-sm text-white"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
      aria-label={`Session ${name}`}
      title={name}
    >
      <span className="opacity-90">{initial}</span>
    </div>
  );
}

interface SecondaryButtonProps {
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}

function SecondaryButton({ label, hint, onClick, active, children }: SecondaryButtonProps) {
  const tooltip = hint ? `${label} · ${hint}` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tooltip}
      title={tooltip}
      className={`group relative flex size-12 items-center justify-center rounded-xl transition-all duration-200 ${
        active ? "text-white" : "text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.85)]"
      }`}
      style={{
        background: active ? "var(--surface-1)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function ConnectionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="7" x2="5" y2="11" stroke="currentColor" strokeWidth="1.2" />
      <line x1="13" y1="7" x2="13" y2="11" stroke="currentColor" strokeWidth="1.2" />
      <line x1="7" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CommandeurIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <text
        x="9"
        y="12"
        textAnchor="middle"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
        fill="currentColor"
      >
        ⌘
      </text>
    </svg>
  );
}

// ── Composant principal ──────────────────────────────────────────────

export function LeftRail() {
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const commandeurOpen = useStageStore((s) => s.commandeurOpen);

  return (
    <aside aria-label="Navigation secondaire" className="relative z-20 h-full w-[88px] shrink-0">
      <div className="vision-glass vision-rail-left preserve-3d flex h-full w-full flex-col items-center border-y-0 border-l-0 py-6">
        {/* Brand logo — présence système */}
        <div className="mb-4 flex size-8 items-center justify-center" aria-hidden>
          <img src="/hearst-h.svg" alt="" className="size-7 opacity-90" />
        </div>

        {/* Raccourcis secondaires — uniquement routes/actions réelles */}
        <div className="flex flex-col items-center" style={{ gap: "var(--space-2)" }}>
          <SecondaryButton
            label="Connexions"
            hint="Apps et services connectés"
            active={useStageStore((s) => s.current.mode === "connections")}
            onClick={() => useStageStore.getState().setMode({ mode: "connections" })}
          >
            <ConnectionsIcon />
          </SecondaryButton>

          <SecondaryButton
            label="Commandeur"
            hint="Recherche et actions (⌘K)"
            active={commandeurOpen}
            onClick={() => setCommandeurOpen(true)}
          >
            <CommandeurIcon />
          </SecondaryButton>
        </div>

        <div className="flex-1" />

        {/* Avatar — session utilisateur */}
        <div className="mt-2">
          <UserAvatar />
        </div>
      </div>
    </aside>
  );
}
