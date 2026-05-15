"use client";

import { motion, type Variants } from "framer-motion";
import type { PlanState, PlanStepState } from "@/stores/runtime";
import { useRuntimeStore } from "@/stores/runtime";

const STEPS_MAX = 10;

const CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const STATUS_LABELS: Record<PlanState["status"], string> = {
  preview: "Aperçu",
  running: "En cours",
  awaiting_approval: "Approbation requise",
  completed: "Terminé",
  failed: "Échec",
};

function PlanStatusBadge({ status }: { status: PlanState["status"] }) {
  const styles: Record<PlanState["status"], React.CSSProperties> = {
    running: {
      color: "var(--cykan, rgba(0,220,200,0.9))",
      border: "1px solid rgba(0,220,200,0.3)",
      background: "rgba(0,220,200,0.06)",
    },
    awaiting_approval: {
      color: "var(--gold, rgba(255,215,0,0.9))",
      border: "1px solid rgba(255,215,0,0.3)",
      background: "rgba(255,215,0,0.06)",
    },
    completed: {
      color: "rgba(255,255,255,0.9)",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(255,255,255,0.06)",
    },
    failed: {
      color: "var(--danger, rgba(255,80,80,0.9))",
      border: "1px solid rgba(255,80,80,0.3)",
      background: "rgba(255,80,80,0.06)",
    },
    preview: {
      color: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
    },
  };

  const isPulsing = status === "running";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={styles[status]}
    >
      {isPulsing && (
        <motion.span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--cykan, rgba(0,220,200,0.9))" }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

function StepIcon({ status }: { status: PlanStepState["status"] }) {
  if (status === "done") {
    return (
      <span className="text-sm" style={{ color: "var(--cykan, rgba(0,220,200,0.9))" }}>
        ✓
      </span>
    );
  }
  if (status === "running") {
    return (
      <motion.span
        className="inline-block text-sm"
        style={{ color: "rgba(255,255,255,0.7)" }}
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
      >
        ⏳
      </motion.span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-sm" style={{ color: "var(--danger, rgba(255,80,80,0.9))" }}>
        !
      </span>
    );
  }
  if (status === "awaiting_approval") {
    return (
      <span className="text-sm" style={{ color: "var(--gold, rgba(255,215,0,0.9))" }}>
        ⏸
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
        —
      </span>
    );
  }
  // idle
  return (
    <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
      ○
    </span>
  );
}

function StepRow({ step }: { step: PlanStepState }) {
  const isIdle = step.status === "idle";
  const costLabel = step.costUSD && step.costUSD > 0 ? `$${step.costUSD.toFixed(3)}` : null;
  const latencyLabel =
    step.latencyMs && step.latencyMs > 0 ? `${(step.latencyMs / 1000).toFixed(1)}s` : null;

  return (
    <div className="flex items-center gap-3 py-2" style={{ opacity: isIdle ? 0.4 : 1 }}>
      <div className="flex w-5 shrink-0 items-center justify-center">
        <StepIcon status={step.status} />
      </div>
      <span className="flex-1 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
        {step.label}
      </span>
      <div className="flex items-center gap-2">
        {costLabel && (
          <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            {costLabel}
          </span>
        )}
        {latencyLabel && (
          <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            {latencyLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function MissionStage({ mode }: { mode: string }) {
  const currentPlan = useRuntimeStore((s) => s.currentPlan);

  return (
    <motion.section
      key={mode}
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
    >
      {currentPlan === null ? (
        <p style={{ color: "rgba(255,255,255,0.5)" }} className="text-sm">
          Aucune mission en cours. Lance une mission depuis le chat ou le menu principal.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <p className="text-base font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
              {currentPlan.intent}
            </p>
            <PlanStatusBadge status={currentPlan.status} />
          </div>

          {/* Barre d'approbation */}
          {currentPlan.status === "awaiting_approval" &&
            (() => {
              const pendingStep = currentPlan.steps.find((s) => s.status === "awaiting_approval");
              return (
                <div
                  className="rounded-xl px-5 py-4"
                  style={{
                    background: "rgba(255,215,0,0.08)",
                    border: "1px solid rgba(255,215,0,0.3)",
                  }}
                >
                  <p
                    className="mb-2 text-sm font-medium"
                    style={{ color: "var(--gold, rgba(255,215,0,0.9))" }}
                  >
                    Approbation requise
                  </p>
                  {pendingStep?.approvalPreview && (
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {pendingStep.approvalPreview}
                    </p>
                  )}
                </div>
              );
            })()}

          {/* Timeline steps */}
          <div className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {currentPlan.steps.slice(0, STEPS_MAX).map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
