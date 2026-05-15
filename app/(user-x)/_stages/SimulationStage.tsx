"use client";

import { motion } from "framer-motion";
import { useRuntimeStore } from "@/stores/runtime";

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const STEP_STATUS_LABEL: Record<string, string> = {
  idle: "En attente",
  running: "En cours",
  awaiting_approval: "Validation requise",
  done: "Terminé",
  error: "Erreur",
  skipped: "Ignoré",
};

type Props = { mode?: string };

export function SimulationStage({ mode = "simulation" }: Props) {
  const currentPlan = useRuntimeStore((s) => s.currentPlan);
  const coreState = useRuntimeStore((s) => s.coreState);

  const isActive =
    currentPlan !== null &&
    (currentPlan.status === "running" || currentPlan.status === "awaiting_approval");

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {!isActive ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-white/90">Aucune simulation active</h2>
          <p className="text-sm text-white/40">
            Lance un scénario depuis le Commandeur (⌘K → Sim).
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-white/90">Simulation en cours</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
                {currentPlan.status}
              </span>
            </div>
            {currentPlan.intent && (
              <p className="text-sm leading-relaxed text-white/60">{currentPlan.intent}</p>
            )}
          </div>

          {/* Variables runtime */}
          <div className="flex flex-col gap-2 rounded-xl border border-white/6 bg-[rgba(255,255,255,0.03)] px-5 py-4">
            <div className="flex justify-between text-xs">
              <span className="text-white/35">État runtime</span>
              <span className="text-white/60">{coreState}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/35">Étapes</span>
              <span className="text-white/60">{currentPlan.steps.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/35">Coût estimé</span>
              <span className="text-white/60">${currentPlan.estimatedCostUsd.toFixed(4)}</span>
            </div>
            {currentPlan.totalCostUsd > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Coût réel</span>
                <span className="text-white/60">${currentPlan.totalCostUsd.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* Étapes */}
          {currentPlan.steps.length > 0 && (
            <div className="flex flex-col gap-2">
              {currentPlan.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-center gap-4 rounded-xl border border-white/6 bg-[rgba(255,255,255,0.03)] px-5 py-3"
                >
                  <span className="w-5 shrink-0 text-center text-xs text-white/25">{idx + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-white/75">{step.label}</span>
                    <span className="text-xs text-white/35">{step.kind}</span>
                  </div>
                  <span
                    className={`shrink-0 text-xs ${
                      step.status === "done"
                        ? "text-white/60"
                        : step.status === "running"
                          ? "text-white/90"
                          : step.status === "error"
                            ? "text-red-400/70"
                            : "text-white/30"
                    }`}
                  >
                    {STEP_STATUS_LABEL[step.status] ?? step.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Note discrète */}
          <p className="text-xs text-[rgba(255,255,255,0.3)]">Scénario DeepSeek — câblé en P6</p>
        </>
      )}
    </motion.section>
  );
}
