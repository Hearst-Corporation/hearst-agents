"use client";

import { useEffect, useState } from "react";
import { isPlaceholderAssetId } from "@/lib/ui/asset-id";
import type { ImageStatus } from "./shared";

interface UseImageVariantPollResult {
  primaryImageUrl: string | null;
  imageStatus: ImageStatus;
}

const POLL_INTERVAL_MS = 4000;

/**
 * Polling variants image d'un asset (4s).
 *
 * Quatre états :
 *   - idle    : aucun variant image attendu (asset texte pur, ou pas encore décidé)
 *   - pending : un variant image existe en pending/generating → skeleton
 *   - ready   : variant image disponible → hero affiché
 *   - failed  : tentative échouée → message d'erreur + bouton re-générer
 *
 * Stop le polling dès qu'on est ready ou failed.
 */
export function useImageVariantPoll(assetId: string): UseImageVariantPollResult {
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<ImageStatus>("idle");

  useEffect(() => {
    if (!assetId || isPlaceholderAssetId(assetId)) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchVariants = async () => {
      try {
        const res = await fetch(`/api/v2/assets/${encodeURIComponent(assetId)}/variants`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          variants?: Array<{ kind: string; status: string; storageUrl?: string | null }>;
        };
        const imageVariants = (data.variants ?? []).filter((v) => v.kind === "image");
        const imageReady = imageVariants.find((v) => v.status === "ready" && v.storageUrl);
        const imagePending = imageVariants.find(
          (v) => v.status === "pending" || v.status === "generating",
        );
        const imageFailed = imageVariants.find((v) => v.status === "failed");

        if (cancelled) return;

        if (imageReady?.storageUrl) {
          setPrimaryImageUrl(imageReady.storageUrl);
          setImageStatus("ready");
          if (interval) clearInterval(interval);
        } else if (imageFailed) {
          setImageStatus("failed");
          if (interval) clearInterval(interval);
        } else if (imagePending) {
          setImageStatus("pending");
        }
      } catch {
        // Silent — l'absence de variant ready ne casse rien.
      }
    };

    void fetchVariants();
    interval = setInterval(fetchVariants, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [assetId]);

  return { primaryImageUrl, imageStatus };
}
