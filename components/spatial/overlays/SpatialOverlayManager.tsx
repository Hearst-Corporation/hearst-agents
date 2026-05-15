"use client";

import React from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";
import { useFocalStore } from "@/stores/focal";
import { useRuntimeStore } from "@/stores/runtime";
import { AssetCard, AssetsPanel, BriefPanel, MissionPanel, PlanStepCard } from "../panels";
import { ApprovalAlert } from "./ApprovalAlert";
import { CommandBar } from "./CommandBar";
import { SpatialHotkeys } from "./SpatialHotkeys";

const EMPTY_SECONDARY: never[] = [];
const EMPTY_STEPS: never[] = [];

export interface SpatialOverlayManagerProps {
  initialCockpitData?: CockpitTodayPayload | null;
}

export function SpatialOverlayManager({ initialCockpitData = null }: SpatialOverlayManagerProps) {
  const coreState = useRuntimeStore((s) => s.coreState);
  const currentPlan = useRuntimeStore((s) => s.currentPlan);
  const secondary = useFocalStore((s) => s.secondary) ?? EMPTY_SECONDARY;

  const isRunning = coreState === "streaming" || coreState === "processing";
  const isAwaiting = coreState === "awaiting_approval" || coreState === "awaiting_clarification";
  const hasMission = !!currentPlan;
  const hasAssets = secondary.length > 0;

  // P1-1 : steps actifs (running OU awaiting_approval), max 3
  const liveSteps = React.useMemo(
    () =>
      (currentPlan?.steps ?? EMPTY_STEPS)
        .filter((s) => s.status === "running" || s.status === "awaiting_approval")
        .slice(0, 3),
    [currentPlan],
  );

  return (
    <>
      {/* Bento grid — colonne gauche, 4 colonnes × 3 rangées */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start p-6 md:p-10"
        style={{ zIndex: SPATIAL_Z_LAYERS.surface }}
      >
        <div
          className="grid h-[min(640px,80vh)] w-[min(720px,52vw)] gap-4 md:grid-cols-4 grid-cols-1 grid-rows-3"
          style={{
            perspective: "1200px",
          }}
        >
          <BriefPanel show={!isRunning && !hasMission} />
          <MissionPanel show={isRunning || isAwaiting || hasMission} />
          <AssetsPanel show={!isRunning && hasAssets} />

          {/* P1-1 : steps éphémères en bas de la grille */}
          {liveSteps.map((step, i) => (
            <PlanStepCard key={step.id} step={step} delay={i * 0.1} />
          ))}
        </div>
      </div>

      {/* P1-3 : alerte HITL top-right */}
      <ApprovalAlert />

      {/* P1-2 : asset card center */}
      <AssetCard />

      {/* Chat Bar */}
      <CommandBar show={true} />

      {/* P1-5 : hotkeys globaux Cmd+K, Cmd+7 */}
      <SpatialHotkeys />

      {/* Reserve l'usage futur de la donnée cockpit pour P2 — pour l'instant
          on l'ignore tant que les overlays P2 ne sont pas montés. */}
      {initialCockpitData ? null : null}
    </>
  );
}
