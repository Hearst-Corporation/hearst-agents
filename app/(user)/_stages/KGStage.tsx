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
import { VISION_EASE } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

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
// Données fonctionnelles — conservées en JS (couleurs sémantiques par type de nœud)
const NODE_TYPE_COLORS: Record<string, string> = {
  person: "var(--accent-teal)",
  company: "var(--accent-llm)",
  project: "var(--accent-agent)",
  decision: "var(--danger)",
  commitment: "var(--dataviz-commitment)",
  topic: "var(--text-muted)",
};
function nodeColor(type: string): string {
  return NODE_TYPE_COLORS[type] ?? "var(--text-muted)";
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
      className="px-4.5 py-3.5 rounded-xl bg-(--danger)/8 border-l-2 border-(--danger)/55 text-(--danger)/85 t-13 leading-comfortable"
    >
      <strong className="text-(--danger)/95 font-semibold">Erreur</strong> — {message}
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
        className="absolute inset-0 size-full"
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
              // stroke dynamique conditionnel — conservé en style JS
              style={isHot ? { stroke: "var(--accent-teal-border)", strokeWidth: 1.5 } : undefined}
            />
          );
        })}
      </svg>

      {/* Nœuds */}
      {nodes.map((node) => {
        const isSelected = selectedNode === node.id;
        // color = dynamique via nodeColor(node.type) → conservé en style JS
        const color = nodeColor(node.type);
        return (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            className={`kg-node${node.center ? " center" : ""}${visNodes[node.id] ? " vis" : ""}${isSelected ? " sel" : ""} cursor-pointer`}
            // left/top = positions dynamiques du graphe → conservés en style JS
            style={{ left: `${node.cx}%`, top: `${node.cy}%` }}
            onClick={() => onSelectNode(isSelected ? null : node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectNode(isSelected ? null : node.id);
              }
            }}
            title={`${node.label} (${node.type})`}
          >
            {/* Dot couleur type — background dynamique via color → conservé en style JS */}
            <span
              aria-hidden="true"
              className="inline-block rounded-full shrink-0 align-middle"
              style={{
                width: "var(--size-dot)",
                height: "var(--size-dot)",
                marginRight: "var(--space-dot-gap)",
                background: color,
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
    <div className="flex flex-col gap-1">
      {nodes.map((node) => {
        const count = edgeCountForNode(node.id, edges);
        const isSelected = selectedNode === node.id;
        // color = dynamique via nodeColor(node.type) → conservé en style JS
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
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-card cursor-pointer transition-[background,border-color] border ${
              isSelected
                ? "bg-(--accent-teal)/7 border-(--accent-teal)/20"
                : "bg-(--surface-1) border-(--line-strong)"
            }`}
          >
            {/* Dot couleur type — background dynamique → conservé en style JS */}
            <span
              aria-hidden="true"
              className="size-2 rounded-full shrink-0"
              style={{ background: color }}
            />
            <span className="t-13 text-(--text-soft) flex-1">{node.label}</span>
            <span className="t-11 text-(--text-ghost) uppercase tracking-eyebrow">{node.type}</span>
            <span className="t-11 text-(--text-decor-25)">
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
      className="p-5 rounded-xl bg-(--bg-elev) border border-(--line-strong) flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-11 text-(--text-ghost) uppercase tracking-caption mb-1">{node.type}</p>
          <h3 className="t-18 font-medium tracking-tight text-(--text-soft)">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau"
          className="bg-(--surface-2) border border-(--line-strong) rounded-lg text-(--text-faint) cursor-pointer t-14 px-2.5 py-1 shrink-0 focus-visible:ring-1 focus-visible:ring-(--accent-teal)/50 focus-visible:outline-none"
        >
          ✕
        </button>
      </div>

      {/* Liaisons */}
      {linkedEdges.length > 0 && (
        <div>
          <p className="t-11 text-(--text-ghost) uppercase tracking-caption mb-2">
            Liaisons ({linkedEdges.length})
          </p>
          <div className="flex flex-col gap-1">
            {linkedEdges.slice(0, 6).map((e) => {
              const other = e.fromId === node.id ? e.to : e.from;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-(--surface-1) t-13"
                >
                  <span className="text-(--text-faint) flex-1">{e.type}</span>
                  <span className="text-(--text-muted)">{other.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propriétés */}
      {propEntries.length > 0 && (
        <div>
          <p className="t-11 text-(--text-ghost) uppercase tracking-caption mb-2">Propriétés</p>
          <div className="flex flex-col gap-1">
            {propEntries.slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex gap-2 px-2.5 py-1.5 rounded-lg bg-(--surface-1) t-13">
                <span className="text-(--text-ghost) min-w-20">{k}</span>
                <span className="text-(--text-muted) break-all">
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

  // Push railItems → ContextRail
  const clusters = useMemo(() => detectClusters(nodes, edges), [nodes, edges]);
  const selectedDisplayNode = useMemo(
    () => (selectedNode ? (nodes.find((n) => n.id === selectedNode) ?? null) : null),
    [selectedNode, nodes],
  );

  useEffect(() => {
    const items: RailItem[] = [];

    if (selectedDisplayNode) {
      const linkCount = edgeCountForNode(selectedDisplayNode.id, edges);
      items.push({ t: selectedDisplayNode.label, s: selectedDisplayNode.type, hot: true });
      items.push({ t: "Liaisons", s: String(linkCount) });
    } else {
      if (nodes.length > 0) items.push({ t: "Nœud central", s: nodes[0]?.label ?? "—" });
      items.push({ t: "Entités", s: String(nodes.length) });
      items.push({ t: "Relations", s: String(edges.length) });
      if (clusters > 1) items.push({ t: "Clusters", s: String(clusters) });
    }

    useStageData.getState().setShellData("Entités liées", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [selectedDisplayNode, nodes, edges, clusters]);

  const isEmpty = !loading && !error && nodes.length === 0;
  const headerTitle = selectedDisplayNode
    ? `${selectedDisplayNode.label} — nœud central`
    : nodes.length > 0
      ? `${nodes[0]?.label ?? "Graphe"} — ${nodes.length} entité${nodes.length > 1 ? "s" : ""}`
      : "Knowledge Graph";

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      {/* Header */}
      <header className="flex flex-col gap-2">
        <p className="t-13 uppercase tracking-caption text-(--text-ghost)">
          {loading ? "Chargement…" : "Knowledge Graph · entités · relations"}
        </p>
        <h1 className="t-30 font-medium tracking-tight">
          {loading ? "Knowledge Graph" : headerTitle}
        </h1>
        {!loading && !error && nodes.length > 0 && (
          <p className="t-14 text-(--text-faint)">
            {edges.length} liaison{edges.length !== 1 ? "s" : ""}
            {clusters > 1 ? ` · ${clusters} cluster${clusters > 1 ? "s" : ""}` : ""}
          </p>
        )}
      </header>

      {/* Loading skeleton */}
      {loading && <div className="h-75 animate-pulse rounded-xl bg-(--surface-icon-tile)" />}

      {/* Error */}
      {!loading && error && <ErrorBanner message={error} />}

      {/* Empty state */}
      {isEmpty && <EmptyKGState />}

      {/* Contenu principal */}
      {!loading && !error && nodes.length > 0 && (
        <div className="flex flex-col gap-5">
          {/* Vue Graph ou Liste */}
          {viewMode === "graph" ? (
            <GraphView
              nodes={nodes}
              edges={edges}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          ) : (
            <ListView
              nodes={nodes}
              edges={edges}
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
                edges={edges}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </AnimatePresence>

          {/* Footer toggle */}
          <div className="flex justify-center gap-1 py-2">
            {(["graph", "list"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-4 py-1.5 rounded-lg t-13 font-medium cursor-pointer transition-all border ${
                  viewMode === m
                    ? "border-(--accent-teal)/30 bg-(--accent-teal)/8 text-(--accent-teal)/85"
                    : "border-(--line-strong) bg-transparent text-(--text-faint)"
                }`}
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
