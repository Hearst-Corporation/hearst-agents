"use client";

/**
 * FocalRetryButton — Shared retry action component
 *
 * Handles retry logic for failed focal objects (missions, plans, runs).
 * Used by FocalStage.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "@/app/hooks/use-toast";
import { consumeOrchestrateSseResponse } from "@/lib/engine/orchestrator/consume-sse-response";

interface FocalRetryButtonProps {
  /** Mission ID if focal is a mission */
  missionId?: string;
  /** Source plan ID if focal is derived from a plan */
  sourcePlanId?: string;
  /** Thread ID for orchestrate (conversation scope) */
  threadId?: string;
  /** Fields for canonical `focal_context` on POST /api/orchestrate */
  focalTitle?: string;
  focalObjectType?: string;
  focalStatus?: string;
  /** Optional: callback after successful retry */
  onSuccess?: () => void;
  /** Optional: custom label */
  label?: string;
  /** Optional: custom className for styling */
  className?: string;
  /** Optional: compact mode (smaller button) */
  compact?: boolean;
}

function buildFocalContext(params: {
  sourcePlanId?: string;
  threadId?: string;
  focalTitle?: string;
  focalObjectType?: string;
  focalStatus?: string;
}): { id: string; objectType: string; title: string; status: string } | undefined {
  const { sourcePlanId, threadId, focalTitle, focalObjectType, focalStatus } = params;
  if (!sourcePlanId && !threadId) return undefined;

  const id = sourcePlanId ?? threadId ?? "unknown";
  const objectType = focalObjectType?.trim() || (sourcePlanId ? "execution_plan" : "thread");

  return {
    id,
    objectType,
    title: (focalTitle ?? "Focal").slice(0, 200),
    status: focalStatus ?? "failed",
  };
}

export function FocalRetryButton({
  missionId,
  sourcePlanId,
  threadId,
  focalTitle,
  focalObjectType,
  focalStatus,
  onSuccess,
  label = "Réessayer",
  className,
  compact = false,
}: FocalRetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  // T-C15 : on conserve le dernier message d'erreur pour offrir un retry
  // visible inline (le toast disparaît après quelques secondes, le bouton
  // doit rester actionnable tant que le user n'a pas réessayé avec succès).
  const [lastError, setLastError] = useState<string | null>(null);

  // T-J4 (it.4) : garde setState post-unmount. Le fetch (mission retry ou
  // orchestrate SSE) peut prendre plusieurs secondes et l'utilisateur peut
  // naviguer ailleurs pendant ce temps.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    setLastError(null);

    try {
      if (missionId) {
        const res = await fetch(`/api/v2/missions/${missionId}/run`, {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Mission retry failed");
        }

        toast.success("Mission relancée", "La mission a été redémarrée avec succès");
        onSuccess?.();
        return;
      }

      if (sourcePlanId || threadId) {
        const focal_context = buildFocalContext({
          sourcePlanId,
          threadId,
          focalTitle,
          focalObjectType,
          focalStatus,
        });

        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: "Reprends depuis la dernière erreur",
            thread_id: threadId,
            focal_context,
          }),
        });

        const outcome = await consumeOrchestrateSseResponse(res);
        if (!outcome.ok) {
          throw new Error(outcome.error);
        }

        toast.success("Reprise lancée", "Le système va réessayer l'opération");
        onSuccess?.();
        return;
      }

      toast.warning(
        "Réessai non disponible",
        "Impossible de déterminer comment réessayer cette opération",
      );
    } catch (error) {
      console.error("[FocalRetryButton] Retry failed:", error);
      const errMsg = error instanceof Error ? error.message : "Une erreur est survenue";
      // T-J4 (it.4) : garde setState post-unmount.
      if (mountedRef.current) setLastError(errMsg);
      toast.error("Échec du réessai", errMsg);
    } finally {
      if (mountedRef.current) setIsRetrying(false);
    }
  };

  const baseClasses = compact ? "px-4 py-2 t-11 font-medium" : "px-8 py-4 t-13 font-medium";

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        className={
          className ||
          `${baseClasses} bg-(--accent-teal) text-[var(--text-on-accent-teal)] transition-[background-color,opacity,box-shadow] duration-(--duration-emphasis) disabled:opacity-50 disabled:cursor-not-allowed`
        }
        style={{ boxShadow: "var(--shadow-card-hover)" }}
        title={isRetrying ? "Réessai en cours…" : "Réessayer l'opération"}
        aria-describedby={lastError ? "focal-retry-error" : undefined}
      >
        {isRetrying ? "…" : lastError ? "Réessayer à nouveau" : label}
      </button>
      {lastError && (
        <p
          id="focal-retry-error"
          role="alert"
          className="t-11 font-light"
          style={{ color: "var(--color-error, var(--danger))", margin: 0 }}
        >
          {lastError}
        </p>
      )}
    </div>
  );
}
