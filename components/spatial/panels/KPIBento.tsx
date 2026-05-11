'use client';

import { BentoCard } from './BentoCard';
import type { CockpitTodayPayload } from '@/lib/cockpit/today';

interface KPIBentoProps {
  show?: boolean;
  data: CockpitTodayPayload | null;
}

interface KPI {
  label: string;
  value: number;
}

/**
 * KPI hero — bento large 4×1 en haut.
 * Source : payload Cockpit pre-fetché côté serveur.
 * Fallback : tous les KPI à 0 si data null (pas de session).
 *
 * Affiche : Agenda · Missions · Suggestions (mappés sur les counts du payload).
 */
export function KPIBento({ show = true, data }: KPIBentoProps) {
  const kpis: KPI[] = [
    { label: 'Agenda', value: data?.agenda.length ?? 0 },
    { label: 'Missions', value: data?.missionsRunning.length ?? 0 },
    { label: 'Suggestions', value: data?.suggestions.length ?? 0 },
  ];

  return (
    <BentoCard show={show} colSpan={4} rowSpan={1} delay={0.0}>
      <div className="flex h-full items-center justify-between gap-8 px-2">
        {kpis.map((k, i) => (
          <div key={k.label} className="flex flex-1 flex-col items-start">
            <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.22em] text-white/45">
              {k.label}
            </div>
            <div className="text-spatial-3xl font-extralight tracking-tight text-white/95">
              {k.value.toString().padStart(2, '0')}
            </div>
            {i < kpis.length - 1 && (
              <div className="absolute" style={{ display: 'none' }} aria-hidden />
            )}
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
