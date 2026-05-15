export function AmbientLayers() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* White halo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 38% 32% at 50% 42%, rgba(255,255,255,0.10), transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      {/* Teal dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(94,229,195,0.32) 0.8px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          opacity: 0.65,
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black, transparent)",
        }}
      />
    </div>
  );
}
