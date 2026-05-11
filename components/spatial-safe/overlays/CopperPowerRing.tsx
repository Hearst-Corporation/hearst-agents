"use client";

import { useSpatialStage } from "@/providers/spatial-safe/SpatialStageProvider";

export function CopperPowerRing() {
  const { stage } = useSpatialStage();

  // On peut le cacher dans certains stages si besoin, mais par défaut on l'affiche
  const opacity = stage === "idle" || stage === "focus" || stage === "mission" ? 1 : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "80vmin",
        height: "80vmin",
        maxWidth: 320,
        maxHeight: 320,
        pointerEvents: "none",
        zIndex: 10,
        opacity,
        transition: "opacity 0.8s ease",
      }}
    >
      <svg
        className="orbe-ring-svg"
        viewBox="0 0 240 240"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="copper-ring-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="55%" stopColor="rgba(184,115,51,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="copper-ring-grad-2" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="45%" stopColor="rgba(184,115,51,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="116"
          fill="none"
          stroke="url(#copper-ring-grad-1)"
          strokeWidth="1.5"
          strokeDasharray="6 18"
          opacity="0.8"
        />
        <circle cx="120" cy="120" r="110"
          fill="none"
          stroke="url(#copper-ring-grad-2)"
          strokeWidth="1"
          strokeDasharray="3 30"
          opacity="0.4"
        />
      </svg>

      {/* Halo glow externe pulsant */}
      <div className="orbe-outer-glow" style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }} />

      {/* Particules flottantes — positionnées en % relatives au conteneur */}
      {[
        { x: -25,  y: -75,  delay: "0s" },
        { x:  66,  y: -50,  delay: "0.8s" },
        { x:  79,  y:  25,  delay: "1.6s" },
        { x:  21,  y:  79,  delay: "2.4s" },
        { x: -71,  y:  41,  delay: "3.2s" },
        { x: -79,  y: -16,  delay: "4s" },
      ].map((p, i) => (
        <div
          key={i}
          className="orbe-particle"
          style={{
            position: "absolute",
            left: `calc(50% + ${p.x}%)`,
            top: `calc(50% + ${p.y}%)`,
            transform: "translate(-50%, -50%)",
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
