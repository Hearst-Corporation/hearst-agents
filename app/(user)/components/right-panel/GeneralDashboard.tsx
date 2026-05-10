"use client";

/**
 * GeneralDashboard — rail droit Cockpit (mode cockpit/chat).
 *
 * Layout instrument panel : 5 sections FIXES qui occupent toute la hauteur
 * disponible sans scroll. Proportions flex, zéro saut de layout.
 * Sections vides → CTA actionnables, jamais masquées.
 *
 *  1. MOTEUR    (shrink-0)   — état moteur IA + compteurs clés
 *  2. À VALIDER (flex-1)     — propositions d'agents en attente
 *  3. MISSIONS  (flex-[3])   — missions en vie + statuts live
 *  4. ACTIVITÉ  (flex-[2])   — flux d'événements récents
 *  5. ACCÈS     (shrink-0)   — 2 CTAs primaires toujours visibles
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";
import { useNotificationsStore } from "@/stores/notifications";
import { useDashboardCounts } from "./use-dashboard-counts";

// ── Helpers ────────────────────────────────────────────────────

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

function relativeTime(ts: number): string {
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

// ── Section shell — titre + slot contenu fixe ──────────────────

function RailPane({
  label,
  badge,
  children,
  flex,
  className = "",
}: {
  label: string;
  badge?: ReactNode;
  children: ReactNode;
  flex?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col min-h-0 ${className}`}
      style={{ flex: flex ?? "1 1 0" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "var(--space-3) var(--space-4) var(--space-2)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          className="t-9 font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}
        >
          {label}
        </span>
        {badge}
      </div>
      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}

// ── Empty state CTA ────────────────────────────────────────────

function PaneCTA({
  label,
  onClick,
  href,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const router = useRouter();
  const go = onClick ?? (() => href && router.push(href));
  return (
    <div className="flex-1 flex items-center justify-center" style={{ padding: "var(--space-4)" }}>
      <button
        type="button"
        onClick={go}
        className="t-11 font-light transition-colors"
        style={{ color: "var(--text-faint)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-teal)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; }}
      >
        {label} →
      </button>
    </div>
  );
}

// ── Badge compteur ─────────────────────────────────────────────

function CountBadge({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span
      className="t-9 font-mono tabular-nums"
      style={{ color: "var(--text-faint)" }}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 1 — MOTEUR (shrink-0)
// ══════════════════════════════════════════════════════════════

function MoteurSection() {
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
  const stateColor = coreState === "error" ? "var(--danger)"
    : coreState === "idle" ? "var(--accent-teal)"
    : "var(--accent-teal)";

  const alertCount = notifications.filter(
    (n) => (n.severity === "critical" || n.severity === "warning") && n.read_at === null,
  ).length;

  return (
    <div
      className="shrink-0 flex items-center"
      style={{
        gap: "var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Status dot */}
      <span
        className="shrink-0 rounded-full"
        style={{
          width: 8,
          height: 8,
          background: stateColor,
          boxShadow: isIdle ? "none" : `0 0 6px ${stateColor}`,
          animation: isIdle ? "none" : "pulse-status-accent-teal 2s ease-in-out infinite",
        }}
        aria-hidden
      />

      {/* State + clock */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
        <span className="t-11 font-medium" style={{ color: stateColor }}>
          {stateLabel}
        </span>
        <div className="flex items-center" style={{ gap: "var(--space-4)" }}>
          <span className="t-9 font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
            {counts.missionsActive ?? 0} actifs
          </span>
          <span className="t-9 font-mono tabular-nums" style={{ color: alertCount > 0 ? "var(--warn)" : "var(--text-faint)" }}>
            {alertCount} alertes
          </span>
        </div>
      </div>

      {/* Clock */}
      <span className="t-9 font-mono tabular-nums shrink-0" style={{ color: "var(--text-faint)" }}>
        {now ? TIME_FMT.format(now) : "--:--"}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 2 — À VALIDER (flex-1)
// ══════════════════════════════════════════════════════════════

function ValiderSection() {
  const router = useRouter();
  // TODO: câbler à un store de propositions d'agents autonomes
  const pending: { agent: string; title: string } | null = null as { agent: string; title: string } | null;

  return (
    <RailPane label="À valider" badge={<CountBadge n={pending ? 1 : null} />} flex="1 1 0">
      {pending ? (
        <div className="flex-1 flex flex-col justify-between" style={{ padding: "var(--space-3) var(--space-4)" }}>
          <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span className="t-9 font-light italic" style={{ color: "var(--accent-teal)" }}>
              {pending.agent} propose
            </span>
            <span className="t-13 font-light" style={{ color: "var(--text-soft)" }}>
              {pending.title}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <button
              type="button"
              className="flex-1 t-9 font-light transition-colors rounded-sm"
              style={{
                padding: "var(--space-2)",
                color: "var(--text-faint)",
                border: "1px solid var(--border-soft)",
              }}
            >
              Refuser
            </button>
            <button
              type="button"
              className="flex-1 t-9 font-medium transition-colors rounded-sm"
              style={{
                padding: "var(--space-2)",
                color: "var(--accent-teal)",
                background: "var(--accent-teal-surface)",
                border: "1px solid var(--accent-teal-border)",
              }}
            >
              Valider
            </button>
          </div>
        </div>
      ) : (
        <PaneCTA label="Démarrer une mission" onClick={() => router.push("/missions/builder")} />
      )}
    </RailPane>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 3 — MISSIONS EN VIE (flex-3)
// ══════════════════════════════════════════════════════════════

function MissionsSection() {
  const router = useRouter();
  const setMode = useStageStore((s) => s.setMode);
  const counts = useDashboardCounts();
  const missions = counts.missionsLive;

  return (
    <RailPane
      label="Missions en vie"
      badge={<CountBadge n={counts.missionsTotal} />}
      flex="3 1 0"
      className="border-t border-[var(--border-subtle)]"
    >
      {missions.length === 0 ? (
        <PaneCTA label="Créer une première mission" onClick={() => router.push("/missions/builder")} />
      ) : (
        <ul className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ padding: "var(--space-2) 0" }}>
          {missions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setMode({ mode: "mission", missionId: m.id })}
                className="w-full flex items-center text-left transition-colors group"
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  gap: "var(--space-3)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Status dot */}
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: missionStatusColor(m.status),
                    boxShadow: m.status === "running" ? `0 0 5px var(--accent-teal)` : "none",
                    animation: m.status === "running" ? "pulse-status-accent-teal 2s ease-in-out infinite" : "none",
                  }}
                  aria-hidden
                />
                {/* Name */}
                <span className="flex-1 min-w-0 t-11 font-light truncate" style={{ color: "var(--text-soft)" }}>
                  {m.name}
                </span>
                {/* Status label */}
                <span className="t-9 font-light shrink-0" style={{ color: missionStatusColor(m.status) }}>
                  {MISSION_STATUS_LABEL[m.status] ?? m.status}
                </span>
              </button>
            </li>
          ))}
          {/* Voir toutes */}
          <li>
            <button
              type="button"
              onClick={() => router.push("/missions")}
              className="w-full flex items-center justify-end t-9 font-light transition-colors"
              style={{
                padding: "var(--space-2) var(--space-4)",
                color: "var(--text-faint)",
                marginTop: "auto",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-teal)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; }}
            >
              Voir toutes →
            </button>
          </li>
        </ul>
      )}
    </RailPane>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 4 — ACTIVITÉ RÉCENTE (flex-2)
// ══════════════════════════════════════════════════════════════

const EVENT_ICON: Record<string, string> = {
  asset_generated: "▦",
  run_completed: "✓",
  run_failed: "✗",
  run_started: "◉",
  connection_added: "⊕",
  connection_error: "⊗",
};

const EVENT_COLOR: Record<string, string> = {
  asset_generated: "var(--accent-teal)",
  run_completed: "var(--money)",
  run_failed: "var(--danger)",
  run_started: "var(--accent-teal)",
  connection_added: "var(--accent-teal)",
  connection_error: "var(--warn)",
};

function ActiviteSection() {
  const events = useRuntimeStore((s) => s.events).slice(0, 5);

  return (
    <RailPane
      label="Activité récente"
      flex="2 1 0"
      className="border-t border-[var(--border-subtle)]"
    >
      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ padding: "var(--space-4)" }}>
          <span className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
            Aucune activité récente
          </span>
        </div>
      ) : (
        <ul className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ padding: "var(--space-2) 0" }}>
          {events.map((ev, i) => {
            const icon = EVENT_ICON[ev.type] ?? "·";
            const color = EVENT_COLOR[ev.type] ?? "var(--text-faint)";
            const label = (ev as Record<string, unknown>).name as string
              ?? (ev as Record<string, unknown>).message as string
              ?? ev.type;
            const ts = (ev as Record<string, unknown>).ts as number | undefined ?? 0;
            return (
              <li
                key={i}
                className="flex items-baseline"
                style={{ padding: "var(--space-2) var(--space-4)", gap: "var(--space-3)" }}
              >
                <span className="t-9 shrink-0 font-mono" style={{ color }}>{icon}</span>
                <span className="flex-1 min-w-0 t-11 font-light truncate" style={{ color: "var(--text-soft)" }}>
                  {label}
                </span>
                <span className="t-9 font-mono tabular-nums shrink-0" style={{ color: "var(--text-faint)" }}>
                  {relativeTime(ts)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </RailPane>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION 5 — ACCÈS (shrink-0)
// ══════════════════════════════════════════════════════════════

function AccesSection() {
  const router = useRouter();
  const counts = useDashboardCounts();

  const srcLabel = counts.connectionsConnected !== null && counts.connectionsTotal !== null
    ? `Sources  ${counts.connectionsConnected} / ${counts.connectionsTotal}`
    : "Sources";

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        padding: "var(--space-3) var(--space-4)",
        gap: "var(--space-2)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/missions/builder")}
        className="w-full t-11 font-medium text-left transition-colors rounded-md"
        style={{
          padding: "var(--space-2) var(--space-3)",
          background: "var(--accent-teal-surface)",
          border: "1px solid var(--accent-teal-border)",
          color: "var(--accent-teal)",
          transitionDuration: "var(--duration-base)",
        }}
      >
        + Nouvelle mission
      </button>
      <button
        type="button"
        onClick={() => router.push("/apps")}
        className="w-full t-11 font-light text-left flex items-center justify-between transition-colors rounded-md"
        style={{
          padding: "var(--space-2) var(--space-3)",
          background: "transparent",
          border: "1px solid var(--border-soft)",
          color: "var(--text-muted)",
          transitionDuration: "var(--duration-base)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-soft)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        <span>{srcLabel}</span>
        <span style={{ color: "var(--text-faint)" }}>→</span>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT EXPORT
// ══════════════════════════════════════════════════════════════

export function GeneralDashboard() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <MoteurSection />
      <ValiderSection />
      <MissionsSection />
      <ActiviteSection />
      <AccesSection />
    </div>
  );
}
