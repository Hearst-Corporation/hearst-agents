"use client";

import { useEffect, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import type { Asset } from "@/lib/assets/types";
import { isPlaceholderAssetId } from "@/lib/ui/asset-id";

interface UseAssetFetchResult {
  asset: Asset | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook de fetch d'un asset par son id.
 *
 * Guard placeholder : assetId vide ou fixture (preset catalogue, mock e2e,
 * cache périmé) → on n'essaie pas de fetch. Affiche un état error explicite.
 *
 * Source de vérité unique côté Stage — `useStageData.setAsset` est appelé
 * en aval par l'orchestrateur (cf invariant Stage I-9 : sous-Stage =
 * source, stage-data = miroir).
 */
export function useAssetFetch(assetId: string): UseAssetFetchResult {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isPlaceholderAssetId(assetId)) {
      // Defer le set d'état error pour ne pas violer
      // react-hooks/set-state-in-effect (sync setState dans effect).
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setLoading(false);
        setError("Asset introuvable");
        setAsset(null);
      });
      return () => {
        cancelled = true;
      };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intentionnel avant fetch : nécessaire pour afficher le loading au changement d'assetId
    setLoading(true);
    setError(null);
    fetch(`/api/v2/assets/${encodeURIComponent(assetId)}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data?.asset) {
          setError("Asset introuvable");
          setAsset(null);
        } else {
          setAsset(data.asset as Asset);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(sanitizeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return { asset, loading, error };
}
