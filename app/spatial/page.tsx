/**
 * Module Spatial — Prototype luxe hors design system.
 * Ce module est intentionnellement exclu du DS Hearst OS.
 * Voir CLAUDE.md section "Modules hors DS".
 */
"use client";

import { useState } from "react";
import { SpatialLayout } from "@/components/spatial/core/SpatialLayout";
import { AmbientBackground } from "@/components/spatial/background/AmbientBackground";
import { SpatialOverlayManager } from "@/components/spatial/overlays/SpatialOverlayManager";
import { SpatialHUD } from "@/components/spatial/overlays/SpatialHUD";

// Composants legacy — intacts, refactorisables plus tard
import { Scene } from "./components/Scene";
import { AssetDisplay } from "./components/AssetDisplay";
import { SpatialChatBar } from "./components/SpatialChatBar";
import { ConstellationNav } from "./components/ConstellationNav";

type Stage = "idle" | "focus" | "mission" | "asset";

export default function SpatialOS() {
  const [stage, setStage] = useState<Stage>("idle");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const handleLogoClick = () => {
    setStage((s) => (s === "idle" ? "focus" : s === "focus" ? "idle" : s));
  };

  const handleChatSubmit = (text: string) => {
    console.log("User prompt:", text);
    setStage("mission");
    setTimeout(() => setStage("asset"), 5000);
  };

  const handleCloseAsset = () => setStage("idle");

  return (
    <SpatialLayout>
      <SpatialOverlayManager>
        {/* Backgrounds */}
        <AmbientBackground
          baseColor="#020202"
          ambientColor="rgba(20,20,20,0.5)"
          vignetteOpacity={0.95}
        />

        {/* 3D Scene */}
        <Scene stage={stage} hoveredNode={hoveredNode} onLogoClick={handleLogoClick} />

        {/* HTML UI Layers */}
        <ConstellationNav stage={stage} onHoverNode={setHoveredNode} />
        <SpatialChatBar stage={stage} onSubmit={handleChatSubmit} />
        <AssetDisplay stage={stage} onClose={handleCloseAsset} />

        {/* HUD */}
        <SpatialHUD
          topLeft={
            <div className="text-white/20 text-[10px] tracking-[0.4em] uppercase font-light">
              Hearst OS
            </div>
          }
          topRight={
            <div className="flex gap-6 opacity-50">
              <div className="w-1 h-1 rounded-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              <div className="w-1 h-1 rounded-full bg-white/10" />
            </div>
          }
        />

        {/* Idle prompt */}
        <div
          className={`absolute bottom-16 left-1/2 -translate-x-1/2 text-white/20 text-[10px] tracking-[0.3em] uppercase font-light transition-opacity duration-1000 pointer-events-none ${
            stage === "idle" ? "opacity-100" : "opacity-0"
          }`}
          style={{ zIndex: 25 }}
        >
          Interagissez avec le noyau
        </div>
      </SpatialOverlayManager>
    </SpatialLayout>
  );
}
