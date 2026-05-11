'use client';

import React from 'react';
import { useRuntimeStore } from '@/stores/runtime';
import { useFocalStore } from '@/stores/focal';
import { BriefPanel, MissionPanel, AssetsPanel } from '../panels';
import { CommandBar } from './CommandBar';
import { SPATIAL_Z_LAYERS } from '@/lib/spatial/constants';
import type { CockpitTodayPayload } from '@/lib/cockpit/today';

const EMPTY_SECONDARY: never[] = [];

export interface SpatialOverlayManagerProps {
  initialCockpitData?: CockpitTodayPayload | null;
}

export function SpatialOverlayManager({ initialCockpitData = null }: SpatialOverlayManagerProps) {
  const coreState = useRuntimeStore((s) => s.coreState);
  const currentPlan = useRuntimeStore((s) => s.currentPlan);
  const secondary = useFocalStore((s) => s.secondary) ?? EMPTY_SECONDARY;

  const isRunning = coreState === 'streaming' || coreState === 'processing';
  const isAwaiting = coreState === 'awaiting_approval' || coreState === 'awaiting_clarification';
  const hasMission = !!currentPlan;
  const hasAssets = secondary.length > 0;

  return (
    <>
      {/* Bento grid — colonne gauche, 4 colonnes × 3 rangées */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start p-6 md:p-10"
        style={{ zIndex: SPATIAL_Z_LAYERS.surface }}
      >
        <div
          className="grid h-[min(640px,80vh)] w-[min(720px,52vw)] gap-4"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            perspective: '1200px',
          }}
        >
          <BriefPanel show={!isRunning && !hasMission} />
          <MissionPanel show={isRunning || isAwaiting || hasMission} />
          <AssetsPanel show={!isRunning && hasAssets} />
        </div>
      </div>

      {/* Chat Bar */}
      <CommandBar show={true} />

      {/* Reserve l'usage futur de la donnée cockpit pour P2 — pour l'instant
          on l'ignore tant que les overlays P2 ne sont pas montés. */}
      {initialCockpitData ? null : null}
    </>
  );
}
