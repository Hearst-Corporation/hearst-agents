/**
 * Registre des composants React pour chaque SpatialPanelType.
 *
 * Source unique de mapping type → composant. Pour ajouter un nouveau type
 * de panel : 1) le déclarer dans panel-types.ts, 2) créer la card, 3)
 * l'enregistrer ici.
 */

import type { ComponentType } from "react";
import { CockpitApprovalCard } from "@/components/spatial/rnd/cards/CockpitApprovalCard";
import { CockpitAssetPreviewCard } from "@/components/spatial/rnd/cards/CockpitAssetPreviewCard";
import { CockpitAssetsCard } from "@/components/spatial/rnd/cards/CockpitAssetsCard";
import { CockpitBriefCard } from "@/components/spatial/rnd/cards/CockpitBriefCard";
import { CockpitChatResponseCard } from "@/components/spatial/rnd/cards/CockpitChatResponseCard";
import { CockpitKPICard } from "@/components/spatial/rnd/cards/CockpitKPICard";
import { CockpitMissionCard } from "@/components/spatial/rnd/cards/CockpitMissionCard";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import type { SpatialPanelType } from "./panel-types";

/**
 * Props injectées à chaque card. Toutes les cards reçoivent éventuellement
 * `payload` (data passée à l'open) et `initialCockpitData` (prefetch RSC).
 */
export interface SpatialPanelCardProps {
  payload?: Record<string, unknown>;
  initialCockpitData?: CockpitTodayPayload | null;
}

export const SPATIAL_PANEL_REGISTRY: Partial<
  Record<SpatialPanelType, ComponentType<SpatialPanelCardProps>>
> = {
  brief: CockpitBriefCard,
  kpi: CockpitKPICard,
  mission: CockpitMissionCard,
  assets: CockpitAssetsCard,
  "chat-response": CockpitChatResponseCard,
  approval: CockpitApprovalCard,
  "asset-preview": CockpitAssetPreviewCard,
  // Les autres types seront ajoutés au fil de l'eau (notification, kpi-pulse, etc.)
};
