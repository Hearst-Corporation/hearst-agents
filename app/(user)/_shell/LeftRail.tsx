"use client";

import { useSession } from "next-auth/react";
import { type StagePayload, useStageStore } from "@/stores/stage";
import { STAGE_REGISTRY } from "../_stages/registry";
import type { StageKey } from "../_stages/types";
import { STAGE_ICON } from "./stage-icons";

/**
 * LeftRail — barre d'activité verticale (navigation Stages).
 *
 * Refonte navigation 2026-05-18 : la rail 88px redevient la navigation
 * VISUELLE de premier niveau. Les 12 Stages y sont tous accessibles en
 * 1 clic, groupés logiquement (Primaire / Création / Live / Savoir /
 * Système), icône + tooltip (label + hotkey) + état actif.
 *
 * Pourquoi : le footer n'expose que 3 Stages (Dashboard/Chat/Demandes)
 * et le reste n'était atteignable que par ⌘K ou hotkey — invisible pour
 * qui ne les connaît pas. La rail rend tout découvrable sans alourdir le
 * centre (icônes seules, 88px inchangé).
 *
 * Couches complémentaires conservées :
 *   - Footer (StageFooter)   = raccourci des 3 Stages primaires
 *   - Commandeur (⌘K)        = recherche + actions, accès expert
 *   - Hotkeys ⌘1..9 / ⌘0     = accès clavier
 *
 * `asset_compare` est exclu de la rail : mode contextuel ouvert depuis
 * le Stage Asset, pas une destination de premier niveau.
 *
 * Largeur 88px conservée — contrat layout Shell.tsx (LOCKED).
 */

// ── Groupes logiques (ordre top → bottom) ─────────────────────────────

interface NavGroup {
  id: string;
  stages: readonly StageKey[];
}

const NAV_GROUPS: readonly NavGroup[] = [
  { id: "primaire", stages: ["cockpit", "chat", "mission"] },
  { id: "creation", stages: ["asset", "artifact", "simulation"] },
  { id: "live", stages: ["browser", "voice", "meeting"] },
  { id: "savoir", stages: ["kg", "signal"] },
  { id: "systeme", stages: ["connections"] },
] as const;

/**
 * Construit le StagePayload pour un Stage. Les modes à ID requis
 * (mission / asset / browser / meeting) reçoivent le dernier ID connu
 * ou une valeur vide — les Stages rendent alors leur état idle/empty
 * (jamais de crash, cf. hardening flow it.1-8).
 */
function payloadFor(key: StageKey): StagePayload {
  const s = useStageStore.getState();
  switch (key) {
    case "mission":
      return { mode: "mission", missionId: s.lastMissionId ?? "" };
    case "asset":
      return { mode: "asset", assetId: s.lastAssetId ?? "" };
    case "browser":
      return { mode: "browser", sessionId: "" };
    case "meeting":
      return { mode: "meeting", meetingId: "" };
    default:
      return { mode: key } as StagePayload;
  }
}

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
        className="size-9 rounded-full object-cover"
        style={{ boxShadow: "var(--shadow-inset-highlight)" }}
      />
    );
  }
  return (
    <div
      className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm text-white"
      style={{ boxShadow: "var(--shadow-inset-highlight)" }}
      aria-label={`Session ${name}`}
      title={name}
    >
      <span className="opacity-90">{initial}</span>
    </div>
  );
}

interface RailButtonProps {
  label: string;
  hint?: string;
  tagline?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function RailButton({ label, hint, tagline, active, onClick, children }: RailButtonProps) {
  const tooltip = hint
    ? tagline
      ? `${label} · ${hint} · ${tagline}`
      : `${label} · ${hint}`
    : tagline
      ? `${label} · ${tagline}`
      : label;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tooltip}
      aria-current={active ? "page" : undefined}
      title={tooltip}
      className={`group relative flex size-11 items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] ${
        active ? "text-white" : "text-(--text-ghost) hover:text-(--text-soft)"
      }`}
      style={{ background: active ? "var(--surface-1)" : "transparent" }}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
          style={{
            width: "var(--space-0-5)",
            height: "var(--space-5)",
            background: "var(--accent-teal)",
          }}
        />
      )}
      {children}
    </button>
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

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="my-1 shrink-0"
      style={{
        width: "var(--space-6)",
        height: "1px",
        background: "var(--border-default)",
      }}
    />
  );
}

// ── Composant principal ──────────────────────────────────────────────

export function LeftRail() {
  const currentMode = useStageStore((s) => s.current.mode);
  const setMode = useStageStore((s) => s.setMode);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const commandeurOpen = useStageStore((s) => s.commandeurOpen);

  return (
    <aside aria-label="Navigation principale" className="relative z-20 h-full w-[88px] shrink-0">
      <div className="vision-glass vision-rail-left preserve-3d flex h-full w-full flex-col items-center border-y-0 border-l-0 py-5">
        {/* Brand logo */}
        <div className="mb-3 flex size-8 items-center justify-center" aria-hidden>
          <img src="/hearst-h.svg" alt="" className="size-7 opacity-90" />
        </div>

        {/* Navigation Stages — groupes logiques, scrollable si déborde */}
        <nav
          aria-label="Stages"
          className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto"
          style={{ gap: "var(--space-1)", scrollbarWidth: "none" }}
        >
          {NAV_GROUPS.map((group, gi) => (
            <div
              key={group.id}
              className="flex flex-col items-center"
              style={{ gap: "var(--space-1)" }}
            >
              {gi > 0 && <Divider />}
              {group.stages.map((key) => {
                const def = STAGE_REGISTRY[key];
                const Icon = STAGE_ICON[key];
                return (
                  <RailButton
                    key={key}
                    label={def.navLabel}
                    hint={def.hotkey}
                    tagline={def.tagline}
                    active={currentMode === key}
                    onClick={() => setMode(payloadFor(key))}
                  >
                    <Icon />
                  </RailButton>
                );
              })}
            </div>
          ))}

          {/* Commandeur — recherche / accès expert */}
          <Divider />
          <RailButton
            label="Commandeur"
            hint="Recherche et actions (⌘K)"
            active={commandeurOpen}
            onClick={() => setCommandeurOpen(true)}
          >
            <CommandeurIcon />
          </RailButton>
        </nav>

        {/* Avatar — session */}
        <div className="mt-3 shrink-0">
          <UserAvatar />
        </div>
      </div>
    </aside>
  );
}
