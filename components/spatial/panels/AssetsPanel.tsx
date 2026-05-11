'use client';

import { BentoCard } from './BentoCard';

interface AssetsPanelProps {
  show: boolean;
  /** Nombre de documents récents — 2 par défaut */
  count?: number;
}

/**
 * Assets — bento wide (col 2 × row 1).
 * Liste compacte des documents récents.
 */
export function AssetsPanel({ show, count = 2 }: AssetsPanelProps) {
  const assets = [
    { label: 'Analyse de marché', time: 'hier' },
    { label: 'Briefing Q2', time: 'lun.' },
    { label: 'Note stratégique', time: 'lun.' },
    { label: 'Rapport secteur', time: 'sam.' },
  ];

  return (
    <BentoCard show={show} colSpan={2} rowSpan={1} delay={0.32}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              Assets
            </div>
            <div className="text-spatial-2xl font-extralight tracking-tight text-white/95">
              {count} documents récents
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {assets.slice(0, count).map((a) => (
            <div
              key={a.label}
              className="flex items-baseline justify-between gap-6 border-t border-white/5 pt-2 first:border-t-0 first:pt-0"
            >
              <div className="truncate text-spatial-base font-light tracking-wide text-white/85">
                {a.label}
              </div>
              <div className="shrink-0 text-spatial-sm font-light text-white/45">{a.time}</div>
            </div>
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
