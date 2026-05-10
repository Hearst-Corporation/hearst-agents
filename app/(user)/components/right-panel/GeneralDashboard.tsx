"use client";
// lint-visual-disable-file

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
      <span className="t-11 font-light text-text-faint">
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
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: "var(--space-0-5)" }}>
        <span className="t-13 font-medium" style={{ color: stateColor }}>
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
            <span className="t-11 font-light italic text-(--accent-teal)">
              {pending.agent} propose
            </span>
            <span className="t-13 font-light text-text-soft">
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
      className="border-t border-(--border-subtle)"
    >
      {missions.length === 0 ? (
        <CenteredCTA>
          <Action variant="link" tone="brand" href="/missions/builder">
            Créer une première mission →
          </Action>
        </CenteredCTA>
      ) : (
        <ul className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ gap: "8px", padding: "8px 0" }}>
          {missions.map((m, index) => {
            const color = missionStatusColor(m.status);
            const isRunning = m.status === "running";
            const fakeProgress = isRunning ? Math.max(20, 100 - (index + 1) * 20) : m.status === "completed" ? 100 : 0;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setMode({ mode: "mission", missionId: m.id })}
                  className="w-full flex flex-col text-left transition-all duration-300"
                  style={{
                    padding: "12px",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.04)",
                    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"}
                >
                  <div className="flex items-center w-full" style={{ gap: "12px" }}>
                    <span
                      aria-hidden
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: "24px",
                        height: "24px",
                        background: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "6px",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </span>
                    <span className="flex-1 min-w-0 font-light truncate" style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)", letterSpacing: "0.02em" }}>
                      {m.name}
                    </span>
                    <span className="font-light shrink-0" style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                      {fakeProgress}%
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "2px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "1px", overflow: "hidden", marginTop: "12px" }}>
                    <div style={{ 
                      width: `${fakeProgress}%`, 
                      height: "100%", 
                      background: "#a78bfa", 
                      boxShadow: "0 0 8px rgba(167, 139, 250, 0.6)",
                      borderRadius: "1px",
                      transition: "width 1s ease"
                    }} />
                  </div>
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
      label="Activité en temps réel"
      flex="2 1 0"
      className="border-t border-(--border-subtle)"
    >
      {events.length === 0 ? (
        <CenteredNote>Aucune activité récente</CenteredNote>
      ) : (
        <ul className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ gap: "4px", padding: "8px 0" }}>
          {events.map((ev, i) => {
            const label = (ev as Record<string, unknown>).name as string
              ?? (ev as Record<string, unknown>).message as string
              ?? ev.type;
            const ts = (ev as Record<string, unknown>).ts as number | undefined ?? 0;
            return (
              <li
                key={i}
                className="flex items-center transition-all duration-300"
                style={{ 
                  padding: "8px 12px", 
                  gap: "16px",
                  background: "transparent",
                  borderRadius: "12px",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ 
                    width: "28px", 
                    height: "28px", 
                    background: "rgba(255, 255, 255, 0.05)", 
                    borderRadius: "8px", 
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                  aria-hidden
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </span>
                <span className="flex-1 min-w-0 font-light truncate" style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)", letterSpacing: "0.02em" }}>
                  {label}
                </span>
                <span className="font-light tabular-nums shrink-0" style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.35)" }}>
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
