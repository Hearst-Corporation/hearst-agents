"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { BentoCard } from "./BentoCard";
import { MiniChart } from "./MiniChart";

interface MissionPanelProps {
  show: boolean;
}

const MAX_LATENCY_MS = 5000;

/**
 * Mission — bento tall (col 1 × row 2).
 *
 * Source : `useRuntimeStore.currentPlan` (Mission Control B1).
 * Affiche le step "running" courant + chart de latence des steps passés.
 *
 * Click → `setMode({ mode: 'mission', missionId: planId })` puis push '/'
 * pour reprendre le MissionStage classique.
 */
export function MissionPanel({ show }: MissionPanelProps) {
  const router = useRouter();
  const currentPlan = useRuntimeStore((s) => s.currentPlan);
  const coreState = useRuntimeStore((s) => s.coreState);

  const running = currentPlan?.status === "running" || coreState === "streaming";
  const awaiting = currentPlan?.status === "awaiting_approval" || coreState === "awaiting_approval";

  const currentStepLabel = useMemo(() => {
    if (!currentPlan) return null;
    const runningStep = currentPlan.steps.find(
      (s) => s.status === "running" || s.status === "awaiting_approval",
    );
    return runningStep?.label ?? null;
  }, [currentPlan]);

  const stepsCount = currentPlan?.steps.length ?? 0;
  const doneCount = currentPlan?.steps.filter((s) => s.status === "done").length ?? 0;

  const chartHeights = useMemo(() => {
    if (!currentPlan) return undefined;
    const latencies = currentPlan.steps
      .filter((s) => typeof s.latencyMs === "number")
      .slice(-12)
      .map((s) => Math.min(100, ((s.latencyMs ?? 0) / MAX_LATENCY_MS) * 100));
    return latencies.length > 0 ? latencies : undefined;
  }, [currentPlan]);

  const headlineText = currentPlan
    ? (currentStepLabel ?? currentPlan.intent ?? "Plan en cours")
    : running
      ? "Analyse en cours"
      : "Aucune mission";

  function handleClick() {
    if (!currentPlan) return;
    useStageStore.getState().setMode({ mode: "mission", missionId: currentPlan.id });
    router.push("/");
  }

  const clickable = !!currentPlan;

  return (
    <BentoCard show={show} colSpan={1} rowSpan={2} delay={0.18}>
      <div
        className={`flex h-full flex-col justify-between ${clickable ? "cursor-pointer group" : ""}`}
        onClick={clickable ? handleClick : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (clickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              Mission
            </span>
            {clickable && (
              <span className="text-spatial-sm text-white/30 opacity-0 transition-opacity duration-300 group-hover:opacity-80">
                ›
              </span>
            )}
          </div>
          <div className="text-spatial-2xl font-extralight tracking-tight text-white/95 line-clamp-3">
            {headlineText}
          </div>
          {currentPlan && (
            <div className="mt-1 text-spatial-sm font-light text-white/45">
              {doneCount}/{stepsCount} étapes
            </div>
          )}
        </div>

        <MiniChart bars={12} intervalMs={running ? 1500 : 4000} heights={chartHeights} />

        <div className="flex items-center gap-3">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: running || awaiting ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
              boxShadow:
                running || awaiting
                  ? "0 0 10px rgba(255,255,255,0.6)"
                  : "0 0 4px rgba(255,255,255,0.25)",
              animation: running ? "spatial-mission-pulse 2.4s ease-in-out infinite" : undefined,
            }}
          />
          <div className="text-spatial-sm font-light tracking-wide text-white/55">
            {awaiting
              ? "En attente de validation"
              : running
                ? "Agents mobilisés"
                : currentPlan
                  ? "Plan terminé"
                  : "En attente"}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
