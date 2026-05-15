"use client";

/**
 * GeneralDashboard — rail droit Cockpit (mode cockpit/chat).
 *
 * Layout instrument panel : 4 zones FIXES occupant toute la hauteur sans scroll,
 * sections vides → état neutre ou CTA unique, jamais de saut de layout.
 *
 *   1. Moteur     (shrink-0)   — état moteur + compteurs + horloge
 *   2. À valider  (flex 1)     — propositions agents en attente
 *   3. Missions   (flex 3)     — missions en vie (seul endroit qui pousse "créer")
 *   4. Activité   (flex 2)     — flux events runtime
 *
 * Sources sont déjà dans la PulseBar (header "N / M services") → pas dupliquées.
 * "Nouvelle mission" vit uniquement dans l'empty state Missions.
 *
 * 100 % primitives DS : <RailSection flex>, <Action>.
 */

import { useEffect, useState } from "react";
import { useNotificationsStore } from "@/stores/notifications";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";
import { Action, RailSection } from "../ui";
import { useDashboardCounts } from "./use-dashboard-counts";

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function relativeTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return TIME_FMT.format(new Date(ts));
  return "hier";
}

const STATE_LABEL: Record<string, string> = {
  idle: "En ligne",
  connecting: "Connexion…",
  streaming: "En cours",
  processing: "Traitement",
  error: "Erreur",
  awaiting_approval: "Validation",
  awaiting_clarification: "Précision",
};

const MISSION_STATUS_LABEL: Record<string, string> = {
  running: "En cours",
  active: "Actif",
  scheduled: "Planifié",
  queued: "En file",
  paused: "En pause",
  failed: "Échec",
  error: "Erreur",
  completed: "Terminé",
  success: "Terminé",
  done: "Terminé",
};

function missionStatusColor(status: string): string {
  if (status === "running") return "var(--accent-teal)";
  if (status === "failed" || status === "error") return "var(--danger)";
  if (status === "paused") return "var(--text-faint)";
  if (status === "completed" || status === "success" || status === "done")
    return "var(--accent-teal)";
  return "var(--text-muted)";
}

function _FileGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// 1 — MOTEUR (shrink-0)
// ══════════════════════════════════════════════════════════════

function MoteurZone() {
  const coreState = useRuntimeStore((s) => s.coreState);
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  const notifications = useNotificationsStore((s) => s.notifications);
  const counts = useDashboardCounts();

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    queueMicrotask(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isIdle = coreState === "idle";
  const stateLabel = voiceActive ? "Session vocale" : (STATE_LABEL[coreState] ?? "En ligne");
  const dotColor = coreState === "error" ? "var(--danger)" : "var(--accent-teal)";
  // Silent luxury : label moteur reste neutre, seul le dot porte la couleur
  // au repos. Le label ne s'illumine que quand un état appelle l'attention
  // (erreur, attente d'approbation).
  const needsAttention = coreState === "error" || coreState === "awaiting_approval";
  const labelColor = needsAttention ? dotColor : "var(--text-soft)";

  const alertCount = notifications.filter(
    (n) => (n.severity === "critical" || n.severity === "warning") && n.read_at === null,
  ).length;

  return (
    <div
      className="shrink-0 flex items-center"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        aria-hidden
        className="shrink-0 rounded-full w-2 h-2"
        style={{
          background: dotColor,
          boxShadow: isIdle ? "none" : "var(--shadow-pulse-dot)",
          animation: isIdle ? "none" : "pulse-status-accent-teal 2s ease-in-out infinite",
        }}
      />
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: "var(--space-0-5)" }}>
        <span className="t-11 font-medium" style={{ color: labelColor }}>
          {stateLabel}
        </span>
        <span className="t-11 font-light text-text-faint">
          {counts.missionsActive ?? 0} actifs · {alertCount} alerte{alertCount > 1 ? "s" : ""}
        </span>
      </div>
      <span className="t-11 font-mono tabular-nums shrink-0 text-text-faint">
        {now ? TIME_FMT.format(now) : "--:--"}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 2 — À VALIDER (flex 1)
// ══════════════════════════════════════════════════════════════

function ValiderZone() {
  // Phase future : câbler au store de propositions d'agents autonomes (useAgentProposals)
  const pending: { agent: string; title: string } | null = null as {
    agent: string;
    title: string;
  } | null;

  // Empty → section compacte (pas de flex), pour libérer la hauteur au profit
  // des Missions / Activité. Présence → flex 1.
  if (!pending) {
    return (
      <RailSection label="À valider">
        <span className="t-11 font-light text-text-faint">Rien en attente</span>
      </RailSection>
    );
  }

  return (
    <RailSection label="À valider" count={1} flex="1 1 0">
      <div className="flex-1 flex flex-col justify-between" style={{ gap: "var(--space-3)" }}>
        <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          <span className="t-11 font-light italic text-(--accent-teal)">
            {pending.agent} propose
          </span>
          <span className="t-13 font-light text-text-soft">{pending.title}</span>
        </div>
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <Action variant="secondary" tone="neutral" size="sm" className="flex-1">
            Refuser
          </Action>
          <Action variant="secondary" tone="brand" size="sm" className="flex-1">
            Valider
          </Action>
        </div>
      </div>
    </RailSection>
  );
}

// ══════════════════════════════════════════════════════════════
// 3 — MISSIONS (flex 3)
// ══════════════════════════════════════════════════════════════

function MissionsZone() {
  const setMode = useStageStore((s) => s.setMode);
  const counts = useDashboardCounts();
  const missions = counts.missionsLive;

  return (
    <RailSection
      label="Missions"
      count={counts.missionsTotal ?? undefined}
      action={
        missions.length > 0 && (
          <Action variant="ghost" tone="neutral" size="sm" href="/missions">
            Toutes
          </Action>
        )
      }
      className="border-t border-(--border-subtle)"
    >
      {counts.initialLoading ? (
        // Skeleton anti-flash : tant que le premier fetch n'a pas répondu,
        // on évite de montrer "Créer une première mission" puis de switcher
        // brutalement vers la liste 200ms plus tard.
        <span className="t-11 font-light text-text-faint">Chargement…</span>
      ) : missions.length === 0 ? (
        <Action variant="ghost" tone="brand" size="sm" href="/missions/builder">
          Créer une première mission →
        </Action>
      ) : (
        <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {missions.map((m, index) => {
            const color = missionStatusColor(m.status);
            const statusLabel = MISSION_STATUS_LABEL[m.status] ?? m.status;
            const isRunning = m.status === "running";
            const isCompleted =
              m.status === "completed" || m.status === "success" || m.status === "done";
            const fakeProgress = isRunning
              ? Math.max(20, 100 - (index + 1) * 20)
              : isCompleted
                ? 100
                : 0;
            const showBar = isRunning;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setMode({ mode: "mission", missionId: m.id })}
                  aria-label={`${m.name} — ${statusLabel}`}
                  className="dashboard-row w-full flex flex-col text-left"
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-soft)",
                  }}
                >
                  <div className="flex items-center w-full" style={{ gap: "var(--space-3)" }}>
                    <span
                      aria-hidden
                      className="shrink-0 rounded-full w-2 h-2"
                      style={{ background: color }}
                    />
                    <span className="t-13 font-light flex-1 min-w-0 truncate text-text-soft">
                      {m.name}
                    </span>
                    <span
                      className="t-11 font-light tabular-nums shrink-0"
                      style={{ color: showBar ? "var(--text-faint)" : color }}
                    >
                      {showBar ? `${fakeProgress}%` : statusLabel}
                    </span>
                  </div>
                  {showBar && (
                    <div
                      className="w-full overflow-hidden"
                      style={{
                        height: "2px",
                        background: "var(--progress-track)",
                        borderRadius: "1px",
                        marginTop: "var(--space-3)",
                      }}
                    >
                      <div
                        style={{
                          width: `${fakeProgress}%`,
                          height: "100%",
                          background: color,
                          boxShadow: isRunning ? "var(--shadow-pulse-dot)" : "none",
                          borderRadius: "1px",
                          transition: "width var(--duration-emphasis) var(--ease-out-soft)",
                        }}
                      />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </RailSection>
  );
}

// ══════════════════════════════════════════════════════════════
// 4 — ACTIVITÉ (flex 2)
// ══════════════════════════════════════════════════════════════

const EVENT_GLYPH: Record<string, string> = {
  asset_generated: "▦",
  run_completed: "✓",
  run_failed: "✗",
  run_started: "◉",
  connection_added: "⊕",
  connection_error: "⊗",
};

const EVENT_COLOR: Record<string, string> = {
  asset_generated: "var(--accent-teal)",
  run_completed: "var(--accent-teal)",
  run_failed: "var(--danger)",
  run_started: "var(--accent-teal)",
  connection_added: "var(--accent-teal)",
  connection_error: "var(--warn)",
};

interface ActivityItem {
  key: string;
  type: string;
  label: string;
  ts: number;
}

function ActiviteZone() {
  // Source 1 : events SSE du run courant (chat actif). Live, éphémère.
  const liveEvents = useRuntimeStore((s) => s.events);

  // Source 2 : runs récents persistés en DB. Survivent au reload, montrent
  // l'historique d'activité réelle de l'utilisateur. Sans cette source, la
  // zone reste vide tant qu'aucun chat n'est en cours.
  const [recentRuns, setRecentRuns] = useState<
    Array<{ id: string; input: string; status: string; createdAt: number; completedAt?: number }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const res = await fetch("/api/v2/right-panel", { cache: "no-store", credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (cancelled || !res?.recentRuns) return;
      setRecentRuns(res.recentRuns.slice(0, 8));
    }
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Fusion → 5 items les plus récents par timestamp.
  const items: ActivityItem[] = [];
  for (const ev of liveEvents) {
    const ts =
      ((ev as Record<string, unknown>).ts as number | undefined) ??
      ((ev as Record<string, unknown>).timestamp as number | undefined) ??
      0;
    const label =
      ((ev as Record<string, unknown>).name as string) ??
      ((ev as Record<string, unknown>).message as string) ??
      ev.type;
    items.push({ key: `live-${ts}-${ev.type}`, type: ev.type, label, ts });
  }
  for (const run of recentRuns) {
    const ts = run.completedAt ?? run.createdAt;
    const type = run.status === "failed" ? "run_failed" : "run_completed";
    const label = run.input.length > 60 ? `${run.input.slice(0, 60)}…` : run.input;
    items.push({ key: `run-${run.id}`, type, label, ts });
  }
  const sorted = items.sort((a, b) => b.ts - a.ts).slice(0, 5);

  if (sorted.length === 0) {
    return (
      <RailSection label="Activité en temps réel" className="border-t border-(--border-subtle)">
        <span className="t-11 font-light text-text-faint">Aucune activité récente</span>
      </RailSection>
    );
  }

  return (
    <RailSection label="Activité en temps réel" className="border-t border-(--border-subtle)">
      <ul className="flex flex-col" style={{ gap: "var(--space-1)" }}>
        {sorted.map((ev) => {
          const label = ev.label;
          const ts = ev.ts;
          const glyph = EVENT_GLYPH[ev.type] ?? "·";
          const tone = EVENT_COLOR[ev.type] ?? "var(--text-muted)";
          return (
            <li
              key={ev.key}
              className="dashboard-row flex items-center"
              style={{
                padding: "var(--space-2) var(--space-3)",
                gap: "var(--space-4)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <span
                className="flex items-center justify-center shrink-0 t-13"
                style={{
                  width: "var(--space-6)",
                  height: "var(--space-6)",
                  background: "var(--surface-icon-tile)",
                  borderRadius: "var(--radius-sm)",
                  color: tone,
                }}
                aria-hidden
              >
                {glyph}
              </span>
              <span className="t-13 font-light flex-1 min-w-0 truncate text-text-soft">
                {label}
              </span>
              <span className="t-11 font-light tabular-nums shrink-0 text-text-faint">
                {relativeTime(ts)}
              </span>
            </li>
          );
        })}
      </ul>
    </RailSection>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════

export function GeneralDashboard() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <MoteurZone />
      <ValiderZone />
      <MissionsZone />
      <ActiviteZone />
    </div>
  );
}
