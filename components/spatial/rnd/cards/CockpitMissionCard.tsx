"use client";

import { CockpitCardShell } from "./CockpitCardShell";

/**
 * Card Mission — bandeau format réduit (col-span-2 row-span-1).
 * Titre + steps inline, pas de bloc texte vertical lourd.
 */
export function CockpitMissionCard() {
  return (
    <CockpitCardShell>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              Mission
            </span>
            <span className="text-spatial-xs font-light text-white/55">3/7 étapes</span>
          </div>
          <div className="text-spatial-xl font-extralight tracking-tight text-white/95 line-clamp-1">
            Daily brief en cours
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 0 10px rgba(255,255,255,0.6)",
              animation: "spatial-mission-pulse 2.4s ease-in-out infinite",
            }}
          />
          <span className="text-spatial-sm font-light tracking-wide text-white/65">
            Agents mobilisés
          </span>
        </div>
      </div>
    </CockpitCardShell>
  );
}
