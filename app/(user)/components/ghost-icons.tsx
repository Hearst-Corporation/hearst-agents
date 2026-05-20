"use client";

import type { ReactNode } from "react";

/**
 * Icônes stroke minimalistes pour PulseBar / MobileBottomNav.
 * currentColor — héritent de text-* du parent.
 */

type IconProps = { className?: string };

function IconBase({
  className,
  children,
  viewBox = "0 0 24 24",
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function GhostIconMenu({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

export function GhostIconCamera({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2" />
      <circle cx="12" cy="12" r="3.5" />
    </IconBase>
  );
}

export function GhostIconTarget({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </IconBase>
  );
}

export function GhostIconWave({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 14c2-4 4-4 6 0s4 4 6 0 4-4 6-4" />
    </IconBase>
  );
}

export function GhostIconCard({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </IconBase>
  );
}
