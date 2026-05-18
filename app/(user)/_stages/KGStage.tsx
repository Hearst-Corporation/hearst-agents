// lint-visual-disable-file
"use client";

/**
 * KGStage — consumer data-bound du Knowledge Graph.
 *
 * Fetch via GET /api/v2/kg/graph?limit=20, layout SVG custom (positions
 * calculées côté client en cercle). Pas de Cytoscape JS → pas de cy.notify.
 *
 * Pousse dans useStageData.shellData :
 *   - nœud sélectionné (label + type)
 *   - count liaisons
 *   - clusters détectés (composantes connexes simples)
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import type { KgEdge, KgNode } from "@/lib/memory/kg";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Démo dev-only ─────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_NODE_BASE = {
  user_id: "demo",
  tenant_id: "demo",
  created_at: "2026-05-18T08:00:00.000Z",
  updated_at: "2026-05-18T08:00:00.000Z",
  properties: {} as Record<string, unknown>,
};

/** Graphe fictif — affiché uniquement en dev quand aucune donnée réelle. */
const DEMO_GRAPH: { nodes: KgNode[]; edges: KgEdge[] } = {
  nodes: [
    { ...DEMO_NODE_BASE, id: "demo-n1", type: "project", label: "Mission Q2" },
    { ...DEMO_NODE_BASE, id: "demo-n2", type: "company", label: "Client Acme" },
    { ...DEMO_NODE_BASE, id: "demo-n3", type: "person", label: "Camille Roy" },
    { ...DEMO_NODE_BASE, id: "demo-n4", type: "decision", label: "Cadrage budget" },
    { ...DEMO_NODE_BASE, id: "demo-n5", type: "commitment", label: "Livraison 30 mai" },
    { ...DEMO_NODE_BASE, id: "demo-n6", type: "topic", label: "Campagne display" },
    { ...DEMO_NODE_BASE, id: "demo-n7", type: "company", label: "Studio Lumen" },
    { ...DEMO_NODE_BASE, id: "demo-n8", type: "topic", label: "Rapport marché" },
  ],
  edges: [
    {
      id: "demo-e1",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n1",
      target_id: "demo-n2",
      type: "concerne",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e2",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n1",
      target_id: "demo-n3",
      type: "piloté par",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e3",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n1",
      target_id: "demo-n4",
      type: "décide",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e4",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n1",
      target_id: "demo-n5",
      type: "engage",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e5",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n1",
      target_id: "demo-n6",
      type: "porte sur",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e6",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n2",
      target_id: "demo-n3",
      type: "contact",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e7",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n6",
      target_id: "demo-n7",
      type: "réalisé par",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e8",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n4",
      target_id: "demo-n5",
      type: "implique",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e9",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n8",
      target_id: "demo-n2",
      type: "analyse",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
    {
      id: "demo-e10",
      user_id: "demo",
      tenant_id: "demo",
      source_id: "demo-n8",
      target_id: "demo-n6",
      type: "nourrit",
      weight: 1,
      created_at: DEMO_NODE_BASE.created_at,
    },
  ],
};

// ── Variants ─────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: VISION_EASE },
  },
};

// ── Types internes ────────────────────────────────────────────────────────────

interface DisplayNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  cx: number; // % du canvas [0–100]
  cy: number;
  center: boolean;
}

interface DisplayEdge {
  id: string;
  fromId: string;
  toId: string;
  from: DisplayNode;
  to: DisplayNode;
  type: string;
}

type ViewMode = "graph" | "list";

// ── Helpers layout ────────────────────────────────────────────────────────────

function layoutNodes(nodes: KgNode[]): DisplayNode[] {
  const [center, ...rest] = nodes;
  if (!center) return [];
  const result: DisplayNode[] = [
    {
      id: center.id,
      label: center.label,
      type: center.type,
      properties: center.properties as Record<string, unknown>,
      cx: 50,
      cy: 50,
      center: true,
    },
  ];
  rest.forEach((n, i) => {
    const angle = (i / rest.length) * 2 * Math.PI - Math.PI / 2;
    const r = 35;
    result.push({
      id: n.id,
      label: n.label,
      type: n.type,
      properties: n.properties as Record<string, unknown>,
      cx: 50 + r * Math.cos(angle),
      cy: 50 + r * Math.sin(angle),
      center: false,
    });
  });
  return result;
}

function buildEdges(displayNodes: DisplayNode[], apiEdges: KgEdge[]): DisplayEdge[] {
  const nodeMap = new Map(displayNodes.map((n) => [n.id, n]));
  const result: DisplayEdge[] = [];
  for (const e of apiEdges) {
    const from = nodeMap.get(e.source_id);
    const to = nodeMap.get(e.target_id);
    if (from && to) result.push({ id: e.id, fromId: from.id, toId: to.id, from, to, type: e.type });
  }
  return result;
}

/** Composantes connexes (BFS) → nombre de clusters. */
function detectClusters(nodes: DisplayNode[], edges: DisplayEdge[]): number {
  if (nodes.length === 0) return 0;
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.fromId)?.add(e.toId);
    adj.get(e.toId)?.add(e.fromId);
  }
  const visited = new Set<string>();
  let clusters = 0;
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    clusters++;
    const queue = [n.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) queue.push(nb);
      }
    }
  }
  return clusters;
}

/** Compte les arêtes connectées à un nœud. */
function edgeCountForNode(nodeId: string, edges: DisplayEdge[]): number {
  return edges.filter((e) => e.fromId === nodeId || e.toId === nodeId).length;
}

const toSVG = (cx: number, cy: number, w = 760, h = 440) => ({
  x: (cx / 100) * w,
  y: (cy / 100) * h,
});

// ── Node type color ───────────────────────────────────────────────────────────

const NODE_TYPE_COLORS: Record<string, string> = {
  person: "rgba(94,229,195,0.85)",
  company: "rgba(200,160,255,0.85)",
  project: "rgba(255,200,80,0.85)",
  decision: "rgba(255,140,100,0.85)",
  commitment: "rgba(140,200,255,0.85)",
  topic: "rgba(200,200,200,0.7)",
};
function nodeColor(type: string): string {
  return NODE_TYPE_COLORS[type] ?? "rgba(255,255,255,0.65)";
}

// ── Sub-composants ────────────────────────────────────────────────────────────

function EmptyKGState() {
  return (
    <EmptyState
      title="Le graphe de connaissance est vide."
      description="Lance une demande ou connecte des sources pour alimenter le graphe."
      cta={{
        label: "Explorer mes données",
        onClick: () =>
          useStageStore
            .getState()
            .setCommandeurOpen(true, { prefilledQuery: "Explorer mes données" }),
      }}
    />
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(255,80,80,0.08)",
        borderLeft: "2px solid rgba(255,120,120,0.55)",
        color: "rgba(255,200,200,0.85)",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur</strong> —{" "}
      {message}
    </motion.div>
  );
}

// ── GraphView SVG ─────────────────────────────────────────────────────────────

interface GraphViewProps {
  nodes: DisplayNode[];
  edges: DisplayEdge[];
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}

function GraphView({ nodes, edges, selectedNode, onSelectNode }: GraphViewProps) {
  const [visNodes, setVisNodes] = useState<Record<string, boolean>>({});
  const [visEdges, setVisEdges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    nodes.forEach((node, idx) => {
      const delay = node.center ? 80 : 250 + idx * 120;
      timers.push(setTimeout(() => setVisNodes((p) => ({ ...p, [node.id]: true })), delay));
    });
    edges.forEach((edge, idx) => {
      timers.push(
        setTimeout(() => setVisEdges((p) => ({ ...p, [edge.id]: true })), 400 + idx * 140),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [nodes, edges]);

  return (
    <div className="kg-canvas">
      {/* Arêtes SVG */}
      <svg
        viewBox="0 0 760 440"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden="true"
      >
        {edges.map((edge) => {
          const from = toSVG(edge.from.cx, edge.from.cy);
          const to = toSVG(edge.to.cx, edge.to.cy);
          const isHot = selectedNode === edge.fromId || selectedNode === edge.toId;
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={`kg-line${visEdges[edge.id] ? " draw" : ""}`}
              style={isHot ? { stroke: "rgba(94,229,195,0.45)", strokeWidth: 1.5 } : undefined}
            />
          );
        })}
      </svg>

      {/* Nœuds */}
      {nodes.map((node) => {
        const isSelected = selectedNode === node.id;
        const color = nodeColor(node.type);
        return (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            className={`kg-node${node.center ? " center" : ""}${visNodes[node.id] ? " vis" : ""}${isSelected ? " sel" : ""}`}
            style={{ left: `${node.cx}%`, top: `${node.cy}%`, cursor: "pointer" }}
            onClick={() => onSelectNode(isSelected ? null : node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectNode(isSelected ? null : node.id);
              }
            }}
            title={`${node.label} (${node.type})`}
          >
            {/* Dot couleur type */}
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: color,
                marginRight: 5,
                flexShrink: 0,
                verticalAlign: "middle",
              }}
            />
            <div className="kg-chip">{node.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── ListView ──────────────────────────────────────────────────────────────────

interface ListViewProps {
  nodes: DisplayNode[];
  edges: DisplayEdge[];
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}

function ListView({ nodes, edges, selectedNode, onSelectNode }: ListViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {nodes.map((node) => {
        const count = edgeCountForNode(node.id, edges);
        const isSelected = selectedNode === node.id;
        const color = nodeColor(node.type);
        return (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => onSelectNode(isSelected ? null : node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectNode(isSelected ? null : node.id);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: isSelected ? "rgba(94,229,195,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isSelected ? "rgba(94,229,195,0.2)" : "rgba(255,255,255,0.06)"}`,
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}
            />
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.88)", flex: 1 }}>
              {node.label}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              {node.type}
            </span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
              {count} liaison{count !== 1 ? "s" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({
  node,
  edges,
  onClose,
}: {
  node: DisplayNode;
  edges: DisplayEdge[];
  onClose: () => void;
}) {
  const linkedEdges = edges.filter((e) => e.fromId === node.id || e.toId === node.id);
  const propEntries = Object.entries(node.properties ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.3, ease: VISION_EASE }}
      style={{
        padding: "20px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: "4px",
            }}
          >
            {node.type}
          </p>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 500,
              letterSpacing: "-.015em",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            {node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            fontSize: "14px",
            padding: "4px 10px",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Liaisons */}
      {linkedEdges.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: "8px",
            }}
          >
            Liaisons ({linkedEdges.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {linkedEdges.slice(0, 6).map((e) => {
              const other = e.fromId === node.id ? e.to : e.from;
              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.03)",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.4)", flex: 1 }}>{e.type}</span>
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>{other.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propriétés */}
      {propEntries.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: "8px",
            }}
          >
            Propriétés
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {propEntries.slice(0, 8).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.35)", minWidth: "80px" }}>{k}</span>
                <span style={{ color: "rgba(255,255,255,0.7)", wordBreak: "break-all" }}>
                  {String(v).length > 80 ? `${String(v).slice(0, 77)}…` : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface KGStageProps {
  mode: string;
}

// ── Composant principal ───────────────────────────────────────────────────────

export function KGStage({ mode }: KGStageProps) {
  const [nodes, setNodes] = useState<DisplayNode[]>([]);
  const [edges, setEdges] = useState<DisplayEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");

  // Fetch graph
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/v2/kg/graph?limit=20", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const g = json as Partial<{ nodes: KgNode[]; edges: KgEdge[] }>;
        const rawNodes = Array.isArray(g.nodes) ? g.nodes : [];
        const rawEdges = Array.isArray(g.edges) ? g.edges : [];
        const dn = layoutNodes(rawNodes);
        const de = buildEdges(dn, rawEdges);
        setNodes(dn);
        setEdges(de);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(sanitizeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Dev only : si aucune donnée réelle, on injecte un graphe fictif via les
  // helpers de layout existants (renderer SVG inchangé). En prod : inchangé.
  const isDemo = IS_DEV && !loading && !error && nodes.length === 0;
  const displayNodes = useMemo<DisplayNode[]>(
    () => (isDemo ? layoutNodes(DEMO_GRAPH.nodes) : nodes),
    [isDemo, nodes],
  );
  const displayEdges = useMemo<DisplayEdge[]>(
    () => (isDemo ? buildEdges(layoutNodes(DEMO_GRAPH.nodes), DEMO_GRAPH.edges) : edges),
    [isDemo, edges],
  );

  // Push railItems → ContextRail
  const clusters = useMemo(
    () => detectClusters(displayNodes, displayEdges),
    [displayNodes, displayEdges],
  );
  const selectedDisplayNode = useMemo(
    () => (selectedNode ? (displayNodes.find((n) => n.id === selectedNode) ?? null) : null),
    [selectedNode, displayNodes],
  );

  useEffect(() => {
    const items: RailItem[] = [];

    if (selectedDisplayNode) {
      const linkCount = edgeCountForNode(selectedDisplayNode.id, displayEdges);
      items.push({ t: selectedDisplayNode.label, s: selectedDisplayNode.type, hot: true });
      items.push({ t: "Liaisons", s: String(linkCount) });
    } else {
      if (displayNodes.length > 0)
        items.push({ t: "Nœud central", s: displayNodes[0]?.label ?? "—" });
      items.push({ t: "Entités", s: String(displayNodes.length) });
      items.push({ t: "Relations", s: String(displayEdges.length) });
      if (clusters > 1) items.push({ t: "Clusters", s: String(clusters) });
    }

    useStageData.getState().setShellData("Entités liées", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [selectedDisplayNode, displayNodes, displayEdges, clusters]);

  const isEmpty = !loading && !error && displayNodes.length === 0;
  const headerTitle = selectedDisplayNode
    ? `${selectedDisplayNode.label} — nœud central`
    : displayNodes.length > 0
      ? `${displayNodes[0]?.label ?? "Graphe"} — ${displayNodes.length} entité${displayNodes.length > 1 ? "s" : ""}`
      : "Knowledge Graph";

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      {/* Badge démo dev-only */}
      {isDemo && (
        <span
          className="t-9 font-mono uppercase self-start"
          style={{
            padding: "var(--space-1) var(--space-2)",
            color: "var(--text-faint)",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          Démo · données fictives (dev)
        </span>
      )}

      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: "rgba(255,255,255,.35)",
          }}
        >
          {loading ? "Chargement…" : "Knowledge Graph · entités · relations"}
        </p>
        <h1 style={{ fontSize: "30px", fontWeight: 500, letterSpacing: "-.02em" }}>
          {loading ? "Knowledge Graph" : headerTitle}
        </h1>
        {!loading && !error && displayNodes.length > 0 && (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,.5)" }}>
            {displayEdges.length} liaison{displayEdges.length !== 1 ? "s" : ""}
            {clusters > 1 ? ` · ${clusters} cluster${clusters > 1 ? "s" : ""}` : ""}
          </p>
        )}
      </header>

      {/* Loading skeleton */}
      {loading && <div className="h-[300px] animate-pulse rounded-xl bg-white/5" />}

      {/* Error */}
      {!loading && error && <ErrorBanner message={error} />}

      {/* Empty state */}
      {isEmpty && <EmptyKGState />}

      {/* Contenu principal */}
      {!loading && !error && displayNodes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Vue Graph ou Liste */}
          {viewMode === "graph" ? (
            <GraphView
              nodes={displayNodes}
              edges={displayEdges}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          ) : (
            <ListView
              nodes={displayNodes}
              edges={displayEdges}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          )}

          {/* Panneau détail nœud sélectionné */}
          <AnimatePresence mode="wait">
            {selectedDisplayNode && (
              <DetailPanel
                key={selectedDisplayNode.id}
                node={selectedDisplayNode}
                edges={displayEdges}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </AnimatePresence>

          {/* Footer toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "4px",
              padding: "8px 0",
            }}
          >
            {(["graph", "list"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: `1px solid ${viewMode === m ? "rgba(94,229,195,0.3)" : "rgba(255,255,255,0.08)"}`,
                  background: viewMode === m ? "rgba(94,229,195,0.08)" : "transparent",
                  color: viewMode === m ? "rgba(94,229,195,0.85)" : "rgba(255,255,255,0.4)",
                  transition: "all 0.15s",
                }}
              >
                {m === "graph" ? "Graphe" : "Liste"}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
