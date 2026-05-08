"use client";
// lint-visual-disable-file
// Hex fallbacks pour Three.js Color (la valeur réelle vient de --cykan via getComputedStyle).

/**
 * SystemGraph — Strate 2 du ContextRail.
 *
 * Graph 3D des 6 rôles agents avec particules qui CIRCULENT sur les edges
 * entre rôles co-actifs (vraies "communications" temps réel, pas
 * décoratives). Lib `3d-force-graph` (vanilla three under the hood).
 *
 * Lentille honnête, cf. lib/cockpit/agents.ts :
 *   - Nodes = 6 rôles (pilot/scribe/delve/cortex/pulse/warden)
 *   - Edges = paires co-actives dérivées de deriveCoActivePairs(events)
 *   - Particules sur edges = `linkDirectionalParticles` (lib native)
 *
 * Click node → useSelectionStore.select. Plus de strip SVG redondante.
 *
 * Spec : docs/screens/right-panel-dashboard.md
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useRuntimeStore } from "@/stores/runtime";
import { useSelectionStore } from "@/stores/selection";
import {
  AGENT_ROLES,
  AGENT_METADATA,
  deriveActiveRolesFromEvents,
  deriveCoActivePairs,
  type AgentRoleId,
} from "@/lib/cockpit/agents";

// `3d-force-graph` touche `window` au top-level → import dynamique côté
// client uniquement (cf. useEffect d'init). Sinon SSR crash :
// "window is not defined".
// Lib externe à typing tordu : on utilise `any` localement, scopé.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = any;

// ── Layout fixe hexagonal ────────────────────────────────────

const HEX_RADIUS = 90; // unités world (3d-force-graph utilise des unités plus grandes)
const HEX_ORDER: AgentRoleId[] = [
  "scribe", "pilot", "delve", "cortex", "pulse", "warden",
];

interface NodeData {
  id: AgentRoleId;
  fx: number; // fixed x (force-graph respecte ces positions)
  fy: number;
  fz: number;
  label: string;
}

const NODES: NodeData[] = HEX_ORDER.map((id, i) => {
  const angle = (-90 + i * 60) * (Math.PI / 180);
  return {
    id,
    fx: HEX_RADIUS * Math.cos(angle),
    fy: HEX_RADIUS * Math.sin(angle),
    fz: 0,
    label: AGENT_METADATA[id].label,
  };
});

interface LinkData {
  source: AgentRoleId;
  target: AgentRoleId;
}

// ── Couleur cykan runtime ─────────────────────────────────────

function readCykanHex(): string {
  if (typeof window === "undefined") return "#2dd4bf";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--cykan")
    .trim();
  return v || "#2dd4bf";
}

// ──────────────────────────────────────────────────────────────

export function SystemGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const events = useRuntimeStore((s) => s.events);
  const selection = useSelectionStore((s) => s.current);
  const select = useSelectionStore((s) => s.select);

  // Init une fois.
  useEffect(() => {
    if (!containerRef.current) return;
    const cykan = readCykanHex();
    const faintHex = "#4d5560";

    let cancelled = false;
    void (async () => {
      // Dynamic import : la lib touche `window` au top-level, ne peut pas
      // être chargée en SSR.
      const mod = await import("3d-force-graph");
      if (cancelled || !containerRef.current) return;

      // API officielle : `ForceGraph3D({opts})(element)`, sans `new`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctorFn = mod.default as any;
      const graph: Graph = ctorFn({ controlType: "orbit" })(containerRef.current)
        .width(containerRef.current.clientWidth)
        .height(containerRef.current.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .nodeId("id")
        .nodeLabel((n: NodeData) => n.label)
        .nodeThreeObject((n: NodeData) => {
          const isActive = graph?._activeIds?.has(n.id) ?? false;
          const isSelected = graph?._selectedId === n.id;
          const node = n;
          const group = new THREE.Group();
          void node;
          // Sphère principale
          const sphereR = isActive || isSelected ? 9 : 6;
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(sphereR, 24, 24),
            new THREE.MeshBasicMaterial({
              color: isActive ? cykan : faintHex,
              transparent: true,
              opacity: isActive ? 0.95 : 0.6,
            }),
          );
          group.add(sphere);
          // Glow halo (sprite additif) si actif
          if (isActive || isSelected) {
            const haloGeom = new THREE.SphereGeometry(sphereR * 2.2, 24, 24);
            const haloMat = new THREE.MeshBasicMaterial({
              color: cykan,
              transparent: true,
              opacity: 0.18,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            group.add(new THREE.Mesh(haloGeom, haloMat));
          }
          // Anneau sélection
          if (isSelected) {
            const ringGeom = new THREE.TorusGeometry(sphereR * 1.8, 0.6, 16, 48);
            const ringMat = new THREE.MeshBasicMaterial({ color: cykan });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            group.add(ring);
          }
          return group;
        })
        .linkColor(() => cykan)
        .linkWidth(0.4)
        .linkOpacity(0.55)
        .linkDirectionalParticles(4)
        .linkDirectionalParticleSpeed(0.012)
        .linkDirectionalParticleWidth(2.4)
        .linkDirectionalParticleColor(() => cykan)
        .onNodeClick((n: NodeData) => {
          select({ kind: "agent", id: n.id, label: AGENT_METADATA[n.id].label });
        })
        .enableNodeDrag(false)
        .enableNavigationControls(false)
        .cameraPosition({ x: 0, y: 0, z: 240 });

      // Désactive le force layout — positions fixes (fx, fy, fz)
      graph.d3VelocityDecay(1).d3AlphaDecay(1);
      graph.cooldownTicks(0);

      graphRef.current = graph;

      // État initial
      graph.graphData({
        nodes: NODES.map((n) => ({ ...n })),
        links: [] as LinkData[],
      });
    })();

    return () => {
      cancelled = true;
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [select]);

  // Sync avec runtime events.
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    const activeRoles = deriveActiveRolesFromEvents(events);
    const activeIds = new Set(activeRoles.map((r) => r.id));
    g._activeIds = activeIds;
    const pairs = deriveCoActivePairs(activeRoles);
    const selectedId =
      selection?.kind === "agent" ? (selection.id as AgentRoleId) : null;
    g._selectedId = selectedId;

    g.graphData({
      nodes: NODES.map((n) => ({ ...n })),
      links: pairs.map(([source, target]) => ({ source, target })),
    });
    if (typeof g.refresh === "function") g.refresh();
  }, [events, selection]);

  return (
    <div
      style={{
        position: "relative",
        height: "var(--space-40)",
        width: "100%",
        borderBottom: "1px solid var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} aria-label="Graphe système agents" style={{ position: "absolute", inset: 0 }} />
      {/* Header overlay HTML (label + counter actifs) */}
      <SystemGraphHeader />
      {/* Labels HTML overlay sous les nodes */}
      <NodeLabelsOverlay />
    </div>
  );
}

function SystemGraphHeader() {
  const events = useRuntimeStore((s) => s.events);
  const activeCount = deriveActiveRolesFromEvents(events).length;
  return (
    <div
      className="absolute flex items-center justify-between pointer-events-none"
      style={{
        top: 0,
        left: 0,
        right: 0,
        padding: "var(--space-3) var(--space-4) 0 var(--space-4)",
      }}
    >
      <span
        className="t-9 font-medium uppercase"
        style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}
      >
        Agents
      </span>
      <span className="t-9 font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
        {activeCount > 0 ? `${activeCount} actif${activeCount > 1 ? "s" : ""}` : `${AGENT_ROLES.length}`}
      </span>
    </div>
  );
}

// ── Labels HTML overlay ────────────────────────────────────────
// Les positions des labels sont calculées en mappant (fx, fy) world → écran.
// Pour la simplicité on utilise la projection ortho équivalente : fx ∈ [-90, 90]
// → x% sur le container. Le mapping est approximatif mais fluide pour 6 nodes
// fixes en hexagone.

function NodeLabelsOverlay() {
  const selection = useSelectionStore((s) => s.current);
  const events = useRuntimeStore((s) => s.events);
  const activeIds = new Set(deriveActiveRolesFromEvents(events).map((r) => r.id));
  const selectedId = selection?.kind === "agent" ? (selection.id as AgentRoleId) : null;

  // Bounds : on map fx [-HEX_RADIUS, +HEX_RADIUS] → [15%, 85%] horizontal.
  // fy [-HEX_RADIUS, +HEX_RADIUS] → [80%, 20%] vertical (Y inversé).
  const xScale = 70 / (2 * HEX_RADIUS);
  const yScale = 60 / (2 * HEX_RADIUS);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {NODES.map((n) => {
        const leftPct = 50 + n.fx * xScale;
        const topPct = 50 - n.fy * yScale + 12; // +12% pour mettre le label sous le node
        const isActive = activeIds.has(n.id);
        const isSelected = selectedId === n.id;
        return (
          <span
            key={n.id}
            className="t-9 font-medium absolute whitespace-nowrap"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: "translate(-50%, 0)",
              color: isActive || isSelected ? "var(--text-l2)" : "var(--text-faint)",
              transition: "color var(--duration-base) var(--ease-out)",
              textShadow: "0 0 6px var(--bg)",
            }}
          >
            {n.label}
          </span>
        );
      })}
    </div>
  );
}
