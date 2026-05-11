"use client";

import { CockpitCardShell } from "./CockpitCardShell";

/**
 * Card Brief — éditorial du jour, données mockées.
 */
export function CockpitBriefCard() {
  return (
    <CockpitCardShell>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          Brief
        </span>
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: "rgba(255,255,255,0.85)",
            boxShadow: "0 0 12px rgba(255,255,255,0.6)",
          }}
        />
      </div>
      <div className="mb-3 text-spatial-3xl font-extralight tracking-tight text-white/95">
        Bonjour
      </div>
      <p className="text-spatial-base font-light leading-[1.65] text-white/70">
        Aujourd&apos;hui, vous avez un meeting à 14:00. 3 sujets demandent votre attention.
      </p>
      <div className="mt-4 text-spatial-3xl font-light tracking-[-0.04em] text-white/95">
        03
        <span className="ml-2 text-spatial-base font-light text-white/45">sujets</span>
      </div>
    </CockpitCardShell>
  );
}
