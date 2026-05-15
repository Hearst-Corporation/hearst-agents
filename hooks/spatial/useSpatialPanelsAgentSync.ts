"use client";

import { useEffect } from "react";
import { SPATIAL_PANEL_CONFIG } from "@/lib/spatial/panel-types";
import { useFocalStore } from "@/stores/focal";
import { useNavigationStore } from "@/stores/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useSpatialPanelsStore } from "@/stores/spatial-panels";

/**
 * Branche le store de panels spatiaux aux stores existants (runtime / focal /
 * navigation). Quand l'agent fait quelque chose, les panels appropriés
 * s'ouvrent/se ferment automatiquement.
 *
 * Subscribers :
 * - useRuntimeStore.coreState === 'awaiting_approval' → open Approval
 * - useRuntimeStore.coreState === 'streaming|processing' → open ChatResponse
 * - useFocalStore.focal change (non-brief) → open AssetPreview
 *
 * Logique d'éphémère :
 * - ChatResponse : se ferme TTL après stabilisation (dernière modification du
 *   thread > 15s ET coreState idle).
 * - AssetPreview : 30s après ouverture si pas d'interaction.
 */
export function useSpatialPanelsAgentSync() {
  const sync = useSpatialPanelsStore((s) => s.sync);
  const close = useSpatialPanelsStore((s) => s.close);
  const open = useSpatialPanelsStore((s) => s.open);
  const getByType = useSpatialPanelsStore((s) => s.getByType);

  // 1. Approval / Clarification (interruptifs sticky tant que coreState attend)
  const coreState = useRuntimeStore((s) => s.coreState);
  useEffect(() => {
    sync("approval", coreState === "awaiting_approval");
    sync("clarification", coreState === "awaiting_clarification");
  }, [coreState, sync]);

  // 2. ChatResponse : s'ouvre dès que streaming/processing.
  useEffect(() => {
    const isActive = coreState === "streaming" || coreState === "processing";
    if (isActive) {
      sync("chat-response", true);
    }
    // Fermeture gérée par TTL (timer ci-dessous) pour laisser le temps de lire.
  }, [coreState, sync]);

  // 3. TTL ChatResponse : fermer 15s après la dernière modification du thread
  //    actif, à condition que coreState ne soit plus actif.
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const messages = useNavigationStore((s) =>
    activeThreadId ? s.messages[activeThreadId] : undefined,
  );
  const _lastMessageContent = messages?.[messages.length - 1]?.content ?? "";

  useEffect(() => {
    const ttlMs = SPATIAL_PANEL_CONFIG["chat-response"].ttlMs ?? 15_000;
    const isActive = coreState === "streaming" || coreState === "processing";
    if (isActive) return; // ne pas démarrer le timer pendant le stream

    const timer = setTimeout(() => {
      const panel = getByType("chat-response");
      if (panel) close(panel.id);
    }, ttlMs);

    return () => clearTimeout(timer);
  }, [coreState, close, getByType]);

  // 4. AssetPreview : ouvre quand un focal non-brief apparaît, TTL 30s
  const focal = useFocalStore((s) => s.focal);
  useEffect(() => {
    if (focal && focal.type !== "brief") {
      open("asset-preview", { focalId: focal.id });

      const ttl = SPATIAL_PANEL_CONFIG["asset-preview"].ttlMs ?? 30_000;
      const timer = setTimeout(() => {
        const panel = getByType("asset-preview");
        if (panel) close(panel.id);
      }, ttl);

      return () => clearTimeout(timer);
    }
  }, [focal, open, close, getByType]);
}
