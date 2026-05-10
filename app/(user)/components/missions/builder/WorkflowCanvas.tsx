"use client";
// lint-visual-disable-file — stylesheet Cytoscape et SVG data URIs exigent des hex bruts (var(--token) non supporté par la lib)

/**
 * WorkflowCanvas — rendu Cytoscape du WorkflowGraph.
 *
 * Cytoscape est dynamique import (SSR-incompatible). On expose :
 * - sélection node (click)
 * - création edge (click sur source puis click sur target avec mode "connect")
 * - move via drag (positions remontées via callback)
 *
 * Pas de drag-create node ici — c'est la palette qui ajoute les nodes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { WorkflowGraph } from "@/lib/workflows/types";

// ── SVG data URIs for node icons ───────────────────────────────

function svgUri(content: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
}

function strokeSvg(inner: string, color: string, size = 24): string {
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
  );
}

function fillSvg(inner: string, size = 24): string {
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`,
  );
}

// Triggers
const ICON_MANUAL = strokeSvg(
  `<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>`,
  "#4A8B86",
);
const ICON_CRON = strokeSvg(
  `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  "#4A8B86",
);
const ICON_SIGNAL = strokeSvg(
  `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  "#4A8B86",
);

// App actions (brand colors)
const ICON_GMAIL = fillSvg(
  `<path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>`,
);
const ICON_SLACK = fillSvg(
  `<path fill="#4A154B" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>`,
);
const ICON_CALENDAR = strokeSvg(
  `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  "#1A73E8",
);
const ICON_DRIVE = fillSvg(
  `<path fill="#34A853" d="M4.433 22.396L1.987 18.028 8.381 7.019l2.449 4.372L4.433 22.396zm5.586-8.697l2.442 4.36H1.985l2.445-4.36h5.589zm.87-1.551L7.513 5.776h9.892l-6.516 6.372z"/>`,
);
const ICON_SEARCH = strokeSvg(
  `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  "#5F6368",
);

// Logic & outputs
const ICON_CONDITION = strokeSvg(
  `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  "#FFCC00",
);
const ICON_TRANSFORM = strokeSvg(
  `<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>`,
  "#9CA3AF",
);
const ICON_APPROVAL = strokeSvg(
  `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  "#FF3333",
);
const ICON_OUTPUT = strokeSvg(
  `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  "#4A8B86",
);

// Maps tool id → icon data URI
const TOOL_ICONS: Record<string, string> = {
  gmail_send: ICON_GMAIL,
  slack_send_message: ICON_SLACK,
  calendar_create_event: ICON_CALENDAR,
  drive_create_doc: ICON_DRIVE,
  search_web: ICON_SEARCH,
};

// Maps trigger mode → icon data URI
const TRIGGER_ICONS: Record<string, string> = {
  manual: ICON_MANUAL,
  cron: ICON_CRON,
  webhook: ICON_SIGNAL,
};

// Maps kind → icon data URI (fallback for logic/output nodes)
const KIND_ICONS: Record<string, string> = {
  condition: ICON_CONDITION,
  transform: ICON_TRANSFORM,
  approval: ICON_APPROVAL,
  output: ICON_OUTPUT,
};

const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), {
  ssr: false,
});

interface CytoscapeElement {
  data: Record<string, unknown>;
  classes?: string;
  position?: { x: number; y: number };
}

interface CytoscapeStyleEntry {
  selector: string;
  style: Record<string, unknown>;
}

interface NodeRunStatus {
  status: "idle" | "running" | "completed" | "failed" | "awaiting_approval" | "skipped";
}

interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  onSelect: (nodeId: string | null) => void;
  onConnect: (source: string, target: string) => void;
  onPositionChange: (nodeId: string, position: { x: number; y: number }) => void;
  /** État runtime des nodes pendant un preview / run pour highlight live. */
  runStatus?: Map<string, NodeRunStatus["status"]>;
}


export function WorkflowCanvas({
  graph,
  selectedNodeId,
  onSelect,
  onConnect,
  onPositionChange,
  runStatus,
}: WorkflowCanvasProps) {
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const cyRef = useRef<unknown | null>(null);
  const viewInitialized = useRef(false);

  const elements = useMemo<CytoscapeElement[]>(() => {
    const nodeEls: CytoscapeElement[] = graph.nodes.map((n) => {
      const classes: string[] = ["wf-node", `wf-node-${n.kind}`];
      if (selectedNodeId === n.id) classes.push("wf-node-selected");
      if (pendingSource === n.id) classes.push("wf-node-source");
      const status = runStatus?.get(n.id);
      if (status) classes.push(`wf-node-status-${status}`);

      // Resolve icon data URI for this node
      let iconUri = "";
      if (n.kind === "tool_call" && typeof n.config?.tool === "string") {
        iconUri = TOOL_ICONS[n.config.tool] ?? "";
      } else if (n.kind === "trigger" && typeof n.config?.mode === "string") {
        iconUri = TRIGGER_ICONS[n.config.mode] ?? ICON_MANUAL;
      } else {
        iconUri = KIND_ICONS[n.kind] ?? "";
      }

      return {
        data: { id: n.id, label: n.label, kind: n.kind, icon: iconUri },
        classes: classes.join(" "),
        position: n.position,
      };
    });
    const edgeEls: CytoscapeElement[] = graph.edges.map((e) => {
      const classes: string[] = ["wf-edge"];
      if (e.condition === "true") classes.push("wf-edge-true");
      else if (e.condition === "false") classes.push("wf-edge-false");
      else if (e.condition === "error") classes.push("wf-edge-error");
      return {
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.condition ?? "",
        },
        classes: classes.join(" "),
      };
    });
    return [...nodeEls, ...edgeEls];
  }, [graph, selectedNodeId, pendingSource, runStatus]);

  const stylesheet = useMemo<CytoscapeStyleEntry[]>(
    () => [
      // ── Base node ───────────────────────────────────────────
      {
        selector: "node",
        style: {
          "background-color": "#16161B",
          "label": "data(label)",
          "color": "#E8E8EE",
          "font-size": 11,
          "font-weight": 500,
          "font-family": "var(--font-satoshi), -apple-system, sans-serif",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-wrap": "ellipsis",
          "text-max-width": "110px",
          "text-margin-y": -10,
          "width": 156,
          "height": 84,
          "shape": "round-rectangle",
          "border-width": 1,
          "border-color": "#2A2A35",
          // Icon from node data
          "background-image": "data(icon)",
          "background-fit": "none",
          "background-clip": "none",
          "background-width": "26px",
          "background-height": "26px",
          "background-position-x": "50%",
          "background-position-y": "30%",
          // Subtle shadow
          "shadow-blur": 12,
          "shadow-color": "#000000",
          "shadow-offset-x": 0,
          "shadow-offset-y": 4,
          "shadow-opacity": 0.5,
        },
      },
      // ── Kind-specific borders + tinted backgrounds ──────────
      {
        selector: "node.wf-node-trigger",
        style: {
          "border-color": "#4A8B8680",
          "background-color": "#0E1F1E",
        },
      },
      {
        selector: "node.wf-node-tool_call",
        style: {
          "border-color": "#2A2A35",
          "background-color": "#16161B",
        },
      },
      {
        selector: "node.wf-node-condition",
        style: {
          "border-color": "#FFCC0060",
          "background-color": "#1C1A0E",
        },
      },
      {
        selector: "node.wf-node-approval",
        style: {
          "border-color": "#FF333360",
          "background-color": "#1C0E0E",
        },
      },
      {
        selector: "node.wf-node-output",
        style: {
          "border-color": "#4A8B8660",
          "background-color": "#0E1F1E",
        },
      },
      {
        selector: "node.wf-node-transform",
        style: {
          "border-color": "#3A3A48",
          "background-color": "#1B1B22",
        },
      },
      // ── Selected ─────────────────────────────────────────────
      {
        selector: "node.wf-node-selected",
        style: {
          "border-width": 2,
          "border-color": "#4A8B86",
          "background-color": "#0E1F1E",
          "shadow-blur": 20,
          "shadow-color": "#4A8B86",
          "shadow-opacity": 0.25,
        },
      },
      // ── Pending connection source ────────────────────────────
      {
        selector: "node.wf-node-source",
        style: {
          "border-width": 2,
          "border-color": "#FFCC00",
          "border-style": "dashed",
        },
      },
      // ── Run status ───────────────────────────────────────────
      {
        selector: "node.wf-node-status-running",
        style: {
          "border-color": "#4A8B86",
          "background-color": "#0E2F2E",
          "color": "#7DCFCA",
          "shadow-color": "#4A8B86",
          "shadow-opacity": 0.4,
          "shadow-blur": 16,
        },
      },
      {
        selector: "node.wf-node-status-completed",
        style: {
          "border-color": "#22C55E60",
          "background-color": "#0E1F14",
          "color": "#86EFAC",
        },
      },
      {
        selector: "node.wf-node-status-failed",
        style: {
          "border-color": "#FF333360",
          "background-color": "#1C0A0A",
          "color": "#FCA5A5",
        },
      },
      {
        selector: "node.wf-node-status-awaiting_approval",
        style: {
          "border-color": "#FFCC0060",
          "background-color": "#1C1A08",
          "color": "#FDE68A",
        },
      },
      {
        selector: "node.wf-node-status-skipped",
        style: { "opacity": 0.35 },
      },
      // ── Edges ─────────────────────────────────────────────────
      {
        selector: "edge",
        style: {
          "width": 1.5,
          "line-color": "#2A2A3A",
          "target-arrow-color": "#3A3A50",
          "target-arrow-shape": "triangle",
          "arrow-scale": 0.8,
          "curve-style": "bezier",
          "label": "data(label)",
          "font-size": 9,
          "font-family": "var(--font-satoshi), -apple-system, sans-serif",
          "text-rotation": "autorotate",
          "color": "#666680",
          "text-background-color": "#16161B",
          "text-background-opacity": 1,
          "text-background-padding": 2,
        },
      },
      {
        selector: "edge.wf-edge-true",
        style: {
          "line-color": "#22C55E60",
          "target-arrow-color": "#22C55E",
        },
      },
      {
        selector: "edge.wf-edge-false",
        style: {
          "line-color": "#FF333360",
          "target-arrow-color": "#FF3333",
        },
      },
      {
        selector: "edge.wf-edge-error",
        style: {
          "line-color": "#FFCC0060",
          "target-arrow-color": "#FFCC00",
          "line-style": "dashed",
        },
      },
    ],
    [],
  );

  // Bind cytoscape events
  useEffect(() => {
    const cy = cyRef.current as unknown as
      | {
          on: (event: string, selector: string | undefined, handler: (...args: unknown[]) => void) => void;
          off: (event: string, selector?: string) => void;
        }
      | null;
    if (!cy) return;

    const handleTapNode = (evt: { target: { id: () => string } }) => {
      const id = evt.target.id();
      if (pendingSource && pendingSource !== id) {
        onConnect(pendingSource, id);
        setPendingSource(null);
        return;
      }
      onSelect(id);
    };

    const handleTapBackground = (evt: { target: unknown }) => {
      // Si target est le `cy` lui-même, c'est un tap sur le fond
      if (evt.target === cy) {
        onSelect(null);
        setPendingSource(null);
      }
    };

    const handleDragFree = (evt: {
      target: { id: () => string; position: () => { x: number; y: number } };
    }) => {
      const id = evt.target.id();
      const pos = evt.target.position();
      onPositionChange(id, { x: pos.x, y: pos.y });
    };

    cy.on("tap", "node", handleTapNode as unknown as (...args: unknown[]) => void);
    cy.on("tap", undefined as unknown as string, handleTapBackground as unknown as (...args: unknown[]) => void);
    cy.on("dragfree", "node", handleDragFree as unknown as (...args: unknown[]) => void);

    return () => {
      cy.off("tap", "node");
      cy.off("tap");
      cy.off("dragfree", "node");
    };
  }, [pendingSource, onConnect, onSelect, onPositionChange]);

  const hasNodes = graph.nodes.length > 0;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: "#000000",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <CytoscapeComponent
        elements={elements}
        layout={{ name: "preset" }}
        stylesheet={stylesheet}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        cy={(rawCy) => {
          const cy = rawCy as {
            ready: (fn: () => void) => void;
            zoom: (z?: number) => number | void;
            center: () => void;
            minZoom: (z: number) => void;
            maxZoom: (z: number) => void;
            on: (e: string, sel: string | undefined, h: (...a: unknown[]) => void) => void;
            off: (e: string, sel?: string) => void;
          };
          cyRef.current = cy;
          if (!viewInitialized.current) {
            viewInitialized.current = true;
            cy.ready(() => {
              cy.minZoom(0.25);
              cy.maxZoom(2.5);
              // Fixed zoom 1 — never auto-fit (prevents single-node zoom horror)
              cy.zoom(1);
              cy.center();
            });
          }
        }}
      />

      {/* Empty state */}
      {!hasNodes && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center" style={{ gap: "var(--space-3)" }}>
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 48,
                height: 48,
                background: "rgba(74,139,134,0.12)",
                border: "1px solid rgba(74,139,134,0.3)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A8B86" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <p className="t-11 font-light" style={{ color: "rgba(255,255,255,0.2)" }}>
              Ajoute un node depuis la Palette →
            </p>
          </div>
        </div>
      )}

      {/* Connection mode hint — only when needed */}
      <div
        className="absolute pointer-events-none flex flex-col"
        style={{ bottom: "var(--space-4)", left: "50%", transform: "translateX(-50%)", gap: "var(--space-2)" }}
      >
        {pendingSource && (
          <div
            className="t-11 font-light pointer-events-auto rounded-md"
            style={{
              padding: "var(--space-2) var(--space-4)",
              background: "rgba(255,204,0,0.12)",
              border: "1px solid rgba(255,204,0,0.3)",
              color: "#FFCC00",
            }}
          >
            Clique sur le node cible pour créer le lien
          </div>
        )}
      </div>

      {/* Connect button — bottom right, only when node selected */}
      {selectedNodeId && (
        <div
          className="absolute"
          style={{ bottom: "var(--space-4)", right: "var(--space-4)" }}
        >
          <button
            type="button"
            onClick={() => {
              if (selectedNodeId === pendingSource) setPendingSource(null);
              else setPendingSource(selectedNodeId);
            }}
            className="t-11 font-medium pointer-events-auto rounded-md transition-[background-color,border-color,color] duration-(--duration-slow) ease-(--ease-standard)"
            style={{
              padding: "var(--space-2) var(--space-3)",
              background: pendingSource === selectedNodeId ? "rgba(255,204,0,0.15)" : "rgba(74,139,134,0.15)",
              border: `1px solid ${pendingSource === selectedNodeId ? "rgba(255,204,0,0.4)" : "rgba(74,139,134,0.4)"}`,
              color: pendingSource === selectedNodeId ? "#FFCC00" : "#4A8B86",
            }}
          >
            {pendingSource === selectedNodeId ? "Annuler" : "Relier →"}
          </button>
        </div>
      )}
    </div>
  );
}
