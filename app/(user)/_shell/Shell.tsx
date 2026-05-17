"use client";

/**
 * Shell visionOS — composant générique qui orchestre les 4 zones du shell.
 *
 * ╔════════════════════════════════════════════════════════════╗
 * ║ ┌──┐ ┌──────────────────────────────────────┐ ┌──────────┐ ║
 * ║ │L │ │                                      │ │  R Rail  │ ║
 * ║ │R │ │           centerContent              │ │   320px  │ ║
 * ║ │88│ │       (scrollable, depth -15px)      │ │          │ ║
 * ║ │px│ │                                      │ │          │ ║
 * ║ │  │ │                                      │ │          │ ║
 * ║ └──┘ └──────────────────────────────────────┘ └──────────┘ ║
 * ║                  ┌─────────────────────────┐                ║
 * ║                  │   FloatingFooter pill   │                ║
 * ║                  └─────────────────────────┘                ║
 * ╚════════════════════════════════════════════════════════════╝
 *
 * AmbientLayers (halo blanc + dots teal) posé en arrière-plan z-0.
 * Perspective 3D (1200px) sur le conteneur racine → profondeur visionOS.
 *
 * Props :
 *   - centerContent : ReactNode du stage actif (en P4+, c'est <CockpitStage />,
 *     <ChatStage />, etc. — en P2, c'est juste un placeholder)
 *   - railTitle / railItems : alimentent RightRail (texte + cards)
 *   - footer : config FloatingFooter (status + 3 actions + 2 modes)
 *
 * ⚠️ LOCKED après P2 — aucun stage ne doit modifier ce fichier.
 * Si bug shell détecté en P5+, retour P2 par Adrien explicitement.
 *
 * Source : port direct de `lab/cli-os/src/scenes/CockpitScene.tsx`.
 */

import type { ReactNode } from "react";
import type { RailItem } from "../_stages/types";
import { AmbientLayers } from "./AmbientLayers";
import { LeftRail } from "./LeftRail";
import { RightRail } from "./RightRail";

export type ShellProps = {
  centerContent: ReactNode;
  railTitle: string;
  railItems: readonly RailItem[];
  composer?: ReactNode;
};

export function Shell({ centerContent, railTitle, railItems, composer }: ShellProps) {
  return (
    <div className="perspective-scene relative flex h-screen w-screen overflow-hidden bg-black text-white">
      <AmbientLayers />
      <LeftRail />

      {/* Right content area : Center scrollable + RightRail + FloatingFooter */}
      <div className="preserve-3d relative z-10 flex flex-1 overflow-hidden">
        {/* Main content area (Scrollable + Floating Footer ancré dessus) */}
        <div className="preserve-3d relative flex flex-1 flex-col overflow-hidden">
          {/* Centre scrollable — translateZ(-15px) pour profondeur subtile */}
          <main className="vision-content-depth preserve-3d flex flex-1 justify-center overflow-y-auto px-6 pt-8 pb-48 lg:px-8 xl:px-10 2xl:px-16 2xl:pt-16 2xl:pb-56">
            {centerContent}
          </main>

          {/* Fade noir bas — marche de respiration entre scroll et pill footer */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-48"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--mat-200) 45%, transparent) 25%, color-mix(in srgb, var(--mat-200) 92%, transparent) 60%, var(--mat-200) 85%)",
            }}
          />

          {/* Composer chat — remplace le FloatingFooter (P8) */}
          {composer && (
            <div
              className="absolute right-0 bottom-0 left-0 z-25"
              style={{
                background:
                  "linear-gradient(to top, color-mix(in srgb, var(--accent-teal) 10%, rgba(0,0,0,0.75)) 0%, color-mix(in srgb, var(--accent-teal) 4%, rgba(0,0,0,0.35)) 50%, transparent 100%)",
                backdropFilter: "blur(var(--blur-md))",
                WebkitBackdropFilter: "blur(var(--blur-md))",
                boxShadow: "0 -4px 24px color-mix(in srgb, var(--accent-teal) 12%, transparent)",
              }}
            >
              {composer}
            </div>
          )}
        </div>

        <RightRail title={railTitle} items={railItems} />
      </div>
    </div>
  );
}
