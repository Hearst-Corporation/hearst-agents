"use client";

import { CockpitCardShell } from "./CockpitCardShell";

const KPIS = [
  { label: "Agenda", value: "02" },
  { label: "Missions", value: "01" },
  { label: "Assets", value: "12" },
];

/**
 * Card KPI bento — 3 chiffres clés du jour, données mockées.
 * Format bandeau (large, peu haut). On garde 3 KPIs pour respirer.
 */
export function CockpitKPICard() {
  return (
    <CockpitCardShell>
      <div className="flex h-full items-center justify-around gap-4">
        {KPIS.map((k) => (
          <div key={k.label} className="flex min-w-0 flex-col items-start">
            <div className="mb-1.5 text-spatial-xs font-semibold uppercase tracking-[0.22em] text-white/45">
              {k.label}
            </div>
            <div className="text-spatial-3xl font-extralight tracking-tight text-white/95">
              {k.value}
            </div>
          </div>
        ))}
      </div>
    </CockpitCardShell>
  );
}
