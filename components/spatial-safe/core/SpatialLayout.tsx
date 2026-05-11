"use client";

import { type ReactNode } from "react";
import "@/styles/spatial-safe/spatial.css";
import { SpatialThemeProvider } from "@/providers/spatial-safe/SpatialThemeProvider";
import { SpatialMotionProvider } from "@/providers/spatial-safe/SpatialMotionProvider";
import { SpatialStageProvider } from "@/providers/spatial-safe/SpatialStageProvider";
import { SpatialMouseProvider } from "@/providers/spatial-safe/SpatialMouseProvider";
import type { SpatialStage } from "@/lib/spatial-safe/types";

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
export function SpatialLayout({
  children,
  initialStage = "idle",
  className,
}: SpatialLayoutProps) {
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
