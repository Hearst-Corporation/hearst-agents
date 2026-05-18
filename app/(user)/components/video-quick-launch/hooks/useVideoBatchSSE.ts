"use client";

/**
 * useVideoBatchSSE — hook SSE pour la génération vidéo en mode batch (Q3-A).
 *
 * Gère N EventSource ouverts en parallèle (un par variant). Chaque variant
 * a sa progression indépendante, exposée via `runs[]` (1 entrée par job).
 * Quand TOUS les runs sont done|error, `phase` bascule à `done`.
 *
 * L'appelant gère la création des forms et l'appel à `/api/v2/assets/batch`
 * — le hook se contente d'orchestrer l'écoute SSE et l'agrégat de phase.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BatchPhase, BatchVariantForm, BatchVariantRun } from "../types";

export interface UseVideoBatchSSEResult {
  phase: BatchPhase;
  setPhase: (p: BatchPhase) => void;
  runs: BatchVariantRun[];
  setRuns: (runs: BatchVariantRun[]) => void;
  assetId: string | null;
  setAssetId: (id: string | null) => void;
  errorMsg: string | null;
  setErrorMsg: (m: string | null) => void;
  /** Initialise les runs à partir des forms valides + jobs reçus de l'API. */
  initRuns: (
    validForms: BatchVariantForm[],
    jobs: Array<{
      kind: string;
      jobId: string;
      variantId: string;
      index: number;
    }>,
  ) => void;
  /** Ouvre un EventSource pour un variant donné (jobId + index). */
  subscribe: (jobId: string, runIndex: number) => void;
  reset: () => void;
  close: () => void;
}

export function useVideoBatchSSE(): UseVideoBatchSSEResult {
  const [phase, setPhase] = useState<BatchPhase>("idle");
  const [runs, setRuns] = useState<BatchVariantRun[]>([]);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourcesRef = useRef<EventSource[]>([]);

  const close = useCallback(() => {
    eventSourcesRef.current.forEach((es) => es.close());
    eventSourcesRef.current = [];
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setRuns([]);
    setAssetId(null);
    setErrorMsg(null);
    close();
  }, [close]);

  const subscribe = useCallback((jobId: string, runIndex: number) => {
    const url = `/api/v2/jobs/${encodeURIComponent(jobId)}/progress?kind=video-gen`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourcesRef.current.push(es);

    const updateRun = (patch: Partial<BatchVariantRun>) => {
      setRuns((prev) => prev.map((r) => (r.index === runIndex ? { ...r, ...patch } : r)));
    };

    updateRun({ phase: "running" });

    es.addEventListener("progress", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data) as {
          progress: number;
        };
        if (typeof data.progress === "number") {
          updateRun({ progress: data.progress, phase: "running" });
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("completed", (ev) => {
      let url: string | null = null;
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data ?? "{}") as Record<
          string,
          unknown
        >;
        if (typeof data.assetUrl === "string") url = data.assetUrl;
        else if (typeof data.url === "string") url = data.url;
      } catch {
        /* ignore */
      }
      updateRun({ progress: 100, phase: "done", url });
      es.close();
    });

    es.addEventListener("failed", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data) as {
          reason?: string;
        };
        updateRun({ phase: "error", errorMsg: data.reason ?? "Échec" });
      } catch {
        updateRun({ phase: "error", errorMsg: "Échec" });
      }
      es.close();
    });

    es.addEventListener("not_found", () => {
      updateRun({ phase: "error", errorMsg: "Job introuvable" });
      es.close();
    });

    es.addEventListener("session_expired", () => {
      es.close();
      // Session expirée côté serveur — rechargement pour déclencher le flow
      // d'authentification NextAuth.
      window.location.reload();
    });

    es.onerror = () => {
      // EventSource retry — laisse passer.
    };
  }, []);

  const initRuns = useCallback(
    (
      validForms: BatchVariantForm[],
      jobs: Array<{
        kind: string;
        jobId: string;
        variantId: string;
        index: number;
      }>,
    ) => {
      const next: BatchVariantRun[] = validForms.map((form, i) => {
        const job = jobs.find((j) => j.index === i);
        return {
          localId: form.localId,
          index: i,
          form,
          jobId: job?.jobId ?? null,
          variantId: job?.variantId ?? null,
          phase: job ? "queued" : "error",
          progress: 0,
          errorMsg: job ? null : "Enqueue échoué",
          url: null,
        };
      });
      setRuns(next);
    },
    [],
  );

  // Détection de la fin globale : bascule running → done quand tous les runs
  // sont terminés. La transition est dérivée d'un signal externe SSE.
  useEffect(() => {
    if (phase !== "running" || runs.length === 0) return;
    const allFinished = runs.every((r) => r.phase === "done" || r.phase === "error");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- transition d'état dérivée d'un signal externe (SSE batch completion)
    if (allFinished) setPhase("done");
  }, [runs, phase]);

  // Cleanup au unmount.
  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return {
    phase,
    setPhase,
    runs,
    setRuns,
    assetId,
    setAssetId,
    errorMsg,
    setErrorMsg,
    initRuns,
    subscribe,
    reset,
    close,
  };
}
