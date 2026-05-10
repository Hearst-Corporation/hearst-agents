"use client";

import { CockpitHeader } from "./CockpitHeader";
import { MorningBriefing } from "./MorningBriefing";
import { TodayAgenda } from "./TodayAgenda";
import { AgentWorking } from "./AgentWorking";
import { WhenYouHave5Min } from "./WhenYouHave5Min";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface CockpitHomeProps {
  data: CockpitTodayPayload;
  /** Callback pour regénérer le brief depuis CockpitStage */
  onRefresh?: () => Promise<void>;
}

/**
 * CockpitHome — home Cockpit "OS humain" (pivot v1.6, 2026-05-10).
 *
 * Suppression définitive : KPIStrip (assets/missions/reports), WatchlistMini
 * (MRR/ARR/Runway/Pipeline), centerpiece 3D, ParticlesWave, hospitality
 * vertical. La home redevient personnelle, narrative, sans jargon SaaS.
 *
 * Layout vertical :
 *   1. Header (greeting + date)
 *   2. Briefing du matin (1 phrase + 3 bullets)
 *   3. Aujourd'hui (agenda)
 *   4. Ton agent travaille
 *   5. À regarder quand tu auras 5 min
 *
 * Une seule colonne, pas de grid 2-cols : la home se lit comme un journal.
 */
export function CockpitHome({ data, onRefresh }: CockpitHomeProps) {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto"
      style={{
        padding: "var(--space-12) var(--space-16)",
        gap: "var(--space-10)",
      }}
    >
      <CockpitHeader generatedAt={data.generatedAt} onRefresh={onRefresh} />

      <MorningBriefing data={data} />

      <div
        className="flex flex-col"
        style={{
          gap: "var(--space-10)",
          paddingTop: "var(--space-6)",
          borderTop: "1px solid var(--border-soft)",
        }}
      >
        <TodayAgenda data={data} />
        <AgentWorking data={data} />
        <WhenYouHave5Min data={data} />
      </div>
    </div>
  );
}
