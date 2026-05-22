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
      <div className="preserve-3d relative flex min-w-0 flex-1 overflow-hidden">
        {/* Main content area — unique conteneur de scroll */}
        <div className="preserve-3d relative flex min-w-0 flex-1 flex-col">
          {/* Centre scrollable — translateZ(-15px) pour profondeur subtile */}
          <main
            id="main-content"
            className={
              "vision-content-depth preserve-3d flex flex-1 flex-col pt-6 px-4 md:px-6 " +
              (scrollable ? "overflow-y-auto " : "")
            }
            style={{
              paddingBottom: composer ? "var(--pb-with-composer)" : "var(--space-6)",
            }}
          >
            {centerContent}
          </main>

          {/* Fade noir bas — masque le texte qui défile sous le composer */}
          {composer && (
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 left-0"
              style={{
                height: "var(--pb-with-composer)",
                zIndex: "var(--z-pulsebar)",
                background:
                  "linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 80%, transparent) 50%, transparent 100%)",
              }}
            />
          )}

          {/* Composer chat — ancré en bas, au-dessus du fade */}
          {composer && (
            <div
              className="absolute right-0 bottom-0 left-0 pointer-events-none flex justify-center"
              style={{
                paddingBottom: "var(--space-6)",
                zIndex: "var(--z-dropdown)",
              }}
            >
              <div className="pointer-events-auto w-full flex justify-center">{composer}</div>
            </div>
          )}
        </div>

        <RightRailChat />
      </div>

      <ChatDrawer />
    </div>
  );
}
