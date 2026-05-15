"use client";

/**
 * OrbeCentral — Cœur du cockpit.
 *
 * CSS pur, pas de SVG complexe, pas de canvas.
 * Un simple div rond avec des gradients et une animation de respiration.
 */

export function OrbeCentral() {
  return (
    <div
      style={{
        position: "relative",
        width: 200,
        height: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Anneau rotatif — CSS pur */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "0.5px solid var(--border-subtle)",
          animation: "rotate-slow-clockwise 40s linear infinite",
          backdropFilter: "blur(var(--blur-xs))",
          WebkitBackdropFilter: "blur(var(--blur-xs))",
        }}
      />

      {/* Trait dashé */}
      <div
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: "50%",
          border: "0.5px dashed var(--border-default)",
          animation: "rotate-slow-clockwise 60s linear infinite reverse",
          backdropFilter: "blur(var(--blur-xs))",
          WebkitBackdropFilter: "blur(var(--blur-xs))",
        }}
      />

      {/* Corps */}
      <div
        className="orbe-body"
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Particules */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="orbe-particle"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            animationDelay: `${-i * 3}s`,
            animationDuration: `${12 + i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
