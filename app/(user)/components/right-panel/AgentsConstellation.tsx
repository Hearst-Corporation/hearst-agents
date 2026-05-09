"use client";

/**
 * AgentsConstellation — hexagone 2D décoratif des 6 agents Hearst.
 *
 * SVG pur, responsive, décoratif uniquement (pas de click).
 * Couleur lue via var(--cykan) et var(--text-l2).
 * Les 6 nœuds sont positionnés en cercle régulier (hexagone).
 */

const DEG = Math.PI / 180;

const AGENTS = [
  { id: "cortex",  label: "Cortex",  angle: -30 },
  { id: "delve",   label: "Delve",   angle:  30 },
  { id: "pilot",   label: "Pilot",   angle:  90 },
  { id: "scribe",  label: "Scribe",  angle: 150 },
  { id: "warden",  label: "Warden",  angle: 210 },
  { id: "pulse",   label: "Pulse",   angle: 270 },
] as const;

const CX = 100;
const CY = 82;
const R  = 54;
const DOT_R = 3;

function labelAnchor(angle: number): { anchor: "start" | "end" | "middle"; dx: number; dy: number } {
  const norm = ((angle % 360) + 360) % 360;
  if (norm > 15 && norm < 165)  return { anchor: "start",  dx:  8, dy:  4 };
  if (norm > 195 && norm < 345) return { anchor: "end",    dx: -8, dy:  4 };
  if (norm <= 15 || norm >= 345) return { anchor: "middle", dx:  0, dy: -8 };
  return { anchor: "middle", dx: 0, dy: 14 };
}

export function AgentsConstellation() {
  return (
    <div
      style={{ height: "var(--height-agent-constellation)", width: "100%" }}
      aria-hidden
    >
      <svg
        viewBox="0 0 200 164"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        {/* Arêtes de l'hexagone — lignes reliant les nœuds adjacents */}
        {AGENTS.map((agent, i) => {
          const next = AGENTS[(i + 1) % AGENTS.length];
          const x1 = CX + R * Math.cos(agent.angle * DEG);
          const y1 = CY + R * Math.sin(agent.angle * DEG);
          const x2 = CX + R * Math.cos(next.angle * DEG);
          const y2 = CY + R * Math.sin(next.angle * DEG);
          return (
            <line
              key={`edge-${agent.id}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--border-soft)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Nœuds + labels */}
        {AGENTS.map((agent) => {
          const x = CX + R * Math.cos(agent.angle * DEG);
          const y = CY + R * Math.sin(agent.angle * DEG);
          const { anchor, dx, dy } = labelAnchor(agent.angle);
          return (
            <g key={agent.id}>
              <circle
                cx={x} cy={y} r={DOT_R}
                fill="var(--cykan)"
                style={{ filter: "drop-shadow(0 0 4px var(--cykan))" }}
              />
              <text
                x={x + dx}
                y={y + dy}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="var(--text-l2)"
                style={{ fontSize: 9, fontFamily: "inherit", fontWeight: 400 }}
              >
                {agent.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
