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
 *   - centerContent : ReactNode du stage actif
 *   - composer : ReactNode optionnel ancré en bas (chat input)
 *
 * ⚠️ LOCKED après P2 — aucun stage ne doit modifier ce fichier.
 * Si bug shell détecté en P5+, retour P2 par Adrien explicitement.
 *
 * Source : port direct de `lab/cli-os/src/scenes/CockpitScene.tsx`.
 */

import type { ReactNode } from "react";

import { AmbientLayers } from "./AmbientLayers";
import { ChatDrawer } from "./ChatDrawer";
import { LeftRail } from "./LeftRail";
import { RightRailChat } from "./RightRailChat";

export type ShellProps = {
  centerContent: ReactNode;
  composer?: ReactNode;
  scrollable?: boolean;
};

export function Shell({ centerContent, composer, scrollable = true }: ShellProps) {
  return (
    <div className="perspective-scene relative flex h-screen w-screen overflow-hidden bg-black text-white">
      <AmbientLayers />

      <LeftRail />

      {/* Zone principale : centre scrollable + RightRail */}
      <div className="preserve-3d relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="preserve-3d relative flex min-h-0 flex-1 overflow-hidden">
          {/* Main content area (Scrollable + Floating Footer ancré dessus) */}
          <div className="preserve-3d relative flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Centre scrollable — translateZ(-15px) pour profondeur subtile */}
            <main
              id="main-content"
              className={
                "vision-content-depth preserve-3d flex flex-1 flex-col pt-6 px-4 md:px-6 " +
                (scrollable ? "overflow-y-auto " : "") +
                (composer ? "pb-48 2xl:pb-56" : "pb-6")
              }
            >
              {centerContent}
            </main>

            {/* Fade noir bas — masque le texte qui défile sous le composer */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-32 2xl:h-40"
              style={{
                background:
                  "linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 80%, transparent) 40%, transparent 100%)",
              }}
            />

            {/* Composer chat — remplace le FloatingFooter (P8) */}
            {composer && (
              <div
                className="absolute right-0 bottom-0 left-0 z-30 pointer-events-none flex justify-center"
                style={{
                  paddingBottom: "var(--space-6)",
                }}
              >
                <div className="pointer-events-auto w-full flex justify-center">{composer}</div>
              </div>
            )}
          </div>

          <RightRailChat />
        </div>
      </div>

      <ChatDrawer />
    </div>
  );
}
