/**
 * Module Spatial — Prototype luxe hors design system.
 * Ce module est intentionnellement exclu du DS Hearst OS (bg-white, white/N,
 * rounded-2xl, tracking-[0.2em] sont autorisés ici).
 * Voir CLAUDE.md section "Modules hors DS".
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene } from "./components/Scene";
import { AssetDisplay } from "./components/AssetDisplay";
import Image from "next/image";

import { SpatialChatBar } from "./components/SpatialChatBar";
import { ConstellationNav } from "./components/ConstellationNav";

type Stage = "idle" | "focus" | "mission" | "asset";

export default function SpatialOS() {
  const [stage, setStage] = useState<Stage>("idle");

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const handleLogoClick = () => {
    if (stage === "idle") {
      setStage("focus");
    } else if (stage === "focus") {
      setStage("idle");
    }
  };

  const handleChatSubmit = (text: string) => {
    // In a real app, this would send the prompt to the AI
    console.log("User prompt:", text);
    
    // Trigger the mission flow
    setStage("mission");
    
    setTimeout(() => {
      setStage("asset");
    }, 4000);
  };

  const handleCloseAsset = () => {
    setStage("idle");
  };

  // Add a subtle vignette and noise overlay for the cinematic feel
  return (
    <main className="fixed inset-0 w-screen h-screen bg-black overflow-hidden font-sans selection:bg-white/20 z-50">
      {/* 3D Scene Layer */}
      <Scene stage={stage} hoveredNode={hoveredNode} onLogoClick={handleLogoClick} />

      {/* HTML UI Layers */}
      <ConstellationNav stage={stage} onHoverNode={setHoveredNode} />
      <SpatialChatBar stage={stage} onSubmit={handleChatSubmit} />
      <AssetDisplay stage={stage} onClose={handleCloseAsset} />

      {/* Cinematic Overlays */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] z-30" />
      
      {/* Top Navigation (Minimalist) */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-40 pointer-events-none">
        <div className="text-white/40 text-xs tracking-[0.2em] uppercase">Hearst OS</div>
        <div className="flex gap-4">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Instructional text for idle state */}
      <div
        className={`absolute bottom-12 left-1/2 -translate-x-1/2 text-white/30 text-xs tracking-widest uppercase transition-opacity duration-1000 ${
          stage === "idle" ? "opacity-100" : "opacity-0"
        }`}
      >
        Interagissez avec le noyau
      </div>

      {/* Lien discret vers le playground (bas-droite) */}
      <a
        href="/spatial/playground"
        className="absolute bottom-6 right-6 z-40 flex items-center gap-2 text-white/30 hover:text-white/80 text-xs font-light transition-colors"
        title="Comparer les variantes visuelles"
      >
        <span
          className="rounded-full bg-white/30"
          style={{ width: "4px", height: "4px" }}
          aria-hidden
        />
        Playground
      </a>
    </main>
  );
}
