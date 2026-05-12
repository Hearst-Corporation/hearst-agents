"use client";

import { type ReactNode } from "react";

interface CockpitCardShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Coque glassmorphism partagée par toutes les cards du cockpit 3D R&D.
 * Reproduit le style des BentoCard de /spatial mais sans la grille bento
 * (chaque card est positionnée librement dans l'espace).
 */
export function CockpitCardShell({ children, className }: CockpitCardShellProps) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[32px] p-7 ${className ?? ""}`}
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.066), rgba(255,255,255,0.026))",
        backdropFilter: "blur(26px) saturate(120%)",
        WebkitBackdropFilter: "blur(26px) saturate(120%)",
        border: "1px solid rgba(255,255,255,0.095)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.065), 0 24px 54px -36px rgba(0,0,0,0.9)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 68% 42%, rgba(255,255,255,0.075), transparent 30%)",
          opacity: 0.45,
        }}
      />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
