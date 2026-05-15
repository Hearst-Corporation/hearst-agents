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
import type { FooterConfig, RailItem } from "../_stages/types";
import { AmbientLayers } from "./AmbientLayers";
import { FloatingFooter } from "./FloatingFooter";
import { LeftRail } from "./LeftRail";
import { RightRail } from "./RightRail";

export type ShellProps = {
  centerContent: ReactNode;
  railTitle: string;
  railItems: readonly RailItem[];
  footer: FooterConfig;
};

export function Shell({ centerContent, railTitle, railItems, footer }: ShellProps) {
  return (
    <div className="perspective-scene relative flex h-screen w-screen overflow-hidden bg-[#050505] text-white">
      <AmbientLayers />
      <LeftRail />

      {/* Right content area : Center scrollable + RightRail + FloatingFooter */}
      <div className="preserve-3d relative z-10 flex flex-1 overflow-hidden">
        {/* Main content area (Scrollable + Floating Footer ancré dessus) */}
        <div className="preserve-3d relative flex flex-1 flex-col overflow-hidden">
          {/* Centre scrollable — translateZ(-15px) pour profondeur subtile */}
          <main className="vision-content-depth preserve-3d flex flex-1 justify-center overflow-y-auto px-16 pt-20 pb-64">
            {centerContent}
          </main>

          {/* Fade noir bas — marche de respiration entre scroll et pill footer */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-60"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(5,5,5,0.45) 25%, rgba(5,5,5,0.92) 60%, #050505 85%)",
            }}
          />

          <FloatingFooter config={footer} />
        </div>

        <RightRail title={railTitle} items={railItems} />
      </div>
    </div>
  );
}
