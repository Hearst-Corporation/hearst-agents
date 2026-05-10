// lint-visual-disable-file — prototype luxe orbital, palette ad-hoc hors DS
"use client";

const PARTICLES = [
  { x: -30, y: -90, delay: "0s" },
  { x:  80, y: -60, delay: "0.8s" },
  { x:  95, y:  30, delay: "1.6s" },
  { x:  25, y:  95, delay: "2.4s" },
  { x: -85, y:  50, delay: "3.2s" },
  { x: -95, y: -20, delay: "4s" },
];

export function OrbeCentral() {
  return (
    <div style={{ position: "relative", width: 200, height: 200 }}>
      {/* Halo de sol sous l'orbe */}
      <div style={{
        position: "absolute",
        bottom: -30,
        left: "50%",
        transform: "translateX(-50%)",
        width: 280,
        height: 80,
        background: "radial-gradient(ellipse at center, rgba(74,139,134,0.08) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)",
        filter: "blur(24px)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Corps sphérique */}
      <div className="orbe-body" style={{ position: "relative", zIndex: 1 }}>
        {/* Lettre H centrale */}
        <span className="orbe-letter" aria-hidden>H</span>
      </div>

      {/* Anneau SVG rotatif */}
      <svg
        className="orbe-ring-svg"
        viewBox="0 0 240 240"
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          width: 240,
          height: 240,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <defs>
          <linearGradient id="ring-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="55%" stopColor="rgba(74,139,134,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ring-grad-2" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="45%" stopColor="rgba(74,139,134,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="116"
          fill="none"
          stroke="url(#ring-grad-1)"
          strokeWidth="1"
          strokeDasharray="6 18"
          opacity="0.8"
        />
        <circle cx="120" cy="120" r="110"
          fill="none"
          stroke="url(#ring-grad-2)"
          strokeWidth="0.5"
          strokeDasharray="3 30"
          opacity="0.4"
        />
      </svg>

      {/* Halo glow externe pulsant */}
      <div className="orbe-outer-glow" style={{
        position: "absolute",
        top: -20,
        left: -20,
        width: 240,
        height: 240,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Particules flottantes */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="orbe-particle"
          style={{
            position: "absolute",
            left: 100 + p.x,
            top: 100 + p.y,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
