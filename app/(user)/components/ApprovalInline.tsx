"use client";

/**
 * ApprovalInline — Carte de validation inline pour un step write en attente.
 *
 * Affichée à l'intérieur d'un StepCard quand status === "awaiting_approval".
 * Vue inline, pas de modal lourd. Trois actions : Approuver, Modifier, Sauter.
 *
 * Tokens design system uniquement (cf. CLAUDE.md). Aucun magic px, aucune
 * couleur en dur.
 */

import { useEffect, useRef, useState } from "react";
import { ProviderChip } from "./ProviderChip";
import { Action } from "./ui";

export interface ApprovalInlineProps {
  stepId: string;
  preview: string;
  kind: string;
  providerId?: string;
  onApprove: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onEdit?: () => void;
  /**
   * P1-4 : si true, affiche un backdrop fade qui assombrit le reste de la
   * page pour attirer l'attention sur l'approval. La card reste cliquable.
   * Auto-scroll vers la card au mount.
   * Default: true (les approvals sont par nature critiques).
   */
  prominent?: boolean;
}

export function ApprovalInline({
  stepId,
  preview,
  kind,
  providerId,
  onApprove,
  onSkip,
  onEdit,
  prominent = true,
}: ApprovalInlineProps) {
  const [pending, setPending] = useState<"approve" | "skip" | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // it.3 H2 T-H2-9 : évite setState après unmount si onApprove/onSkip
  // résolvent (ou rejettent) après la disparition du composant. React 19
  // tolère mais loggue un warning ; on évite proprement.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // P1-4 : auto-scroll vers la card au mount pour que l'utilisateur ne manque
  // pas l'approval. Behavior=smooth, block=center pour un effet doux.
  useEffect(() => {
    if (!prominent) return;
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [prominent]);

  const handleApprove = async () => {
    setPending("approve");
    try {
      await onApprove();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  };

  const handleSkip = async () => {
    setPending("skip");
    try {
      await onSkip();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  };

  const labelId = `approval-label-${stepId}`;
  const isLocked = pending !== null;

  return (
    <>
      {/* P1-4 : backdrop fixed pour attirer l'attention. z-40 reste sous les
          modals lourds (z-50+) mais au-dessus du Stage normal. pointer-events
          conservés sur la card (ci-dessous) via z-50. */}
      {prominent && !isLocked && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30 pointer-events-none transition-opacity"
          style={{ transitionDuration: "var(--duration-medium, 200ms)" }}
        />
      )}
      <div
        ref={cardRef}
        role="region"
        aria-labelledby={labelId}
        className={`border-l-2 border-(--accent-teal) ${prominent ? "relative z-50" : ""}`}
        style={{
          background: "var(--accent-teal-surface)",
          padding: "var(--space-3) var(--space-4)",
          marginTop: "var(--space-3)",
          boxShadow: prominent ? "var(--shadow-card-hover)" : undefined,
        }}
        data-testid="approval-inline"
        data-step-id={stepId}
      >
        <div
          className="flex items-center"
          style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}
        >
          <span id={labelId} className="t-11 font-medium text-(--accent-teal)">
            Validation requise
          </span>
          <span
            className="rounded-pill bg-[var(--text-ghost)]"
            style={{ width: "var(--space-1)", height: "var(--space-1)" }}
          />
          <span className="t-11 font-light text-text-faint">{kind}</span>
          {providerId && (
            <>
              <span
                className="rounded-pill bg-[var(--text-ghost)]"
                style={{ width: "var(--space-1)", height: "var(--space-1)" }}
              />
              <ProviderChip providerId={providerId} status="pending" />
            </>
          )}
        </div>

        <p
          className="t-13 font-light text-text-soft whitespace-pre-wrap"
          style={{ marginBottom: "var(--space-3)" }}
        >
          {preview}
        </p>

        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <Action
            variant="primary"
            tone="brand"
            size="sm"
            onClick={handleApprove}
            disabled={pending !== null && pending !== "approve"}
            loading={pending === "approve"}
            testId="approval-approve"
            aria-label={`Approuver l'action ${kind}`}
          >
            Approuver
          </Action>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={pending !== null}
              className="ghost-btn-solid ghost-btn-ghost t-9"
              data-testid="approval-edit"
              aria-label={`Modifier l'action ${kind} avant approbation`}
            >
              <span>Modifier</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending !== null}
            className="ghost-btn-solid ghost-btn-ghost t-9"
            data-testid="approval-skip"
            aria-label={`Sauter l'action ${kind} sans l'exécuter`}
          >
            <span>{pending === "skip" ? "…" : "Sauter"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
