"use client";

interface Point { x: number; y: number; }

interface OrbitalConnectionsProps {
  center: Point;
  nodePositions: Point[];
  width: number;
  height: number;
  orbeRadius?: number;
}

export function OrbitalConnections({
  center,
  nodePositions,
  width,
  height,
  orbeRadius = 100,
}: OrbitalConnectionsProps) {
  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
      width={width}
      height={height}
    >
      <defs>
        <filter id="line-glow-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {nodePositions.map((pos, i) => {
          const ax = pos.x - center.x;
          const ay = pos.y - center.y;
          const dist = Math.sqrt(ax * ax + ay * ay) || 1;
          const nx = ax / dist;
          const ny = ay / dist;
          // Départ : bord de l'orbe
          const x1 = center.x + nx * orbeRadius;
          const y1 = center.y + ny * orbeRadius;
          return (
            <linearGradient
              key={i}
              id={`conn-grad-${i}`}
              x1={x1} y1={y1}
              x2={pos.x} y2={pos.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(74,139,134,0)" />
              <stop offset="50%" stopColor="rgba(74,139,134,0.18)" />
              <stop offset="100%" stopColor="rgba(74,139,134,0.45)" />
            </linearGradient>
          );
        })}
      </defs>

      {nodePositions.map((pos, i) => {
        const ax = pos.x - center.x;
        const ay = pos.y - center.y;
        const dist = Math.sqrt(ax * ax + ay * ay) || 1;
        const nx = ax / dist;
        const ny = ay / dist;
        const x1 = center.x + nx * orbeRadius;
        const y1 = center.y + ny * orbeRadius;
        // Arrivée : bord du node (54px = moitié de 108)
        const x2 = pos.x - nx * 54;
        const y2 = pos.y - ny * 40;

        return (
          <line
            key={i}
            x1={x1} y1={y1}
            x2={x2} y2={y2}
            stroke={`url(#conn-grad-${i})`}
            strokeWidth="1"
            filter="url(#line-glow-filter)"
            opacity="0.65"
          />
        );
      })}
    </svg>
  );
}
