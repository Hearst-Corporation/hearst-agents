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
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(22px) saturate(130%)",
        WebkitBackdropFilter: "blur(22px) saturate(130%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px -16px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  );
}
