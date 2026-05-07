"use client";

/**
 * AgentsStrip — Strate 2.5 du ContextRail.
 *
 * 6 agents en strip horizontale, icônes SVG distinctes par rôle, underline
 * cykan sur l'agent actif, ring cykan sur l'agent sélectionné. Click →
 * useSelectionStore.select({ kind: "agent", id }).
 *
 * La constellation WebGL (SystemConstellation) reste au-dessus — cette strip
 * est la couche lisible et cliquable qui la complète.
 *
 * Spec : docs/screens/right-panel-dashboard.md
 */

import type { FC } from "react";
import { useMemo } from "react";
import { useSelectionStore } from "@/stores/selection";
import { useRuntimeStore } from "@/stores/runtime";
import {
  AGENT_METADATA,
  deriveActiveRolesFromEvents,
  type AgentRoleId,
} from "@/lib/cockpit/agents";

const AGENT_ORDER: AgentRoleId[] = [
  "pulse",
  "cortex",
  "delve",
  "warden",
  "scribe",
  "pilot",
];

// ── Icônes SVG distinctes par rôle ───────────────────────────
// Inspirées des maquettes : chaque rôle a une signature visuelle propre.

function PulseIcon({ active }: { active: boolean }) {
  const c = active ? "var(--cykan)" : "var(--text-ghost)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="2" y="10" width="3" height="6" rx="1" fill={c} opacity={0.6} />
      <rect x="7" y="5"  width="3" height="12" rx="1" fill={c} />
      <rect x="12" y="7" width="3" height="9"  rx="1" fill={c} opacity={0.8} />
      <rect x="17" y="12" width="3" height="4" rx="1" fill={c} opacity={0.5} />
    </svg>
  );
}

function CortexIcon({ active }: { active: boolean }) {
  const c = active ? "var(--cykan)" : "var(--text-ghost)";
  const r = 7;
  const cx = 11, cy = 11;
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.5} fill={c} opacity={i % 2 ? 0.6 : 1} />
      ))}
      <circle cx={cx} cy={cy} r={2} fill={c} opacity={0.9} />
    </svg>
  );
}

function DelveIcon({ active }: { active: boolean }) {
  const c = active ? "var(--cykan)" : "var(--text-ghost)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx="11" cy="11" r="4" stroke={c} strokeWidth="1" opacity={0.6} />
      <circle cx="11" cy="11" r="1.5" fill={c} />
    </svg>
  );
}

function WardenIcon({ active }: { active: boolean }) {
  const c = active ? "var(--cykan)" : "var(--text-ghost)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 3 L19 6.5 V11.5 C19 15.5 15.5 18.8 11 20 C6.5 18.8 3 15.5 3 11.5 V6.5 L11 3Z"
        stroke={c}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 11 L10 13 L14 9" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScribeIcon({ active }: { active: boolean }) {
  const c = active ? "var(--cykan)" : "var(--text-ghost)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="3" width="14" height="17" rx="2" stroke={c} strokeWidth="1.5" />
      <line x1="7" y1="8"  x2="15" y2="8"  stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="11" x2="15" y2="11" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="14" x2="11" y2="14" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PilotIcon({ active }: { active: boolean }) {
  const c = active ? "var(--cykan)" : "var(--text-ghost)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" />
      <circle cx="11" cy="11" r="4.5" stroke={c} strokeWidth="1" opacity={0.6} />
      <line x1="11" y1="3" x2="11" y2="5.5"  stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="16.5" x2="11" y2="19" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="11" x2="5.5" y2="11"  stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16.5" y1="11" x2="19" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11" cy="11" r="1.8" fill={c} />
    </svg>
  );
}

const AGENT_ICONS: Record<AgentRoleId, FC<{ active: boolean }>> = {
  pulse:  PulseIcon,
  cortex: CortexIcon,
  delve:  DelveIcon,
  warden: WardenIcon,
  scribe: ScribeIcon,
  pilot:  PilotIcon,
};

// ──────────────────────────────────────────────────────────────

export function AgentsStrip() {
  const events = useRuntimeStore((s) => s.events);
  const selection = useSelectionStore((s) => s.current);
  const select = useSelectionStore((s) => s.select);

  const activeRoles = useMemo(
    () => new Set(deriveActiveRolesFromEvents(events).map((r) => r.id)),
    [events],
  );

  const selectedId =
    selection?.kind === "agent" ? (selection.id as AgentRoleId) : null;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: "var(--space-3)" }}
      >
        <span
          className="t-9 font-medium uppercase tracking-wide"
          style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}
        >
          Agents
        </span>
        <span className="t-9 font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
          {activeRoles.size > 0 ? `${activeRoles.size} actif${activeRoles.size > 1 ? "s" : ""}` : "6"}
        </span>
      </div>

      {/* Strip */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--space-2)" }}>
        {AGENT_ORDER.map((id) => {
          const isActive = activeRoles.has(id);
          const isSelected = selectedId === id;
          const Icon = AGENT_ICONS[id];
          const meta = AGENT_METADATA[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => select({ kind: "agent", id, label: meta.label })}
              aria-label={meta.label}
              aria-pressed={isSelected}
              className="flex flex-col items-center focus:outline-none focus-visible:ring-1 group"
              style={{
                gap: "var(--space-1)",
                padding: "var(--space-2) var(--space-1)",
                borderRadius: "var(--radius-sm)",
                background: isSelected
                  ? "color-mix(in srgb, var(--cykan) 8%, transparent)"
                  : "transparent",
                border: isSelected
                  ? "1px solid var(--cykan-border)"
                  : "1px solid transparent",
                transition: "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
                ["--tw-ring-color" as string]: "var(--cykan)",
              }}
            >
              <Icon active={isActive} />
              <span
                className="t-9 font-light"
                style={{
                  color: isActive || isSelected ? "var(--text-l2)" : "var(--text-faint)",
                  transition: "color var(--duration-fast) var(--ease-out)",
                }}
              >
                {meta.label}
              </span>
              {/* Underline actif */}
              <span
                aria-hidden
                style={{
                  display: "block",
                  height: "2px",
                  width: isActive ? "var(--space-4)" : "0",
                  background: "var(--cykan)",
                  borderRadius: "var(--radius-pill)",
                  boxShadow: isActive ? "var(--shadow-neon-cykan)" : "none",
                  transition: "width var(--duration-base) var(--ease-out)",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
