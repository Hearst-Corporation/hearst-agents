"use client";

/**
 * SystemConstellation — Strate 2 du ContextRail (mode cockpit / chat).
 *
 * 6 rôles agents disposés en hexagone régulier. Chaque rôle est une
 * **lentille honnête** sur les events SSE de l'orchestrateur unique
 * (cf. [lib/cockpit/agents.ts](lib/cockpit/agents.ts)).
 *
 *   - Idle  : couleur var(--text-faint), respiration douce
 *   - Active: var(--cykan), scale légèrement augmenté, halo subtil
 *   - Lignes inter-rôles : tracées uniquement quand 2 rôles sont co-actifs
 *     dans la même runId (≤ CO_ACTIVE_WINDOW_MS d'écart). Aucune ligne
 *     décorative.
 *
 * Click sur un rôle → useSelectionStore.select({ kind: "agent", id }).
 * Aucun side-effect Stage — le switch reste explicite via la Strate 5.
 *
 * Implémentation SVG/CSS (pas R3F). Décision pragmatique 2026-05-04 :
 * @react-three/fiber non installé, et SVG suffit pour 280px de large.
 *
 * Spec : [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md) §5
 */

import { useEffect, useState } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useSelectionStore } from "@/stores/selection";
import {
  AGENT_ROLES,
  AGENT_METADATA,
  deriveActiveRolesFromEvents,
  deriveCoActivePairs,
  type AgentRoleId,
} from "@/lib/cockpit/agents";

const REFRESH_INTERVAL_MS = 500;

// Layout SVG ──────────────────────────────────────────────────
// viewBox 200×180 → ratio compact pour rail 280px (avec padding interne).
const VIEW_W = 200;
const VIEW_H = 180;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const RADIUS = 70;

// Ordre canonique des 6 rôles autour de l'hexagone (12h, 2h, 4h, 6h, 8h, 10h).
// Disposition narrative : Scribe (haut, livraison), Pilot (2h, exécution),
// Delve (4h, lecture), Cortex (6h, mémoire), Pulse (8h, veille),
// Warden (10h, sécurité).
const HEX_ORDER: AgentRoleId[] = ["scribe", "pilot", "delve", "cortex", "pulse", "warden"];

interface NodePos {
  id: AgentRoleId;
  x: number;
  y: number;
}

const NODES: NodePos[] = HEX_ORDER.map((id, i) => {
  // -90° pour mettre le premier en haut, puis +60° par node.
  const angle = (-90 + i * 60) * (Math.PI / 180);
  return {
    id,
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
});

const NODE_BY_ID: Record<AgentRoleId, NodePos> = NODES.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<AgentRoleId, NodePos>,
);

const NODE_R_IDLE = 5;
const NODE_R_ACTIVE = 7;
const NODE_R_HALO = 12;

// ──────────────────────────────────────────────────────────────

export function SystemConstellation() {
  const events = useRuntimeStore((s) => s.events);
  const selection = useSelectionStore((s) => s.current);
  const select = useSelectionStore((s) => s.select);

  // Tick pour décay des activations (TTL 800ms). Plus rapide que la Strate 1
  // car les rôles s'allument/s'éteignent vite. `now` exposé en state pour
  // garder le rendu pur (eslint react-hooks/purity).
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const activeRoles = deriveActiveRolesFromEvents(events, now);
  const activeIds = new Set<AgentRoleId>(activeRoles.map((r) => r.id));
  const pairs = deriveCoActivePairs(activeRoles);

  const selectedId =
    selection?.kind === "agent" ? (selection.id as AgentRoleId) : null;

  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-5)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Constellation système — 6 rôles agents"
        style={{ display: "block" }}
      >
        {/* Lignes inter-rôles co-actifs (rendues en dessous des nodes) */}
        {pairs.map(([a, b], i) => {
          const na = NODE_BY_ID[a];
          const nb = NODE_BY_ID[b];
          return (
            <line
              key={`pair-${i}-${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="var(--cykan)"
              strokeWidth={0.6}
              strokeOpacity={0.6}
              style={{
                animation: "constellation-line-fade 2000ms ease-out forwards",
              }}
            />
          );
        })}

        {/* Nodes */}
        {AGENT_ROLES.map((id) => {
          const pos = NODE_BY_ID[id];
          const isActive = activeIds.has(id);
          const isSelected = selectedId === id;
          const meta = AGENT_METADATA[id];
          return (
            <g
              key={id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => select({ kind: "agent", id, label: meta.label })}
              style={{ cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={meta.label}
              aria-pressed={isSelected}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select({ kind: "agent", id, label: meta.label });
                }
              }}
            >
              {/* Halo actif (rendu en premier pour passer derrière le node) */}
              {isActive && (
                <circle
                  r={NODE_R_HALO}
                  fill="var(--cykan)"
                  opacity={0.18}
                  style={{
                    animation: "constellation-node-pulse 1200ms ease-in-out infinite",
                  }}
                />
              )}
              {/* Halo de sélection (anneau fin) */}
              {isSelected && (
                <circle
                  r={NODE_R_ACTIVE + 3}
                  fill="none"
                  stroke="var(--cykan)"
                  strokeWidth={0.8}
                  strokeOpacity={0.8}
                />
              )}
              {/* Node */}
              <circle
                r={isActive ? NODE_R_ACTIVE : NODE_R_IDLE}
                fill={isActive ? "var(--cykan)" : "var(--text-faint)"}
                style={{
                  transition: "r var(--duration-base) var(--ease-out), fill var(--duration-base) var(--ease-out)",
                }}
              />
              {/* Label sous le node */}
              <text
                y={NODE_R_HALO + 9}
                textAnchor="middle"
                fontSize={8}
                fontWeight={500}
                fill={isActive || isSelected ? "var(--text-l2)" : "var(--text-faint)"}
                style={{
                  fontFamily: "var(--font-satoshi)",
                  pointerEvents: "none",
                }}
              >
                {meta.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
