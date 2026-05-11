'use client';

/**
 * useSplineStateBridge — push l'état runtime + voice dans la scène Spline.
 *
 * Mappe :
 *  - voice phase  → key A..E (si voiceActive prend la priorité)
 *  - core state   → key A,D,E,F (sinon)
 *  - variable Spline `mood` (string) pour drive shaders / posture / halo
 *
 * Décision : voice prioritaire quand le pipeline WebRTC est actif. Le user
 * voit directement le robot répondre à son micro même si une run /api/orchestrate
 * tourne en parallèle.
 *
 * Tous les emit/setVar sont no-op si la scène ne définit pas la state ou la
 * variable correspondante (cf. useSplineApp).
 */

import { useEffect } from 'react';
import { useVoiceStore, type VoicePhase } from '@/stores/voice';
import { useRuntimeStore, type CoreState } from '@/stores/runtime';
import type { UseSplineApp } from './useSplineApp';

const PHASE_TO_SPLINE_KEY: Record<VoicePhase, string> = {
  idle: 'A',
  connecting: 'D',
  listening: 'B',
  speaking: 'C',
  processing: 'D',
  error: 'E',
};

const CORE_TO_SPLINE_KEY: Record<CoreState, string> = {
  idle: 'A',
  connecting: 'D',
  streaming: 'D',
  processing: 'D',
  error: 'E',
  awaiting_approval: 'F',
  awaiting_clarification: 'F',
};

export function useSplineStateBridge(spline: UseSplineApp) {
  const voicePhase = useVoiceStore((s) => s.phase);
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  const coreState = useRuntimeStore((s) => s.coreState);

  useEffect(() => {
    if (!spline.ready.current) return;

    // Voice prend la priorité quand le pipeline WebRTC est actif
    const useVoice = voiceActive;
    const key = useVoice
      ? PHASE_TO_SPLINE_KEY[voicePhase]
      : CORE_TO_SPLINE_KEY[coreState];
    const moodLabel = useVoice ? voicePhase : coreState;

    if (!key) return;

    // 1) Trigger d'event sur l'objet "Robot" (l'éditeur Spline doit avoir
    //    branché les States A..F sur cet objet via keyDown 'A','B',...)
    spline.emit('keyDown', 'Robot');

    // 2) Push variable `mood` — la scène peut la lire pour drive shader/anim
    spline.setVar('mood', moodLabel);
  }, [voicePhase, coreState, voiceActive, spline]);
}
