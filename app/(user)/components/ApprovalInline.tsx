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
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { toast } from "@/app/hooks/use-toast";
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
   * Si true, affiche un backdrop fade qui assombrit le reste de la page pour
   * attirer l'attention sur l'approval. La card reste cliquable. Auto-scroll
   * vers la card au mount. Default: true (les approvals sont critiques).
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
  const [actionError, setActionError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Garde setState post-unmount si onApprove/onSkip résolvent après que le
  // composant ait disparu (React 19 logge un warning sinon).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-scroll vers la card au mount pour que l'utilisateur ne manque pas
  // l'approval. behavior=smooth, block=center pour un effet doux.
  useEffect(() => {
    if (!prominent) return;
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [prominent]);

  const handleApprove = async () => {
    setPending("approve");
    setActionError(null);
    try {
      await onApprove();
    } catch (err) {
      const message = sanitizeApiError(err);
      if (mountedRef.current) {
        setActionError(message);
      }
      toast.error("Échec de l'approbation", message);
    } finally {
      if (mountedRef.current) setPending(null);
    }
  };

  const handleSkip = async () => {
    setPending("skip");
    setActionError(null);
    try {
      await onSkip();
    } catch (err) {
      const message = sanitizeApiError(err);
      if (mountedRef.current) {
        setActionError(message);
      }
      toast.error("Échec du skip", message);
    } finally {
      if (mountedRef.current) setPending(null);
    }
  };

  const labelId = `approval-label-${stepId}`;
  const isLocked = pending !== null;

  return (
    <>
      {/* Backdrop pour attirer l'attention. z-40 reste sous les modals lourds
          (z-50+). Pendant isLocked : backdrop plus opaque + cursor:wait pour
          signaler que l'action est verrouillée (cf. ConfirmModal). */}
      {prominent && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-backdrop pointer-events-none transition-opacity"
          style={{
            background: isLocked
              ? "color-mix(in srgb, var(--bg) 50%, transparent)"
              : "var(--overlay-scrim-soft)",
            cursor: isLocked ? "wait" : "default",
            transitionDuration: "var(--duration-medium, 200ms)",
          }}
        />
      )}
      <div
        ref={cardRef}
        role="region"
        aria-labelledby={labelId}
        className={`border-l-2 border-(--accent-teal) ${prominent ? "relative z-modal" : ""}`}
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

        {/* Warning post-approval — écriture définitive, pas d'undo possible
            une fois l'action exécutée côté provider. */}
        <div
          role="note"
          aria-live="polite"
          className="flex items-start"
          style={{
            gap: "var(--space-2)",
            padding: "var(--space-2) var(--space-3)",
            marginBottom: "var(--space-3)",
            background: "var(--warn-surface)",
            border: "1px solid color-mix(in srgb, var(--warn) 55%, transparent)",
            borderRadius: "var(--radius-xs)",
          }}
          data-testid="approval-warning"
        >
          <span
            aria-hidden="true"
            className="t-11 shrink-0"
            style={{ color: "var(--warn)", lineHeight: "var(--leading-base)" }}
          >
            ⚠
          </span>
          <span
            className="t-11 font-light"
            style={{ color: "var(--warn)", lineHeight: "var(--leading-base)" }}
          >
            Cette écriture est définitive et ne peut pas être annulée.
          </span>
        </div>

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
            <Action
              variant="ghost"
              tone="neutral"
              size="sm"
              className="t-9"
              onClick={onEdit}
              disabled={pending !== null}
              testId="approval-edit"
              aria-label={`Modifier l'action ${kind} avant approbation`}
            >
              Modifier
            </Action>
          )}
          <Action
            variant="ghost"
            tone="neutral"
            size="sm"
            className="t-9"
            onClick={handleSkip}
            disabled={pending !== null}
            testId="approval-skip"
            aria-label={`Sauter l'action ${kind} sans l'exécuter`}
          >
            {pending === "skip" ? "…" : "Sauter"}
          </Action>
        </div>

        {/* Bloc d'erreur d'action — visible si la dernière approbation/skip a
            échoué. role="alert" pour annonce immédiate par les screen readers.
            Reste visible jusqu'à la prochaine tentative (qui clear actionError). */}
        {actionError && (
          <div
            role="alert"
            className="border-l-2 border-(--danger)"
            style={{
              marginTop: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
            }}
            data-testid="approval-error"
          >
            <p className="t-11 font-medium text-(--danger)" style={{ margin: 0 }}>
              Échec · {actionError}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
