"use client";

import type { ReactNode } from "react";
import "@/styles/spatial/spatial.css";
import type { SpatialStage } from "@/lib/spatial/types";
import { SpatialMotionProvider } from "@/providers/spatial/SpatialMotionProvider";
import { SpatialMouseProvider } from "@/providers/spatial/SpatialMouseProvider";
import { SpatialStageProvider } from "@/providers/spatial/SpatialStageProvider";
import { SpatialThemeProvider } from "@/providers/spatial/SpatialThemeProvider";

interface SpatialLayoutProps {
  children: ReactNode;
  initialStage?: SpatialStage;
  className?: string;
}

/**
 * Shell racine du Spatial Mode.
 * Pose les 3 providers (theme, motion, stage) et le conteneur isolé.
 * Doit wrapper toute page spatiale.
 */
export function SpatialLayout({ children, initialStage = "idle", className }: SpatialLayoutProps) {
  return (
    <SpatialThemeProvider>
      <SpatialMotionProvider>
        <SpatialMouseProvider>
          <SpatialStageProvider initialStage={initialStage}>
            <main
              className={`spatial-root fixed inset-0 w-[100dvw] h-[100dvh] overflow-hidden font-sans selection:bg-white/20 ${className ?? ""}`}
              style={{ background: "var(--sp-bg, #000000)" }}
            >
              {children}
            </main>
          </SpatialStageProvider>
        </SpatialMouseProvider>
      </SpatialMotionProvider>
    </SpatialThemeProvider>
  );
}
