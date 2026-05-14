"use client";

/**
 * useBatchSubmit — orchestration submit mode batch (Q3-A).
 *
 * POST /api/v2/assets/batch → reçoit assetId + jobs → initRuns + subscribe SSE.
 * Sépare la logique fetch du composant parent.
 */

import { useCallback } from "react";
import type { UseVideoBatchSSEResult } from "./useVideoBatchSSE";
import type { BatchVariantForm } from "../types";

interface BatchSubmitParams {
  batchForms: BatchVariantForm[];
  batch: UseVideoBatchSSEResult;
}

export function useBatchSubmit({ batchForms, batch }: BatchSubmitParams) {
  return useCallback(async () => {
    const validForms = batchForms.filter((f) => f.prompt.trim().length > 0);
    if (
      validForms.length === 0 ||
      batch.phase === "creating" ||
      batch.phase === "running"
    )
      return;

    batch.setErrorMsg(null);
    batch.setPhase("creating");
    batch.setRuns([]);
    batch.setAssetId(null);

    try {
      const res = await fetch("/api/v2/assets/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants: validForms.map((f) => ({
            prompt: f.prompt.trim(),
            provider: f.provider,
            durationSeconds: f.duration,
            ratio: f.provider === "runway" ? f.ratio : undefined,
          })),
        }),
      });

      const body = await res.json();
      if (!res.ok || !body?.assetId) {
        throw new Error(
          body?.message ?? body?.error ?? "Échec de la création du batch",
        );
      }

      const assetId: string = body.assetId;
      const jobs: Array<{
        kind: string;
        jobId: string;
        variantId: string;
        index: number;
      }> = body.jobs ?? [];

      batch.setAssetId(assetId);
      batch.initRuns(validForms, jobs);
      batch.setPhase("running");

      // Open EventSource en parallèle pour chaque job qui a bien été enqueué.
      jobs.forEach((job) => {
        batch.subscribe(job.jobId, job.index);
      });

      // Si TOUS les jobs ont échoué dès l'enqueue, on bascule en error.
      if (jobs.length === 0) {
        batch.setPhase("error");
        batch.setErrorMsg("Aucun variant n'a pu être enqueué");
      }
    } catch (err) {
      batch.setErrorMsg(
        err instanceof Error ? err.message : "Erreur inattendue",
      );
      batch.setPhase("error");
    }
  }, [batchForms, batch]);
}
