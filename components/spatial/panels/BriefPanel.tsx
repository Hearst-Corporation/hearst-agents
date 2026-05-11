'use client';

import { useMemo } from 'react';
import { BentoCard } from './BentoCard';

interface BriefPanelProps {
  show: boolean;
  /** Nombre de sujets à traiter — 3 par défaut */
  count?: number;
}

/**
 * Brief — bento large (col 2 × row 2).
 * Information principale du dashboard spatial.
 */
export function BriefPanel({ show, count = 3 }: BriefPanelProps) {
  const timeString = useMemo(() => {
    const t = new Date();
    t.setHours(t.getHours() + 1);
    t.setMinutes(0);
    return t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }, []);

  return (
    <BentoCard show={show} colSpan={2} rowSpan={2} delay={0.05}>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Brief
          </div>
          <div className="mb-3 text-spatial-3xl font-extralight tracking-tight text-white/95">
            Bonjour
          </div>
          <p className="text-spatial-base font-light leading-[1.65] text-white/70">
            Aujourd&apos;hui, vous avez un meeting à {timeString}. {count} sujets demandent
            votre attention.
          </p>
        </div>
        <div className="text-spatial-3xl font-light tracking-[-0.04em] text-white/95">
          {count.toString().padStart(2, '0')}
          <span className="ml-2 text-spatial-base font-light text-white/45">sujets</span>
        </div>
      </div>
      <div
        className="absolute right-7 top-7 h-2 w-2 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.85)',
          boxShadow: '0 0 12px rgba(255,255,255,0.6)',
        }}
      />
    </BentoCard>
  );
}
