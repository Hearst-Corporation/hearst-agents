"use client";

/**
 * AmbientLayers — deux couches de profondeur sous tout le shell visionOS.
 *
 * 1. Halo blanc doux centré sur la hero zone (auréole de focus, mix-blend
 *    naturel via radial-gradient + blur 50px).
 * 2. Pattern dots teal (signature Hearst), blurré + masqué en ellipse
 *    centrale pour créer une profondeur identitaire.
 *
 * Port direct de `lab/cli-os/src/scenes/CockpitScene.tsx` (AmbientLayers).
 * Posé en `position: absolute inset-0` derrière tout le contenu (z-0,
 * pointer-events none).
 */
export function AmbientLayers() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 38% 32% at 50% 42%, color-mix(in srgb, var(--text) 10%, transparent), transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 32%, transparent) 0.8px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          backgroundPosition: "0 0",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 0%, var(--overlay-scrim) 50%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 0%, var(--overlay-scrim) 50%, transparent 90%)",
          opacity: 0.65,
        }}
      />
    </>
  );
}
