/**
 * Canvas SVG du pipeline IA — 10 nodes, 10 edges, flow gauche → droite.
 *
 * Architecture deux couches :
 *   - SVG (cables) : viewBox aligné sur les coords topology, preserveAspectRatio
 *     "none" pour stretch et remplir la frame entièrement (l'aspect du viewBox
 *     est calé très proche de l'aire dispo dans CanvasShell, distorsion
 *     imperceptible sur les courbes Bézier).
 *   - HTML (cards) : `pipeline-node-layer` avec cards positionnées en %, mêmes
 *     ratios que le viewBox SVG → ports CSS et paths SVG s'alignent quel que
 *     soit le scale.
 *
 * La frame remplit 100% × 100% de l'aire disponible (parent flex de
 * CanvasShell). Pas d'aspect-ratio CSS : on laisse le SVG/HTML stretcher,
 * la topology est dimensionnée pour rester lisible quel que soit le ratio
 * réel.
 */

"use client";

import type { CSSProperties } from "react";
import {
  EDGES,
  NODES,
  VIEWBOX_H,
  VIEWBOX_W,
  type CanvasNode,
  type NodeId,
} from "./topology";
import FlowEdge from "./FlowEdge";
import { useCanvasStore, type NodeState } from "./store";

const KIND_BY_ID: Record<NodeId, string> = {
  entry: "entry",
  router: "router",
  safety: "check",
  intent: "intent",
  preflight: "check",
  tools: "tools",
  agent: "agent",
  research: "search",
  pipeline: "llm",
  complete: "complete",
};

const STATE_LABEL: Record<NodeState, string> = {
  idle: "",
  active: "En cours",
  success: "Réussi",
  failed: "Échec",
  blocked: "Bloqué",
  disabled: "Inactif",
};

interface CardProps {
  node: CanvasNode;
  index: number;
  state: NodeState;
  selected: boolean;
  onSelect: () => void;
}

function NodeCard({ node, index, state, selected, onSelect }: CardProps) {
  const stepCode = String(index + 1).padStart(2, "0");
  const showPill = state !== "idle" && state !== "disabled";
  const cardStyle = {
    "--pl-left": `${(node.x / VIEWBOX_W) * 100}%`,
    "--pl-top": `${(node.y / VIEWBOX_H) * 100}%`,
    "--pl-width": `${(node.width / VIEWBOX_W) * 100}%`,
    "--pl-height": `${(node.height / VIEWBOX_H) * 100}%`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="pipeline-card"
      data-kind={KIND_BY_ID[node.id]}
      data-state={state}
      data-selected={selected || undefined}
      onClick={onSelect}
      style={cardStyle}
    >
      <div className="pipeline-card-row pipeline-card-row-top">
        <span className="pipeline-kicker">{stepCode}</span>
      </div>
      <div className="pipeline-card-row pipeline-card-row-label">
        <span className="pipeline-card-label">{node.label}</span>
      </div>
      <div className="pipeline-card-row pipeline-card-row-bottom">
        <span className="pipeline-led" aria-hidden="true" />
        {showPill ? (
          <span className="pipeline-state-pill">{STATE_LABEL[state]}</span>
        ) : null}
      </div>
      <div className="pipeline-progress-rail" aria-hidden="true" />
    </button>
  );
}

export default function FlowCanvas() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId);
  const nodeStates = useCanvasStore((s) => s.nodeStates);

  return (
    <div className="pipeline-canvas-frame absolute inset-0">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {EDGES.map((edge) => (
          <FlowEdge key={edge.id} edge={edge} />
        ))}
      </svg>
      <div className="pipeline-node-layer">
        {NODES.map((node, idx) => (
          <NodeCard
            key={node.id}
            node={node}
            index={idx}
            state={nodeStates[node.id]}
            selected={selectedNodeId === node.id}
            onSelect={() => setSelectedNodeId(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
