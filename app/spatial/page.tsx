/**
 * Module Spatial — Prototype luxe hors design system.
 * Voir CLAUDE.md section "Modules hors DS".
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { SpatialLayout } from "@/components/spatial/core/SpatialLayout";
import { SpatialSignatureScene } from "@/components/spatial/core/SpatialSignatureScene";
import { AmbientBackground } from "@/components/spatial/background/AmbientBackground";
import { SpatialHUD } from "@/components/spatial/overlays/SpatialHUD";
import { CommandBar } from "@/components/spatial/overlays/CommandBar";
import { MissionStatus } from "@/components/spatial/overlays/MissionStatus";
import { ExpertModeAffordance } from "@/components/spatial/overlays/ExpertModeAffordance";
import { OrbAffordance } from "@/components/spatial/overlays/OrbAffordance";
import { ActionRing, type SpatialActionId } from "@/components/spatial/orbital/ActionRing";
import {
  BriefPanel,
  MissionPanel,
  AssetsPanel,
  AssetCard,
} from "@/components/spatial/panels";
import { useSpatialStage } from "@/providers/spatial/SpatialStageProvider";

const MISSION_DURATION_MS = 4500;

export default function SpatialOSPage() {
  return (
    <SpatialLayout initialStage="idle">
      <SpatialOSScene />
    </SpatialLayout>
  );
}

/**
 * State machine :
 *   idle    → noyau seul + label "Cliquer pour orchestrer"
 *   focus   → 3 actions + 3 panels + CommandBar
 *   mission → agents orbitaux + "Mission en cours"
 *   asset   → AssetCard centrée
 *
 * Transitions :
 *   click noyau            → idle ⇄ focus
 *   click "Lancer mission" → focus → mission
 *   Enter dans CommandBar  → focus → mission
 *   click "Voir assets"    → focus → asset
 *   click "Brief"          → reste focus, focus l'input
 *   fin mission (timer)    → mission → asset
 *   close AssetCard        → asset → idle
 */
function SpatialOSScene() {
  const { stage, setStage } = useSpatialStage();
  const [hovered, setHovered] = useState(false);
  const [missionLabel, setMissionLabel] = useState<string>("Mission en cours");
  const missionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearMissionTimer() {
    if (missionTimeoutRef.current) {
      clearTimeout(missionTimeoutRef.current);
      missionTimeoutRef.current = null;
    }
  }

  function startMission(label = "Mission en cours") {
    clearMissionTimer();
    setMissionLabel(label);
    setStage("mission");
    missionTimeoutRef.current = setTimeout(() => {
      setStage("asset");
      missionTimeoutRef.current = null;
    }, MISSION_DURATION_MS);
  }

  useEffect(() => clearMissionTimer, []);

  function handleOrbClick() {
    if (stage === "idle") setStage("focus");
    else if (stage === "focus") setStage("idle");
    else if (stage === "asset") setStage("idle");
  }

  function handleAction(id: SpatialActionId) {
    if (id === "mission") {
      startMission();
    } else if (id === "assets") {
      setStage("asset");
    } else if (id === "brief") {
      // Brief reste sur focus, on signale un focus visuel sur l'input
      const el = document.querySelector<HTMLInputElement>(
        'input[aria-label="Demande à Hearst"]'
      );
      el?.focus();
    }
  }

  function handleSubmit(text: string) {
    startMission(text.length > 56 ? "Mission en cours" : `« ${text} »`);
  }

  function handleAssetClose() {
    setStage("idle");
  }

  // Visibilités dérivées
  const showActions   = stage === "focus";
  const showPanels    = stage === "focus";
  const showCommand   = stage === "focus";
  const showAffordance = stage === "idle";
  const showMissionStatus = stage === "mission";
  const showAssetCard = stage === "asset";

  return (
    <>
      <AmbientBackground
        baseColor="#020203"
        ambientColor="rgba(28,28,32,0.45)"
        vignetteOpacity={0.92}
      />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="absolute inset-0"
      >
        <SpatialSignatureScene
          stage={stage}
          hovered={hovered}
          onOrbClick={handleOrbClick}
        />
      </div>

      {/* Affordance idle — label discret sous le noyau */}
      <OrbAffordance show={showAffordance} hovered={hovered} />

      {/* Anneau d'actions — uniquement au focus */}
      <ActionRing show={showActions} onAction={handleAction} />

      {/* Trois panels contextuels — uniquement au focus */}
      <BriefPanel show={showPanels} count={3} />
      <MissionPanel show={showPanels} state="idle" />
      <AssetsPanel show={showPanels} count={2} />

      {/* Statut mission — uniquement en mission */}
      <MissionStatus show={showMissionStatus} label={missionLabel} />

      {/* Asset Card — uniquement en asset */}
      <AssetCard show={showAssetCard} onClose={handleAssetClose} />

      {/* Barre de commande — uniquement au focus */}
      <CommandBar show={showCommand} onSubmit={handleSubmit} />

      {/* HUD minimal */}
      <SpatialHUD
        topLeft={
          <div className="text-white/30 text-[10px] tracking-[0.42em] uppercase font-light select-none">
            Hearst OS
          </div>
        }
        topRight={
          <div className="flex gap-3 items-center">
            <div
              className="w-1 h-1 rounded-full bg-white/55"
              style={{ boxShadow: "0 0 6px rgba(255,255,255,0.45)" }}
            />
            <div className="w-1 h-1 rounded-full bg-white/15" />
          </div>
        }
      />

      {/* Mode expert — bouton fantôme */}
      <ExpertModeAffordance disabled />
    </>
  );
}
