"use client";

import { CockpitCardShell } from "./CockpitCardShell";

const ASSETS = [
  { name: "Brief Q2.pdf", size: "1.2 MB" },
  { name: "Pitch deck — Hearst.key", size: "8.7 MB" },
  { name: "Notes meeting.md", size: "12 KB" },
];

/**
 * Card Assets — bandeau bas plein largeur, 3 assets en ligne + total à droite.
 */
export function CockpitAssetsCard() {
  return (
    <CockpitCardShell>
      <div className="flex h-full items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col">
          <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Assets récents
          </div>
          <div className="flex gap-5">
            {ASSETS.map((a) => (
              <div key={a.name} className="flex min-w-0 flex-col">
                <span className="text-spatial-base font-light text-white/85 truncate">
                  {a.name}
                </span>
                <span className="text-spatial-xs font-mono text-white/40">{a.size}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-baseline gap-2 text-white/95">
          <span className="text-spatial-3xl font-light tracking-[-0.04em]">12</span>
          <span className="text-spatial-base font-light text-white/45">au total</span>
        </div>
      </div>
    </CockpitCardShell>
  );
}
