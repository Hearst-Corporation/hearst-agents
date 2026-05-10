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
    <FloatingPanel show={show} anchor="left" delay={0.05} width={272}>
      <div className="px-7 py-7">
        <div className="text-white/45 text-[10px] tracking-[0.34em] uppercase font-light mb-5">
          Brief
        </div>
        <p className="text-white/90 text-[13px] font-light leading-[1.65]">
          {count} sujets demandent votre attention.
        </p>
        <div className="mt-6 h-px w-8 bg-white/15" />
        <div className="mt-5 text-white/55 text-[11px] font-light leading-[1.7]">
          Marché. Équipe. Décision en attente.
        </div>
      </div>
    </FloatingPanel>
  );
}
