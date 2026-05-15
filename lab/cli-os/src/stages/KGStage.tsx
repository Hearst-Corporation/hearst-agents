import { useEffect, useState } from "react";

const TEAL = "#4A8B86";

interface KGNode {
  id: string;
  label: string;
  x: number; // % left
  y: number; // % top
  center?: boolean;
}

const NODES: KGNode[] = [
  { id: "marie", label: "Marie Dupont", x: 50, y: 50, center: true },
  { id: "atlante", label: "Atlante VC", x: 22, y: 25 },
  { id: "term", label: "Term Sheet", x: 72, y: 22 },
  { id: "meeting", label: "Réunion 14/05", x: 78, y: 62 },
  { id: "hearst", label: "Projet Hearst", x: 25, y: 72 },
  { id: "thomas", label: "Thomas Baret", x: 55, y: 82 },
];

const EDGES: [string, string][] = [
  ["marie", "atlante"],
  ["marie", "term"],
  ["marie", "meeting"],
  ["marie", "hearst"],
  ["marie", "thomas"],
  ["atlante", "term"],
  ["hearst", "thomas"],
];

function pct(nodes: KGNode[], id: string): { cx: number; cy: number } {
  const n = nodes.find((n) => n.id === id)!;
  return { cx: n.x, cy: n.y };
}

export function KGStage() {
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    NODES.forEach((node, i) => {
      setTimeout(() => {
        setVisible((prev) => new Set([...prev, node.id]));
      }, 120 * i);
    });
  }, []);

  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Knowledge Graph · entités · relations
        </span>
        <h2
          className="text-3xl font-medium"
          style={{ letterSpacing: "-0.02em", color: "rgba(255,255,255,0.95)" }}
        >
          Marie Dupont — 12 entités liées.
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          15 arêtes · cluster atlante-q3
        </p>
      </div>

      {/* Canvas */}
      <div
        className="relative overflow-hidden rounded-[18px]"
        style={{
          height: 460,
          background: `radial-gradient(circle at 50% 50%, ${TEAL}0d 0%, transparent 70%), rgba(255,255,255,0.02)`,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* SVG edges */}
        <svg
          className="absolute inset-0"
          style={{ width: "100%", height: "100%" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <style>{`
              @keyframes dash-draw {
                to { stroke-dashoffset: 0; }
              }
            `}</style>
          </defs>
          {EDGES.map(([a, b]) => {
            const from = pct(NODES, a);
            const to = pct(NODES, b);
            return (
              <line
                key={`${a}-${b}`}
                x1={from.cx}
                y1={from.cy}
                x2={to.cx}
                y2={to.cy}
                stroke={`${TEAL}55`}
                strokeWidth="0.4"
                strokeDasharray="2 1"
                style={{
                  animation: "dash-draw 1.5s linear forwards",
                  strokeDashoffset: 0,
                }}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {NODES.map((node) => (
          <div
            key={node.id}
            className="absolute transition-opacity duration-500 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              opacity: visible.has(node.id) ? 1 : 0,
            }}
          >
            <div
              className="px-3 py-1.5 rounded-full whitespace-nowrap"
              style={{
                background: node.center ? "rgba(255,255,255,0.92)" : "rgba(14,14,14,0.85)",
                border: node.center ? "none" : `1px solid rgba(255,255,255,0.18)`,
                backdropFilter: "blur(8px)",
                color: node.center ? "black" : "rgba(255,255,255,0.8)",
                fontSize: node.center ? 13 : 11,
                fontWeight: node.center ? 600 : 400,
                boxShadow: node.center ? `0 0 0 6px ${TEAL}22` : "none",
              }}
            >
              {node.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
