"use client";

import { useEffect } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { useSpatialPanelsStore } from "@/stores/spatial-panels";
import { SpatialPanelHost } from "./SpatialPanelHost";

interface CockpitPanelsLayerProps {
  initialCockpitData?: CockpitTodayPayload | null;
}

/**
 * Wrapper du système de panels dynamiques.
 *
 * Au mount : seed uniquement le brief initial.
 * Les autres panels apparaissent via les subscribers branchés ailleurs
 * (useSpatialPanelsAgentSync).
 */
export function CockpitPanelsLayer({ initialCockpitData = null }: CockpitPanelsLayerProps) {
  const open = useSpatialPanelsStore((s) => s.open);

  useEffect(() => {
    // Seed minimal : le robot reste la scène principale, le brief n'est qu'un
    // contexte léger. Les autres panels apparaissent quand l'agent agit.
    const state = useSpatialPanelsStore.getState();
    if (!state.getByType("brief")) open("brief");
    useSpatialPanelsStore.getState().defocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return <SpatialPanelHost initialCockpitData={initialCockpitData} />;
}
