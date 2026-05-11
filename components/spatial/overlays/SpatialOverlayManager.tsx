'use client';

import React from 'react';
import { useRuntimeStore } from '@/stores/runtime';
import { useNavigationStore } from '@/stores/navigation';
import { useFocalStore } from '@/stores/focal';
import { BriefPanel, MissionPanel, AssetsPanel } from '../panels';
import { CommandBar } from './CommandBar';
import { SPATIAL_Z_LAYERS } from '@/lib/spatial/constants';

const EMPTY_SECONDARY: never[] = [];

export function SpatialOverlayManager() {
  const coreState = useRuntimeStore((s) => s.coreState);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const messagesRaw = useNavigationStore((s) =>
    activeThreadId ? s.messages[activeThreadId] : undefined,
  );
  const messages = React.useMemo(() => messagesRaw ?? [], [messagesRaw]);
  const secondary = useFocalStore((s) => s.secondary) ?? EMPTY_SECONDARY;

  const subjectsCount = messages.filter((m) => m.role === 'user').length;
  const assetsCount = secondary.length;
  const isRunning = coreState === 'streaming' || coreState === 'processing';
  const isAwaiting = coreState === 'awaiting_approval' || coreState === 'awaiting_clarification';

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
          <BriefPanel show={!isRunning} count={subjectsCount || 3} />
          <MissionPanel show={isRunning || isAwaiting} state={isRunning ? 'running' : 'idle'} />
          <AssetsPanel show={!isRunning && assetsCount > 0} count={assetsCount || 2} />
        </div>
      </div>

      {/* Chat Bar */}
      <CommandBar show={true} onSubmit={(text) => console.log('User submitted:', text)} />
    </>
  );
}
