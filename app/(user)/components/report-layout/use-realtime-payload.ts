/**
 * useRealtimePayload — souscrit au store reports pour recevoir le payload live
 * d'un asset, et expose un toast 3s lorsqu'un nouveau payload arrive.
 *
 * Garde l'invariant pipeline reports : aucune logique engine ici, le hook lit
 * uniquement le live-feed Supabase déjà géré par `useReportsStore`.
 */

import { useEffect, useMemo, useState } from "react";
import type { RenderPayload } from "@/lib/reports/engine/render-blocks";
import { useReportsStore } from "@/stores/reports";
import { useSafeSession } from "./use-safe-session";

interface UseRealtimePayloadResult {
  effectivePayload: RenderPayload;
  showToast: boolean;
}

const TOAST_DURATION_MS = 3000;

export function useRealtimePayload(
  payload: RenderPayload,
  assetId: string | null | undefined,
): UseRealtimePayloadResult {
  const sessionData = useSafeSession();
  const tenantId = (sessionData?.user as { tenantId?: string } | undefined)?.tenantId ?? "";
  const { subscribeToReport, unsubscribeFromReport, liveReports } = useReportsStore();

  useEffect(() => {
    if (!assetId || !tenantId) return;
    subscribeToReport(assetId, tenantId);
    return () => {
      unsubscribeFromReport(assetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, tenantId, subscribeToReport, unsubscribeFromReport]);

  const livePayload = assetId ? liveReports.get(assetId) : undefined;
  const effectivePayload =
    livePayload && livePayload.generatedAt > payload.generatedAt ? livePayload : payload;

  const [showToast, setShowToast] = useState(false);
  const _prevLiveGenAt = useMemo(() => livePayload?.generatedAt, [livePayload]);
  useEffect(() => {
    if (!livePayload) return;
    if (livePayload.generatedAt <= payload.generatedAt) return;
    const tShow = setTimeout(() => setShowToast(true), 0);
    const tHide = setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
    return () => {
      clearTimeout(tShow);
      clearTimeout(tHide);
    };
    // On surveille uniquement le generatedAt du livePayload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePayload?.generatedAt, payload.generatedAt]);

  return { effectivePayload, showToast };
}
