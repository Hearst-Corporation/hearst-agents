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

import { useEffect, useState, type ReactNode } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";
import { useNotificationsStore } from "@/stores/notifications";
import { Action, RailSection } from "../ui";
import { useDashboardCounts } from "./use-dashboard-counts";

// ── Helpers ────────────────────────────────────────────────────

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
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
  paused: "En pause",
  failed: "Échec",
  completed: "Terminé",
};

function missionStatusColor(status: string): string {
  if (status === "running") return "var(--accent-teal)";
  if (status === "failed") return "var(--danger)";
  if (status === "paused") return "var(--text-faint)";
  return "var(--text-muted)";
}

// ── Slots centrés pour RailSection flex ────────────────────────

function CenteredCTA({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      {children}
    </div>
  );
}

function CenteredNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <span className="t-11 font-light text-[var(--text-faint)]">
        {children}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 1 — MOTEUR (shrink-0, ~80px)
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
  const stateColor = coreState === "error" ? "var(--danger)" : "var(--accent-teal)";

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
        className="shrink-0 rounded-full"
        style={{
          width: 8,
          height: 8,
          background: stateColor,
          boxShadow: isIdle ? "none" : "var(--shadow-pulse-dot)",
          animation: isIdle ? "none" : "pulse-status-accent-teal 2s ease-in-out infinite",
        }}
      />
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
        <span className="t-13 font-medium" style={{ color: stateColor }}>
          {stateLabel}
        </span>
        <span className="t-11 font-light text-[var(--text-faint)]">
          {counts.missionsActive ?? 0} actifs · {alertCount} alerte{alertCount > 1 ? "s" : ""}
        </span>
      </div>
      <span className="t-11 font-mono tabular-nums shrink-0 text-[var(--text-faint)]">
        {now ? TIME_FMT.format(now) : "--:--"}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 2 — À VALIDER (flex 1)
// ══════════════════════════════════════════════════════════════

function ValiderZone() {
  // TODO: câbler à un store de propositions d'agents autonomes
  const pending: { agent: string; title: string } | null = null as { agent: string; title: string } | null;

  return (
    <RailSection
      label="À valider"
      count={pending ? 1 : undefined}
      flex="1 1 0"
    >
      {pending ? (
        <div className="flex-1 flex flex-col justify-between" style={{ gap: "var(--space-3)" }}>
          <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span className="t-11 font-light italic text-[var(--accent-teal)]">
              {pending.agent} propose
            </span>
            <span className="t-13 font-light text-[var(--text-soft)]">
              {pending.title}
            </span>
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
      ) : (
        <CenteredNote>Rien en attente</CenteredNote>
      )}
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
      label="Missions en vie"
      count={counts.missionsTotal ?? undefined}
      action={missions.length > 0 && (
        <Action variant="link" tone="brand" href="/missions">
          Toutes
        </Action>
      )}
      flex="3 1 0"
      className="border-t border-[var(--border-subtle)]"
    >
      {missions.length === 0 ? (
        <CenteredCTA>
          <Action variant="link" tone="brand" href="/missions/builder">
            Créer une première mission →
          </Action>
        </CenteredCTA>
      ) : (
        <ul className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ gap: "var(--space-1)" }}>
          {missions.map((m) => {
            const color = missionStatusColor(m.status);
            const isRunning = m.status === "running";
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setMode({ mode: "mission", missionId: m.id })}
                  className="w-full flex items-center text-left rounded-sm transition-colors hover:bg-[var(--bg-soft)]"
                  style={{
                    padding: "var(--space-2)",
                    gap: "var(--space-3)",
                    transitionDuration: "var(--duration-base)",
                  }}
                >
                  <span
                    aria-hidden
                    className="shrink-0 rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      background: color,
                      boxShadow: isRunning ? "var(--shadow-pulse-dot-sm)" : "none",
                      animation: isRunning ? "pulse-status-accent-teal 2s ease-in-out infinite" : "none",
                    }}
                  />
                  <span className="flex-1 min-w-0 t-13 font-light truncate text-[var(--text-soft)]">
                    {m.name}
                  </span>
                  <span className="t-11 font-light shrink-0" style={{ color }}>
                    {MISSION_STATUS_LABEL[m.status] ?? m.status}
                  </span>
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

function ActiviteZone() {
  const events = useRuntimeStore((s) => s.events).slice(0, 5);

  return (
    <RailSection
      label="Activité récente"
      flex="2 1 0"
      className="border-t border-[var(--border-subtle)]"
    >
      {events.length === 0 ? (
        <CenteredNote>Aucune activité récente</CenteredNote>
      ) : (
        <ul className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ gap: "var(--space-1)" }}>
          {events.map((ev, i) => {
            const glyph = EVENT_GLYPH[ev.type] ?? "·";
            const color = EVENT_COLOR[ev.type] ?? "var(--text-faint)";
            const label = (ev as Record<string, unknown>).name as string
              ?? (ev as Record<string, unknown>).message as string
              ?? ev.type;
            const ts = (ev as Record<string, unknown>).ts as number | undefined ?? 0;
            return (
              <li
                key={i}
                className="flex items-baseline"
                style={{ padding: "var(--space-1) var(--space-2)", gap: "var(--space-3)" }}
              >
                <span className="t-11 shrink-0 font-mono" style={{ color }}>
                  {glyph}
                </span>
                <span className="flex-1 min-w-0 t-13 font-light truncate text-[var(--text-soft)]">
                  {label}
                </span>
                <span className="t-9 font-mono tabular-nums shrink-0 text-[var(--text-faint)]">
                  {relativeTime(ts)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
