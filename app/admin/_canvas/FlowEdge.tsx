"use client";

import { useEffect, useState } from "react";
import { type NodeState, useCanvasStore } from "./store";
import { bezierPath, type CanvasEdge, edgePorts, getNode, portAt } from "./topology";

interface Props {
  edge: CanvasEdge;
}

const STROKE = {
  base: 1.4,
  active: 2.8,
} as const;

const TRAIL_TTL_MS = 4000;

function isFailed(from: NodeState, to: NodeState): boolean {
  return from === "failed" || from === "blocked" || to === "failed" || to === "blocked";
}

function isActive(from: NodeState, to: NodeState): boolean {
  if (from === "active" || to === "active") return true;
  if (from === "success" && to !== "idle") return true;
  return false;
}

export default function FlowEdge({ edge }: Props) {
  const fromState = useCanvasStore((s) => s.nodeStates[edge.from]);
  const toState = useCanvasStore((s) => s.nodeStates[edge.to]);
  const trailEntries = useCanvasStore((s) => s.runTrail);

  const [trailNow, setTrailNow] = useState(() => Date.now());

  const fromNode = getNode(edge.from);
  const toNode = getNode(edge.to);
  const dirs = edge.ports ?? edgePorts(fromNode, toNode);
  const a = portAt(fromNode, dirs.out);
  const b = portAt(toNode, dirs.in);
  const d = bezierPath(a, dirs.out, b, dirs.in);

  const failed = isFailed(fromState, toState);
  const active = !failed && isActive(fromState, toState);
  const cableWidth = active ? STROKE.active : STROKE.base;

  const lastTrailTs = trailEntries.reduce(
    (acc, t) => (t.edgeId === edge.id && t.ts > acc ? t.ts : acc),
    0,
  );

  useEffect(() => {
    if (lastTrailTs === 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastTrailTs >= TRAIL_TTL_MS) {
        clearInterval(id);
        return;
      }
      setTrailNow(now);
    }, 120);
    return () => clearInterval(id);
  }, [lastTrailTs]);

  const trailAge = lastTrailTs > 0 ? trailNow - lastTrailTs : Infinity;
  const trailOpacity = trailAge < TRAIL_TTL_MS ? 0.6 * (1 - trailAge / TRAIL_TTL_MS) : 0;

  return (
    <g
      className="pipeline-cable"
      data-branch={edge.branch ?? "pipeline"}
      data-active={active ? "true" : undefined}
      data-failed={failed ? "true" : undefined}
    >
      <path id={edge.id} d={d} className="pipeline-cable-halo" strokeWidth={cableWidth * 3.5} />
      <path d={d} className="pipeline-cable-body" strokeWidth={cableWidth} />
      {!failed && (
        <path d={d} className="pipeline-cable-core" strokeWidth={Math.max(cableWidth * 0.4, 0.6)} />
      )}
      {active && (
        <path d={d} className="pipeline-cable-traffic" strokeWidth={cableWidth * 0.55}>
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-32"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {trailOpacity > 0 && (
        <path
          d={d}
          className="pipeline-cable-trail"
          strokeWidth={STROKE.base + 1.5}
          opacity={trailOpacity}
        />
      )}

      <circle cx={a.x} cy={a.y} r={5} className="pipeline-cable-port-outer" />
      <circle cx={a.x} cy={a.y} r={2} className="pipeline-cable-port-inner" />
      <circle cx={b.x} cy={b.y} r={5} className="pipeline-cable-port-outer" />
      <circle cx={b.x} cy={b.y} r={2} className="pipeline-cable-port-inner" />
    </g>
  );
}
