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

import { useMemo } from "react";
import { useSelectionStore } from "@/stores/selection";
import { useRuntimeStore } from "@/stores/runtime";
import {
  AGENT_METADATA,
  deriveActiveRolesFromEvents,
  type AgentRoleId,
} from "@/lib/cockpit/agents";
import { AGENT_ICON_MAP } from "./AgentIcons";

const AGENT_ORDER: AgentRoleId[] = [
  "pulse",
  "cortex",
  "delve",
  "warden",
  "scribe",
  "pilot",
];

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
          const Icon = AGENT_ICON_MAP[id];
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
              <Icon color={isActive ? "var(--cykan)" : "var(--text-ghost)"} />
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
