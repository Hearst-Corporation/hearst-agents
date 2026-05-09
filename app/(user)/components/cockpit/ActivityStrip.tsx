"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRuntimeStore } from "@/stores/runtime";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface ActivityStripProps {
  data: CockpitTodayPayload;
}

const IDLE_HIDE_MS = 5 * 60_000;

function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 1_000) return "à l'instant";
  if (diff < 60_000) return `il y a ${Math.floor(diff / 1_000)}s`;
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  return `il y a ${Math.floor(diff / 3_600_000)}h`;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

const SSE_TYPE_FR: Record<string, string> = {
  step_started: "Étape lancée",
  step_completed: "Étape terminée",
  run_started: "Run démarré",
  run_completed: "Run terminé",
  run_failed: "Run échoué",
  text_delta: "Texte généré",
  asset_generated: "Asset généré",
  focal_object_ready: "Asset prêt",
  approval_requested: "Validation requise",
  clarification_requested: "Précision requise",
  plan_preview: "Plan prêt",
  plan_step_started: "Étape du plan lancée",
  plan_step_completed: "Étape du plan terminée",
};

function prettifyType(type: string): string {
  return SSE_TYPE_FR[type] ?? type.replace(/_/g, " ");
}

export function ActivityStrip({ data }: ActivityStripProps) {
  const coreState = useRuntimeStore((s) => s.coreState);
  const events = useRuntimeStore((s) => s.events);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const isLive = coreState === "streaming" || coreState === "processing" || coreState === "connecting";
  const runningCount = data.missionsRunning.filter((m) => m.status === "running").length;

  const lastEvent = useMemo(() => {
    if (!events || events.length === 0) return null;
    return events[events.length - 1];
  }, [events]);

  const lastMissionRun = useMemo(() => {
    let best: { name: string; ts: number; status: string } | null = null;
    for (const m of data.missionsRunning) {
      if (typeof m.lastRunAt !== "number") continue;
      if (!best || m.lastRunAt > best.ts) {
        best = { name: m.name, ts: m.lastRunAt, status: m.status };
      }
    }
    return best;
  }, [data.missionsRunning]);

  const lastTs = lastEvent?.timestamp ?? lastMissionRun?.ts ?? data.generatedAt;
  const idleSince = now - lastTs;
  const isHidden =
    !isLive && runningCount === 0 && !lastEvent && !lastMissionRun && idleSince > IDLE_HIDE_MS;

  if (isHidden) {
    return (
      <div
        className="flex items-center shrink-0"
        style={{
          height: "var(--space-10)",
          padding: "var(--space-2) 0",
          borderTop: "1px solid var(--border-soft)",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <span className="t-11 font-light text-[var(--text-faint)]">Système au repos</span>
      </div>
    );
  }

  const tickerLabel = (() => {
    if (lastEvent) {
      const label = lastEvent["label"];
      if (typeof label === "string" && label.length > 0) return label;
      return prettifyType(lastEvent.type);
    }
    if (lastMissionRun) {
      const verb =
        lastMissionRun.status === "success"
          ? "Mission réussie"
          : lastMissionRun.status === "failed"
            ? "Mission échouée"
            : "Dernière mission";
      return `${verb} : ${lastMissionRun.name}`;
    }
    if (data.briefing && !data.briefing.empty && data.briefing.generatedAt) {
      return "Briefing du jour disponible";
    }
    return "Aucune activité récente";
  })();

  return (
    <div
      className="grid items-center shrink-0"
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        gap: "var(--space-4)",
        padding: "var(--space-2) 0",
        borderTop: "1px solid var(--border-soft)",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      {/* Gauche : compteur en cours */}
      <div className="flex items-center gap-2">
        {isLive && (
          <span
            aria-hidden
            className="block w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] animate-pulse"
            style={{ boxShadow: "0 0 5px rgba(74, 139, 134, 0.32)" }}
          />
        )}
        <span className="t-11 font-light tabular-nums text-[var(--accent-teal)]">
          {runningCount} en cours
        </span>
      </div>

      {/* Centre : ticker */}
      <div className="flex items-center gap-2 min-w-0 justify-self-center">
        <span className="t-11 font-mono tabular-nums text-[var(--text-faint)] shrink-0">
          {formatTs(lastTs)}
        </span>
        <span className="t-11 text-[var(--text-faint)]">·</span>
        <span className="t-11 font-light text-[var(--text-soft)] truncate">{tickerLabel}</span>
      </div>

      {/* Droite : last activity + log link */}
      <div className="flex items-center gap-2 justify-self-end">
        <span className="t-11 font-light text-[var(--text-faint)]">
          {relativeTime(lastTs, now)}
        </span>
        <span className="t-11 text-[var(--text-faint)]">·</span>
        <Link
          href="/runs"
          className="t-11 font-light text-[var(--text-soft)] hover:text-[var(--accent-teal)] transition-colors"
        >
          logs →
        </Link>
      </div>
    </div>
  );
}
