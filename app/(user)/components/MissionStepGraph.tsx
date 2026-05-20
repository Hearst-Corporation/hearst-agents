"use client";

/**
 * MissionStepGraph — Timeline verticale des steps d'un plan multi-step.
 *
 * Affiché au-dessus du contenu MissionStage quand un plan est en cours.
 * Header : intent + cost meter cumulé + ETA. Body : StepCards connectés
 * par un trait subtle. Status icons + couleurs par état.
 *
 * Tokens design system uniquement (cf. CLAUDE.md règles UI).
 */

import { useState } from "react";
import { Chip } from "@/app/(user)/components/ui/Chip";
import { type PlanState, useRuntimeStore } from "@/stores/runtime";
import { ConfirmModal } from "./ConfirmModal";
import { StepCard } from "./StepCard";

export interface MissionStepGraphProps {
  plan: PlanState;
  /** Optionnel : override sur l'approval handler. Sinon utilise le store. */
  onApprove?: (stepId: string) => void | Promise<void>;
  onSkip?: (stepId: string) => void | Promise<void>;
}

const STATUS_LABEL: Record<PlanState["status"], string> = {
  preview: "Aperçu",
  running: "En cours",
  awaiting_approval: "Validation",
  completed: "Terminé",
  failed: "Échec",
};

function statusColor(status: PlanState["status"]): string {
  switch (status) {
    case "running":
    case "awaiting_approval":
      return "var(--accent-teal)";
    case "completed":
      return "var(--accent-teal)";
    case "failed":
      return "var(--danger)";
    default:
      return "var(--text-faint)";
  }
}

function formatCost(usd: number): string {
  if (!Number.isFinite(usd) || usd === 0) return "$0.00";
  if (usd < 0.01) return "< $0.01";
  return `$${usd.toFixed(2)}`;
}

function estimateRemainingSecs(plan: PlanState): number | null {
  // Heuristique : 3s par step idle/awaiting, 0 sinon.
  const remaining = plan.steps.filter(
    (s) => s.status === "idle" || s.status === "awaiting_approval",
  ).length;
  if (remaining === 0) return null;
  return remaining * 3;
}

export function MissionStepGraph({ plan, onApprove, onSkip }: MissionStepGraphProps) {
  const approveStep = useRuntimeStore((s) => s.approveStep);

  // Confirmation avant skip : stocke le stepId à sauter.
  const [pendingSkipStepId, setPendingSkipStepId] = useState<string | null>(null);

  const handleApprove = async (stepId: string) => {
    if (onApprove) {
      await onApprove(stepId);
      return;
    }
    await approveStep(plan.id, stepId);
  };

  const performSkip = async (stepId: string) => {
    if (onSkip) {
      await onSkip(stepId);
      return;
    }
    // POURQUOI : skip = approve avec flag spécial. MVP on POST `skip=true`.
    try {
      await fetch(`/api/v2/missions/${plan.id}/approve-step`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, skip: true }),
      });
    } catch (err) {
      console.error("[MissionStepGraph] skip error:", err);
    }
  };

  // Demande confirmation avant le POST skip.
  const handleSkip = (stepId: string) => {
    setPendingSkipStepId(stepId);
  };

  const handleConfirmSkip = async () => {
    if (!pendingSkipStepId) return;
    const id = pendingSkipStepId;
    setPendingSkipStepId(null);
    await performSkip(id);
  };

  const eta = estimateRemainingSecs(plan);
  const color = statusColor(plan.status);

  return (
    <section
      className="border border-(--border-shell)"
      style={{
        background: "var(--rail)",
        padding: "var(--space-4) var(--space-6)",
      }}
      data-testid="mission-step-graph"
      data-plan-id={plan.id}
      data-status={plan.status}
    >
      {/* Header : intent + status + cost meter */}
      <header
        className="flex items-start"
        style={{ gap: "var(--space-4)", marginBottom: "var(--space-4)" }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="t-11 font-medium"
            style={{ color: "var(--text-l1)", marginBottom: "var(--space-1)" }}
          >
            Plan multi-étapes
          </p>
          <p className="t-15 font-light text-text whitespace-pre-wrap">
            {plan.intent || "Plan sans intention"}
          </p>
        </div>
        <div className="flex flex-col items-end" style={{ gap: "var(--space-1)" }}>
          <span className="t-11 font-medium" style={{ color }}>
            {STATUS_LABEL[plan.status]}
          </span>
          <span className="t-11 font-mono tabular-nums text-text-faint">
            {formatCost(plan.totalCostUsd)} / ~{formatCost(plan.estimatedCostUsd)}
          </span>
          {eta !== null && plan.status === "running" && (
            <span className="t-11 font-mono tabular-nums text-text-faint">{eta} s restant</span>
          )}
        </div>
      </header>

      {/* Required apps */}
      {plan.requiredApps.length > 0 && (
        <div
          className="flex items-center"
          style={{ gap: "var(--space-2)", marginBottom: "var(--space-4)" }}
        >
          <span className="t-11 font-medium text-(--text-l1)">Apps requises</span>
          {plan.requiredApps.map((app) => (
            <Chip key={app} size="md" variant="outlined" className="font-light text-text-muted">
              {app}
            </Chip>
          ))}
        </div>
      )}

      {/* Steps timeline */}
      <ol
        className="relative flex flex-col"
        style={{ gap: "var(--space-3)" }}
        data-testid="step-list"
      >
        {plan.steps.map((step) => (
          <li key={step.id} className="relative">
            <StepCard
              step={step}
              onApprove={() => handleApprove(step.id)}
              onSkip={() => handleSkip(step.id)}
            />
          </li>
        ))}
      </ol>

      {plan.steps.length === 0 && (
        <p className="t-11 font-light text-text-faint">Pas encore de step planifié.</p>
      )}

      {/* Confirmation avant skip — action définitive */}
      <ConfirmModal
        open={pendingSkipStepId !== null}
        title="Sauter cette étape ?"
        description="Cette action est définitive et ne peut pas être annulée."
        confirmLabel="Sauter"
        variant="danger"
        onConfirm={() => void handleConfirmSkip()}
        onCancel={() => setPendingSkipStepId(null)}
      />
    </section>
  );
}
