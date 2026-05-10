"use client";

import { FloatingPanel } from "./FloatingPanel";

interface AssetsPanelProps {
  show: boolean;
  /** Nombre de documents récents — 2 par défaut */
  count?: number;
}

/**
 * Assets — panel bas-centre, format compact.
 * Information utile en première ligne, détail discret en dessous.
 */
export function AssetsPanel({ show, count = 2 }: AssetsPanelProps) {
  const assets = [
    { label: "Analyse de marché", time: "hier" },
    { label: "Briefing Q2",       time: "lun." },
  ];

  return (
    <FloatingPanel show={show} anchor="bottom-center" delay={0.32} width={300}>
      <div className="px-7 py-6">
        <div className="text-white/45 text-[10px] tracking-[0.34em] uppercase font-light mb-3">
          Assets
        </div>
        <p className="text-white/90 text-[13px] font-light leading-[1.65] mb-5">
          {count} documents récents.
        </p>
        <div className="flex flex-col gap-2.5">
          {assets.slice(0, count).map((a) => (
            <div key={a.label} className="flex items-baseline justify-between gap-6">
              <div className="text-white/75 text-[12px] font-light tracking-wide truncate">
                {a.label}
              </div>
              <div className="text-white/40 text-[11px] font-light shrink-0">
                {a.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FloatingPanel>
  );
}
