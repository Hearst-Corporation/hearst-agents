"use client";

import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { KgEdge, KgNode } from "@/lib/memory/kg";

// ── Dynamic import Cytoscape (SSR-incompatible) ───────────────────────────────
const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), { ssr: false });

// ── Local interface declarations ───────────────────────────────────────────────
interface CytoscapeElement {
  data: Record<string, unknown>;
  classes?: string;
}

interface CytoscapeStyleEntry {
  selector: string;
  style: Record<string, unknown>;
}

interface CytoscapeCoreLike {
  on: (
    event: string,
    selector: string,
    handler: (evt: { target: { id: () => string } }) => void,
  ) => void;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface KGStageProps {
  mode: string;
}

// ── Animation constants ───────────────────────────────────────────────────────
const SECTION_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const DETAIL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

// ── Node colour palette ───────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  person: "var(--accent-teal, #5ee5c3)",
  company: "var(--warn, #f59e0b)",
  project: "var(--accent-llm, #818cf8)",
  decision: "var(--danger, #ef4444)",
  commitment: "#22c55e",
  topic: "rgba(255,255,255,0.7)",
};
const NODE_COLOR_DEFAULT = "rgba(255,255,255,0.5)";

// ── Stylesheet factory ────────────────────────────────────────────────────────
const buildStylesheet = (highlightIds: Set<string> | null): CytoscapeStyleEntry[] => [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": NODE_COLOR_DEFAULT,
      color: "#fff",
      "font-size": 11,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 4,
      width: 26,
      height: 26,
    },
  },
  // Per-type colours
  ...Object.entries(NODE_COLORS).map(([type, color]) => ({
    selector: `node[type = "${type}"]`,
    style: { "background-color": color },
  })),
  // Highlighted node (search hit)
  {
    selector: "node.kg-hit",
    style: {
      "border-width": 2,
      "border-color": "var(--accent-teal, #5ee5c3)",
    },
  },
  // Dimmed node (not in search results)
  {
    selector: "node.kg-dim",
    style: { opacity: 0.2 },
  },
  {
    selector: "node:selected",
    style: {
      "border-color": "var(--accent-teal, #5ee5c3)",
      "border-width": 2,
    },
  },
  {
    selector: "edge",
    style: {
      "line-color": "rgba(255,255,255,0.15)",
      width: 1,
      label: "data(label)",
      "font-size": 9,
      color: "rgba(255,255,255,0.3)",
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "rgba(255,255,255,0.15)",
    },
  },
];

const LAYOUT = { name: "cose", animate: true, animationDuration: 500 };

// ── Component ─────────────────────────────────────────────────────────────────
export function KGStage({ mode }: KGStageProps) {
  const [graph, setGraph] = useState<{ nodes: KgNode[]; edges: KgEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<KgNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<Set<string> | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch graph on mount ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v2/kg/graph", { credentials: "include" });
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { nodes?: KgNode[]; edges?: KgEdge[] };
        if (cancelled) return;
        setGraph({
          nodes: Array.isArray(data.nodes) ? data.nodes : [],
          edges: Array.isArray(data.edges) ? data.edges : [],
        });
      } catch {
        // graceful fallback — graph stays empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Search with debounce ────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setSearchHits(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/v2/kg/search?q=${encodeURIComponent(searchQuery.trim())}`, {
            credentials: "include",
          });
          if (!res.ok) return;
          const data = (await res.json()) as { nodes?: Array<{ id: string }> };
          const ids = new Set((data.nodes ?? []).map((n) => n.id));
          setSearchHits(ids);
        } catch {
          // ignore
        }
      })();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // ── Cytoscape elements ──────────────────────────────────────────────────────
  const elements: CytoscapeElement[] = [
    ...graph.nodes.map((n) => {
      const classes: string[] = [];
      if (searchHits !== null) {
        if (searchHits.has(n.id)) classes.push("kg-hit");
        else classes.push("kg-dim");
      }
      return {
        data: { id: n.id, label: n.label, type: n.type },
        classes: classes.join(" ") || undefined,
      };
    }),
    ...graph.edges.map((e) => ({
      data: { id: e.id, source: e.source_id, target: e.target_id, label: e.type },
    })),
  ];

  const stylesheet = buildStylesheet(searchHits);

  const onCyInit = (cy: unknown) => {
    const core = cy as CytoscapeCoreLike;
    core.on("tap", "node", (evt) => {
      const id = evt.target.id();
      const node = graph.nodes.find((n) => n.id === id) ?? null;
      setSelectedNode(node);
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Search bar */}
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une entité…"
          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-white placeholder-[rgba(255,255,255,0.3)] outline-none focus:border-[rgba(94,229,195,0.4)] focus:bg-[rgba(255,255,255,0.06)] transition-colors"
        />
      </div>

      {/* Graph container */}
      {loading ? (
        <div className="flex h-[420px] items-center justify-center">
          <span className="text-sm text-[rgba(255,255,255,0.3)] animate-pulse">
            Chargement du graphe…
          </span>
        </div>
      ) : graph.nodes.length === 0 ? (
        /* Empty state */
        <div className="flex h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-8 text-center">
          <span className="text-3xl opacity-20" aria-hidden>
            ◈
          </span>
          <p className="text-[15px] font-medium text-white/80 leading-snug">
            Aucune entité dans le graphe.
          </p>
          <p className="text-[13px] text-[rgba(255,255,255,0.4)] leading-relaxed max-w-xs">
            L&apos;agent enrichit ce graphe automatiquement lors des conversations.
          </p>
        </div>
      ) : (
        /* Cytoscape graph */
        <div className="h-[420px] w-full overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
          <CytoscapeComponent
            elements={elements}
            layout={LAYOUT}
            stylesheet={stylesheet}
            cy={onCyInit}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}

      {/* Selected node detail panel */}
      {selectedNode && (
        <motion.div
          key={selectedNode.id}
          variants={DETAIL_VARIANTS}
          initial="hidden"
          animate="visible"
          className="vision-glass rounded-xl p-6 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-white leading-tight">
              {selectedNode.label}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
              aria-label="Fermer le détail"
            >
              ✕
            </button>
          </div>

          {/* Type badge */}
          <span className="inline-flex w-fit items-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-2.5 py-0.5 text-[11px] font-medium text-[rgba(255,255,255,0.6)]">
            {selectedNode.type}
          </span>

          {/* Properties */}
          {selectedNode.properties &&
            typeof selectedNode.properties === "object" &&
            Object.keys(selectedNode.properties).length > 0 && (
              <dl className="flex flex-col gap-2">
                {Object.entries(selectedNode.properties as Record<string, unknown>).map(
                  ([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] shrink-0 min-w-[80px]">
                        {key}
                      </dt>
                      <dd className="text-[11px] text-[rgba(255,255,255,0.65)] break-words">
                        {String(value)}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            )}
        </motion.div>
      )}
    </motion.section>
  );
}
