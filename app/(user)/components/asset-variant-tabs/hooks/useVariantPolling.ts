"use client";

/**
 * useVariantPolling — Cycle de vie complet des variants côté UI.
 *
 * Responsabilités :
 *  1. Fetch initial + polling toutes les `POLL_INTERVAL_MS` tant qu'au
 *     moins un variant est `pending` ou `generating`.
 *  2. [WF5] Watchdog timeout : si un variant dépasse
 *     `GENERATION_TIMEOUT_MS` en generating, on le marque localement
 *     comme failed (UI uniquement, pas de mutation backend).
 *  3. [S2-D] Notification desktop quand un variant transite vers `ready`.
 *  4. Sync vers `useStageData.asset.variants` pour ContextRailForAsset.
 *
 * Le hook expose `refetch` — le caller l'utilise après un POST de
 * variant pour rafraîchir la liste sans attendre le prochain tick.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStageData } from "@/stores/stage-data";
import { useStageStore } from "@/stores/stage";
import { useVariantReadyNotification } from "@/app/hooks/use-variant-ready-notification";
import type { AssetVariant, AssetVariantKind } from "@/lib/assets/variants";
import {
  GENERATION_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  VARIANT_LABELS,
} from "../shared";

interface UseVariantPollingResult {
  variants: AssetVariant[];
  timedOutKinds: Set<AssetVariantKind>;
  refetch: () => Promise<void>;
  /** Marque un kind comme "en cours" pour le watchdog timeout local. */
  markGenerationStart: (kind: AssetVariantKind) => void;
  /** Réinitialise l'état timeout d'un kind (après un retry). */
  clearTimeout: (kind: AssetVariantKind) => void;
}

export function useVariantPolling(assetId: string): UseVariantPollingResult {
  const [variants, setVariants] = useState<AssetVariant[]>([]);
  const [timedOutKinds, setTimedOutKinds] = useState<Set<AssetVariantKind>>(
    new Set(),
  );

  // [WF5] Timestamp de début de génération par kind.
  const generationStartedAt = useRef<Partial<Record<AssetVariantKind, number>>>(
    {},
  );

  // [S2-D] Notification desktop sur variant ready.
  const { notify } = useVariantReadyNotification();
  const setStageMode = useStageStore((s) => s.setMode);
  // Map kind → status précédent. Permet de détecter la transition
  // pending|generating → ready et déclencher la notification une seule fois.
  const previousStatusByKind = useRef<
    Map<AssetVariantKind, AssetVariant["status"]>
  >(new Map());

  // Sync vers stage-data pour ContextRailForAsset (variants list).
  // currentAsset est lu via getState() pour ne pas re-déclencher l'effect
  // sur chaque changement d'autres champs (assetId/title) — sinon boucle.
  const setAssetSlice = useStageData((s) => s.setAsset);
  useEffect(() => {
    const currentAsset = useStageData.getState().asset;
    setAssetSlice({ ...currentAsset, variants });
  }, [variants, setAssetSlice]);

  const fetchVariants = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v2/assets/${encodeURIComponent(assetId)}/variants`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.variants)) {
        setVariants(data.variants as AssetVariant[]);
      }
    } catch {
      // Non-fatal — on retry au prochain poll.
    }
  }, [assetId]);

  // Initial fetch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchVariants est async : setVariants ne s'appelle qu'après await, pas synchrone
    void fetchVariants();
  }, [fetchVariants]);

  // Polling tant qu'un variant est en cours + [WF5] watchdog timeout.
  useEffect(() => {
    const hasInProgress = variants.some(
      (v) => v.status === "pending" || v.status === "generating",
    );
    if (!hasInProgress) return;

    const timer = setInterval(() => {
      void fetchVariants();

      // [WF5] Vérifier les timeouts.
      const now = Date.now();
      variants.forEach((v) => {
        if (v.status !== "generating" && v.status !== "pending") return;
        const startedAt = generationStartedAt.current[v.kind];
        if (!startedAt) return;
        if (now - startedAt > GENERATION_TIMEOUT_MS) {
          setTimedOutKinds((prev) => {
            if (prev.has(v.kind)) return prev;
            const next = new Set(prev);
            next.add(v.kind);
            return next;
          });
        }
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [variants, fetchVariants]);

  // [WF5] Enregistrer le timestamp de début quand un variant passe en
  // generating. Nettoyer quand il en sort.
  useEffect(() => {
    variants.forEach((v) => {
      if (v.status === "generating" || v.status === "pending") {
        if (!generationStartedAt.current[v.kind]) {
          // Utiliser createdAt du variant si disponible, sinon maintenant.
          generationStartedAt.current[v.kind] = v.createdAt ?? Date.now();
        }
      } else {
        // Variant sorti du generating → nettoyer le timestamp et le timeout.
        if (generationStartedAt.current[v.kind]) {
          delete generationStartedAt.current[v.kind];
        }
        if (timedOutKinds.has(v.kind)) {
          setTimedOutKinds((prev) => {
            const next = new Set(prev);
            next.delete(v.kind);
            return next;
          });
        }
      }
    });
  }, [variants, timedOutKinds]);

  // [S2-D] Détection transition pending|generating → ready et trigger
  // notif desktop.
  useEffect(() => {
    variants.forEach((v) => {
      const prev = previousStatusByKind.current.get(v.kind);
      const wasInProgress = prev === "pending" || prev === "generating";
      if (wasInProgress && v.status === "ready") {
        const label = VARIANT_LABELS[v.kind] ?? v.kind;
        notify({
          title: `${label} prêt${v.kind === "video" || v.kind === "image" ? "e" : ""}`,
          body: "Votre génération est disponible — cliquez pour ouvrir.",
          icon: "/hearst-logo.svg",
          tag: `variant-${v.id}`,
          onClick: () => {
            setStageMode({ mode: "asset", assetId, variantKind: v.kind });
          },
        });
      }
      previousStatusByKind.current.set(v.kind, v.status);
    });
  }, [variants, notify, assetId, setStageMode]);

  const markGenerationStart = useCallback((kind: AssetVariantKind) => {
    generationStartedAt.current[kind] = Date.now();
  }, []);

  const clearKindTimeout = useCallback((kind: AssetVariantKind) => {
    setTimedOutKinds((prev) => {
      if (!prev.has(kind)) return prev;
      const next = new Set(prev);
      next.delete(kind);
      return next;
    });
  }, []);

  return {
    variants,
    timedOutKinds,
    refetch: fetchVariants,
    markGenerationStart,
    clearTimeout: clearKindTimeout,
  };
}
