"use client";

/**
 * useSingleSubmit — orchestration submit mode simple (S2-A).
 *
 * Crée le shell asset, enqueue le variant vidéo, abonne le SSE.
 * Sépare la logique métier fetch du composant parent.
 */

import { useCallback } from "react";
import type { DurationOption, Provider, RatioOption } from "../types";
import type { UseVideoSSEResult } from "./useVideoSSE";

interface SingleSubmitParams {
  prompt: string;
  provider: Provider;
  duration: DurationOption;
  ratio: RatioOption;
  single: UseVideoSSEResult;
  onAssetCreated: (assetId: string) => void;
}

export function useSingleSubmit({
  prompt,
  provider,
  duration,
  ratio,
  single,
  onAssetCreated,
}: SingleSubmitParams) {
  return useCallback(async () => {
    if (
      !prompt.trim() ||
      single.phase === "creating" ||
      single.phase === "queued" ||
      single.phase === "running"
    )
      return;
    single.setErrorMsg(null);
    single.setProgress(0);
    single.setPhase("creating");

    try {
      const shellName = prompt.trim().slice(0, 80) || "Vidéo générée";
      const assetRes = await fetch("/api/v2/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          name: shellName,
          metadata: {
            origin: "video-quick-launch",
            content: prompt.trim(),
          },
        }),
      });
      const assetBody = await assetRes.json();
      if (!assetRes.ok || !assetBody?.asset?.id) {
        throw new Error(assetBody?.error ?? "Création de l'asset échouée");
      }
      const assetId: string = assetBody.asset.id;
      onAssetCreated(assetId);

      single.setPhase("queued");
      const variantRes = await fetch(`/api/v2/assets/${encodeURIComponent(assetId)}/variants`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "video",
          provider,
          prompt: prompt.trim(),
          scriptText: prompt.trim(),
          durationSeconds: duration,
          ratio: provider === "runway" ? ratio : undefined,
        }),
      });
      const variantBody = await variantRes.json();
      if (!variantRes.ok) {
        throw new Error(variantBody?.message ?? variantBody?.error ?? "Enqueue du job échoué");
      }
      const jobId: string | undefined = variantBody.jobId;
      if (!jobId) {
        throw new Error("Job ID manquant dans la réponse variants.");
      }

      single.subscribe(jobId, provider);
    } catch (err) {
      single.setErrorMsg(err instanceof Error ? err.message : "Erreur inattendue");
      single.setPhase("error");
    }
  }, [prompt, provider, duration, ratio, single, onAssetCreated]);
}
