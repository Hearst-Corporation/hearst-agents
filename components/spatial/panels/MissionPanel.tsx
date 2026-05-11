'use client';

import { BentoCard } from './BentoCard';
import { MiniChart } from './MiniChart';

type MissionState = 'idle' | 'running';

interface MissionPanelProps {
  show: boolean;
  state?: MissionState;
}

/**
 * Mission — bento tall (col 1 × row 2).
 * État réel : idle ou analyse en cours, avec mini-chart d'activité.
 */
export function MissionPanel({ show, state = 'idle' }: MissionPanelProps) {
  const running = state === 'running';

  return (
    <BentoCard show={show} colSpan={1} rowSpan={2} delay={0.18}>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Mission
          </div>
          <div className="text-spatial-2xl font-extralight tracking-tight text-white/95">
            {running ? 'Analyse en cours' : 'Aucune mission'}
          </div>
        </div>

        <MiniChart bars={12} intervalMs={running ? 1500 : 4000} />

        <div className="flex items-center gap-3">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: running ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
              boxShadow: running
                ? '0 0 10px rgba(255,255,255,0.6)'
                : '0 0 4px rgba(255,255,255,0.25)',
              animation: running ? 'spatial-mission-pulse 2.4s ease-in-out infinite' : undefined,
            }}
          />
          <div className="text-spatial-sm font-light tracking-wide text-white/55">
            {running ? 'Agents mobilisés' : 'En attente'}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
