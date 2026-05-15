const TEAL = "#4A8B86";

const SLOTS = [
  {
    id: "v0",
    tag: "Veo 3",
    caption: "Vue urbaine · pluie · réflexion néon",
    gradient: "linear-gradient(160deg, #6c3fff 0%, #3b82f6 100%)",
    state: "loaded" as const,
  },
  {
    id: "v1",
    tag: "Runway gen4",
    caption: "Studio · backlight rose · macro",
    gradient: "linear-gradient(160deg, #f43f8e 0%, #a855f7 100%)",
    state: "loaded" as const,
  },
  {
    id: "v2",
    tag: "Seedance 2",
    caption: "Toit · sunset · drone slow",
    gradient: "linear-gradient(160deg, #f97316 0%, #ef4444 100%)",
    state: "generating" as const,
  },
  {
    id: "v3",
    tag: "Veo 3 · alt",
    caption: "Atelier · faisceau teal · close-up",
    gradient: `linear-gradient(160deg, ${TEAL} 0%, #3b82f6 100%)`,
    state: "generating" as const,
  },
];

export function AssetStage() {
  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Génération vidéo · 4 variants
        </span>
        <h2
          className="text-3xl font-medium"
          style={{ letterSpacing: "-0.02em", color: "rgba(255,255,255,0.95)" }}
        >
          Teaser produit nocturne, 8s.
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Veo 3 · Runway gen4 · Seedance 2 · résolution en 3 passes
        </p>
      </div>

      {/* Grid 2×2 */}
      <div className="grid grid-cols-2 gap-4">
        {SLOTS.map((slot) => (
          <div
            key={slot.id}
            className="relative overflow-hidden rounded-[18px]"
            style={{ aspectRatio: "9/16", maxHeight: 340 }}
          >
            {/* Background gradient */}
            <div className="absolute inset-0" style={{ background: slot.gradient }} />

            {/* Generating sweep animation */}
            {slot.state === "generating" && (
              <>
                {/* Blur overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    backdropFilter: "blur(4px)",
                    background: "rgba(0,0,0,0.3)",
                  }}
                />
                {/* Sweep */}
                <div
                  className="absolute inset-x-0 h-32 animate-bounce"
                  style={{
                    bottom: "20%",
                    background: `linear-gradient(to top, transparent, ${TEAL}55, transparent)`,
                    animationDuration: "2s",
                  }}
                />
              </>
            )}

            {/* Badge */}
            <div className="absolute top-3 left-3">
              <span
                className="font-mono text-[10px] px-2 py-1 rounded-full"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.8)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {slot.tag}
              </span>
            </div>

            {/* Generating indicator */}
            {slot.state === "generating" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.2em] animate-pulse"
                  style={{ color: `${TEAL}cc` }}
                >
                  Génération…
                </div>
              </div>
            )}

            {/* Caption */}
            <div
              className="absolute bottom-0 inset-x-0 px-4 py-3"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
              }}
            >
              <p className="text-xs font-light" style={{ color: "rgba(255,255,255,0.75)" }}>
                {slot.caption}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        4 slots en génération · construction par passes
      </p>
    </div>
  );
}
