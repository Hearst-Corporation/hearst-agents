"use client";

import type { ReactNode } from "react";

/**
 * Cadre plein écran pour les routes hors Shell visionOS (pas de LeftRail).
 * À combiner avec <ScreenShell> ou layout custom (ex. reports/studio).
 */
export function StandalonePageFrame({ children }: { children: ReactNode }) {
  return <div className="flex h-screen min-h-0 flex-col overflow-hidden text-text">{children}</div>;
}
