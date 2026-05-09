"use client";

import { CockpitHeader } from "./CockpitHeader";
import { ActivityStrip } from "./ActivityStrip";
import { KPIStrip } from "./KPIStrip";
import { CockpitAgenda } from "./CockpitAgenda";
import { WatchlistMini } from "./WatchlistMini";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface CockpitHomeProps {
  data: CockpitTodayPayload;
}

/**
 * CockpitHome — home Cockpit (mode="cockpit").
 *
 * Pivot v1.5 (silent luxury OS, 2026-05-10) : suppression du centerpiece
 * 3D ParticlesWave + son halo radial. Les KPIs montent en hero typographique
 * (t-60) centrés dans l'espace libéré ; Agenda + Watchlist décompressés en
 * bas, plus dans un accordion. Le cockpit lit en first-glance : pouls
 * (KPIs) puis aujourd'hui (agenda/watchlist).
 *
 * Layout : Header → ActivityStrip → KPIs hero (centered flex-1) →
 *          Agenda + Watchlist (grid 2-col).
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

      <div className="flex-1 flex items-center justify-center min-h-0">
        <KPIStrip data={data} />
      </div>

      <div
        className="grid min-h-0 shrink-0"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "var(--space-9)",
          paddingTop: "var(--space-4)",
          borderTop: "1px solid var(--border-soft)",
          maxHeight: "min(180px, 26vh)",
          overflowY: "auto",
        }}
      >
        <CockpitAgenda data={data} />
        <WatchlistMini data={data} />
      </div>
    </div>
  );
}
