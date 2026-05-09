"use client";

import dynamic from "next/dynamic";
import { CockpitHeader } from "./CockpitHeader";
import { ActivityStrip } from "./ActivityStrip";
import { KPIStrip } from "./KPIStrip";
import { CockpitAgenda } from "./CockpitAgenda";
import { WatchlistMini } from "./WatchlistMini";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

// Three.js manipule WebGL au mount → ssr:false obligatoire.
const ParticlesWave = dynamic(
  () => import("./ParticlesWave").then((m) => m.ParticlesWave),
  { ssr: false, loading: () => null },
);

interface CockpitHomeProps {
  data: CockpitTodayPayload;
}

/**
 * CockpitHome — home Cockpit (mode="cockpit").
 *
 * Pivot v1.4 (silent luxury OS, 2026-05-09) : padding généreux, atmosphère
 * centrale qui fill l'espace vide (60-70%), KPIs flottants pinned en bas,
 * accordion Agenda & watchlist replié par défaut.
 *
 * Layout : Header → ActivityStrip → ParticlesWave (centerpiece atmosphérique)
 *          → KPIStrip → Agenda & watchlist (collapsed).
 */
export function CockpitHome({ data }: CockpitHomeProps) {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
      style={{
        padding: "var(--space-12) var(--space-16)",
        gap: "var(--space-7)",
      }}
    >
      <CockpitHeader data={data} />
      <ActivityStrip data={data} />

      <div
        className="relative flex-1 min-h-0"
        style={{ minHeight: "var(--space-48)" }}
        aria-hidden
      >
        <ParticlesWave />
      </div>

      <KPIStrip data={data} />

      <details
        className="shrink-0"
        style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "var(--space-2)" }}
      >
        <summary
          className="cursor-pointer flex items-center gap-2 t-13 font-light text-[var(--text-faint)] transition-colors hover:text-[var(--text-soft)] group"
          style={{ listStyle: "none" }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 -rotate-90 group-open:rotate-0 text-[var(--text-muted)]"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Agenda & watchlist
        </summary>
        <div
          className="grid min-h-0 shrink-0"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "var(--space-9)",
            marginTop: "var(--space-4)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid var(--border-soft)",
            maxHeight: "min(160px, 24vh)",
            overflowY: "auto",
          }}
        >
          <CockpitAgenda data={data} />
          <WatchlistMini data={data} />
        </div>
      </details>
    </div>
  );
}
