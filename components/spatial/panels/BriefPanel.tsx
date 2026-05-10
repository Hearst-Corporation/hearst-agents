"use client";

import { FloatingPanel } from "./FloatingPanel";

interface BriefPanelProps {
  show: boolean;
  /** Nombre de sujets à traiter — 3 par défaut */
  count?: number;
}

/**
 * Brief — panel gauche.
 * Information utile : nombre de sujets demandant attention.
 */
export function BriefPanel({ show, count = 3 }: BriefPanelProps) {
  return (
    <FloatingPanel show={show} anchor="left" delay={0.05} width={240}>
      <div className="px-6 py-6">
        <div className="text-white/30 text-[9px] tracking-[0.3em] uppercase font-light mb-4">
          Brief
        </div>
        <p className="text-white/70 text-[12px] font-light leading-[1.6]">
          {count} sujets demandent votre attention.
        </p>
        <div className="mt-5 h-px w-6 bg-white/10" />
        <div className="mt-4 text-white/40 text-[10px] font-light leading-[1.6]">
          Marché. Équipe. Décision.
        </div>
      </div>
    </FloatingPanel>
  );
}
