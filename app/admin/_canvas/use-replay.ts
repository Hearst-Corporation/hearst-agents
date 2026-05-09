/** TODO stub — voir docs/AGENT-DRIVEN-DEV.md
 *
 * Hook de replay temporel d'événements persistés. Stub no-op typé.
 * À implémenter : timeline progression, vitesses 0.5×/1×/2×/4×, seek, play/pause.
 */

"use client";

interface PersistedEvent {
  type: string;
  ts: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface ReplayController {
  isPlaying: boolean;
  progress: number;
  speed: number;
  playToggle: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
  seek: (progress: number) => void;
}

export function useReplay(_events: PersistedEvent[]): ReplayController {
  return {
    isPlaying: false,
    progress: 0,
    speed: 1,
    playToggle: () => {
      /* TODO stub — no-op */
    },
    setSpeed: (_speed: number) => {
      /* TODO stub — no-op */
    },
    reset: () => {
      /* TODO stub — no-op */
    },
    seek: (_progress: number) => {
      /* TODO stub — no-op */
    },
  };
}
