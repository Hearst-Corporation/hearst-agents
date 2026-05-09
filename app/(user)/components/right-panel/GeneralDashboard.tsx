"use client";

/**
 * GeneralDashboard — sub-rail droit Cockpit/Chat, refonte graphique 2026-05-08.
 *
 * 3 sections premium, inspirées des maquettes B/principal :
 *   ③ Actions rapides   — cards dark avec icône + titre caps + flèche
 *   ④ Statut            — roue SVG + dot cykan + 4 lignes infos
 *   ⑤ Contexte          — card agent rich ou focal selon mode
 *
 * La constellation WebGL (Strate 2) et la strip agents (Strate 2.5) sont
 * au-dessus dans ContextRail.CockpitChatBody — ce composant ne les rend pas.
 *
 * Spec : docs/screens/right-panel-dashboard.md
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";
import { useFocalStore } from "@/stores/focal";
import { useSelectionStore, type Selection } from "@/stores/selection";
import { useNotificationsStore } from "@/stores/notifications";
import { AGENT_METADATA, type AgentRoleId } from "@/lib/cockpit/agents";
import { AGENT_ICON_MAP } from "./AgentIcons";

// ── Voix éditoriale FR ───────────────────────────────────────

const CORE_STATE_LABEL: Record<string, string> = {
  idle: "En ligne",
  connecting: "Connexion",
  streaming: "En cours",
  processing: "Traitement",
  error: "Erreur",
  awaiting_approval: "Validation requise",
  awaiting_clarification: "Précision requise",
};

// ── Actions config ────────────────────────────────────────────

interface ActionItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}

// ──────────────────────────────────────────────────────────────

export function GeneralDashboard() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
      <QuickActions />
      <StatusSection />
      <SelectedContext />
    </div>
  );
}

// ── Strate 3 — Actions rapides ───────────────────────────────

function QuickActions() {
  const router = useRouter();
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);

  const actions: ActionItem[] = [
    {
      id: "mission",
      label: "Nouvelle mission",
      description: "Créer une mission automatisée",
      icon: <MissionIcon />,
      onClick: () => router.push("/missions/builder"),
    },
    {
      id: "report",
      label: "Nouveau rapport",
      description: "Générer un rapport",
      icon: <ReportIcon />,
      onClick: () => router.push("/reports"),
    },
    {
      id: "source",
      label: "Ajouter une source",
      description: "Connecter un service",
      icon: <SourceIcon />,
      onClick: () => router.push("/apps"),
    },
    {
      id: "analyse",
      label: "Lancer analyse",
      description: "Démarrer une analyse",
      icon: <AnalyseIcon />,
      onClick: () => setCommandeurOpen(true, { prefilledQuery: "Analyser " }),
    },
  ];

  return (
    <section style={{ padding: "var(--space-4) var(--space-4) var(--space-3)" }}>
      <SectionLabel label="Actions rapides" icon={<LightningIcon />} />
      <ul className="flex flex-col" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        {actions.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={a.onClick}
              className="group flex items-center w-full text-left bg-[var(--surface-1)] border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] hover:border-[var(--cykan-border)] transition-colors duration-(--duration-fast) ease-(--ease-standard) focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cykan)]"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {/* Icône dans cercle */}
              <span
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: "var(--space-8)",
                  height: "var(--space-8)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-2)",
                  color: "var(--text-ghost)",
                }}
              >
                {a.icon}
              </span>
              {/* Texte */}
              <span className="flex flex-col flex-1 min-w-0">
                <span
                  className="t-11 font-medium uppercase tracking-wide"
                  style={{ color: "var(--text-l2)", letterSpacing: "var(--tracking-wide)" }}
                >
                  {a.label}
                </span>
                <span className="t-9 font-light truncate" style={{ color: "var(--text-faint)" }}>
                  {a.description}
                </span>
              </span>
              {/* Arrow */}
              <span
                className="shrink-0 t-13 font-mono group-hover:text-[var(--cykan)] transition-colors"
                style={{ color: "var(--text-faint)" }}
                aria-hidden
              >
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Strate 4 — Statut (roue SVG) ────────────────────────────

function StatusSection() {
  const router = useRouter();
  const coreState = useRuntimeStore((s) => s.coreState);
  const events = useRuntimeStore((s) => s.events);
  const stageMode = useStageStore((s) => s.current.mode);
  const setMode = useStageStore((s) => s.setMode);
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  const notifications = useNotificationsStore((s) => s.notifications);

  // Live clock
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    queueMicrotask(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const timeLabel = now
    ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  const isIdle = coreState === "idle";

  // Session active
  const session: string | null = voiceActive
    ? "Session vocale"
    : stageMode === "browser" ? "Session navigateur"
    : stageMode === "meeting" ? "Réunion en cours"
    : null;

  const onOpenSession = () => {
    if (voiceActive) setMode({ mode: "voice" });
    else if (stageMode === "browser") setMode({ mode: "browser", sessionId: "" });
    else if (stageMode === "meeting") setMode({ mode: "meeting", meetingId: "" });
  };

  // Alerte
  const alert = notifications.find(
    (n) => (n.severity === "critical" || n.severity === "warning") && n.read_at === null,
  ) ?? null;

  // Dernière activité
  const lastAssetEvent = events.find((e) => e.type === "asset_generated");
  const lastActivity = lastAssetEvent
    ? ((lastAssetEvent as Record<string, unknown>).name as string ?? "Livrable")
    : null;

  return (
    <section
      style={{
        padding: "var(--space-4)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <SectionLabel label="Statut" icon={<RadarIcon />} />

      {/* Roue de statut */}
      <div
        className="flex items-center"
        style={{ gap: "var(--space-4)", marginTop: "var(--space-3)" }}
      >
        {/* SVG roue */}
        <div className="shrink-0 relative flex items-center justify-center" style={{ width: "var(--space-16)", height: "var(--space-16)" }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
            {/* Ring extérieur */}
            <circle
              cx="32" cy="32" r="28"
              stroke="var(--border-subtle)"
              strokeWidth="1.5"
            />
            {/* Arc actif (quand non-idle) */}
            {!isIdle && (
              <circle
                cx="32" cy="32" r="28"
                stroke="var(--cykan)"
                strokeWidth="1.5"
                strokeDasharray="176"
                strokeDashoffset="44"
                strokeLinecap="round"
                style={{
                  transformOrigin: "center",
                  transform: "rotate(-90deg)",
                  animation: "pulse-status-cykan 2s ease-in-out infinite",
                }}
              />
            )}
            {/* Ring intérieur */}
            <circle cx="32" cy="32" r="20" stroke="var(--border-subtle)" strokeWidth="1" opacity={0.5} />
            {/* Dot central */}
            <circle
              cx="32" cy="32" r="5"
              fill="var(--cykan)"
              style={{
                filter: isIdle ? "none" : "drop-shadow(0 0 4px var(--cykan))",
              }}
            />
          </svg>
        </div>

        {/* Infos à droite de la roue */}
        <div className="flex flex-col min-w-0 flex-1" style={{ gap: "var(--space-2)" }}>
          <div className="flex items-center justify-between">
            <span className="t-11 font-medium" style={{ color: "var(--cykan)" }}>
              {CORE_STATE_LABEL[coreState] ?? "En ligne"}
            </span>
            <span className="t-9 font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
              {timeLabel}
            </span>
          </div>

          <StatusRow label="Session">
            {session ? (
              <button
                type="button"
                onClick={onOpenSession}
                className="t-9 font-light hover:text-[var(--cykan)] transition-colors truncate text-left"
                style={{ color: "var(--text-l2)" }}
              >
                {session}
              </button>
            ) : (
              <span className="t-9 font-light" style={{ color: "var(--text-faint)" }}>Aucune</span>
            )}
          </StatusRow>

          <StatusRow label="Alerte">
            {alert ? (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="t-9 font-light hover:text-[var(--cykan)] transition-colors truncate text-left"
                style={{ color: alert.severity === "critical" ? "var(--danger)" : "var(--warn)" }}
              >
                {alert.title}
              </button>
            ) : (
              <span className="t-9 font-light" style={{ color: "var(--text-faint)" }}>Aucune</span>
            )}
          </StatusRow>

          <StatusRow label="Activité">
            {lastActivity ? (
              <span className="t-9 font-light truncate" style={{ color: "var(--text-l2)" }}>
                {lastActivity}
              </span>
            ) : (
              <span className="t-9 font-light" style={{ color: "var(--text-faint)" }}>Aucune</span>
            )}
          </StatusRow>
        </div>
      </div>
    </section>
  );
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline" style={{ gap: "var(--space-2)" }}>
      <span
        className="t-9 font-medium uppercase shrink-0"
        style={{ color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)", minWidth: "var(--space-14)" }}
      >
        {label}
      </span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </div>
  );
}

// ── Strate 5 — Contexte sélectionné ──────────────────────────

function SelectedContext() {
  const stageMode = useStageStore((s) => s.current.mode);
  const selection = useSelectionStore((s) => s.current);
  const focal = useFocalStore((s) => s.focal);
  const inCockpit = stageMode === "cockpit";

  if (inCockpit) return <CockpitContextSection selection={selection} />;
  return <ChatContextSection focal={focal} />;
}

function CockpitContextSection({ selection }: { selection: Selection | null }) {
  const router = useRouter();
  const setMode = useStageStore((s) => s.setMode);
  const clearSelection = useSelectionStore((s) => s.clear);

  const handleOpen = () => {
    if (!selection) return;
    if (selection.kind === "agent") {
      const meta = AGENT_METADATA[selection.id as AgentRoleId];
      if (!meta) return;
      if (meta.openTarget.kind === "route") router.push(meta.openTarget.path);
      else setMode({ mode: meta.openTarget.mode });
      return;
    }
    if (selection.kind === "mission") { setMode({ mode: "mission", missionId: selection.id }); return; }
    if (selection.kind === "asset") { setMode({ mode: "asset", assetId: selection.id }); return; }
    if (selection.kind === "report") { router.push("/reports"); return; }
  };

  if (!selection) {
    return (
      <section style={{ padding: "var(--space-4)" }}>
        <SectionLabel label="Contexte actuel" icon={<ContextIcon />} />
        <p
          className="t-11 font-light"
          style={{ color: "var(--text-faint)", marginTop: "var(--space-3)", lineHeight: "var(--leading-relaxed)" }}
        >
          Sélectionne un agent ou un objet pour voir son contexte.
        </p>
      </section>
    );
  }

  const isAgent = selection.kind === "agent";
  const agentMeta = isAgent ? AGENT_METADATA[selection.id as AgentRoleId] : null;

  return (
    <section style={{ padding: "var(--space-4)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
        <SectionLabel label="Contexte actuel" icon={<ContextIcon />} />
        <button
          type="button"
          onClick={clearSelection}
          className="t-9 font-mono hover:text-[var(--cykan)] transition-colors"
          style={{ color: "var(--text-faint)" }}
          aria-label="Effacer la sélection"
        >
          ×
        </button>
      </div>

      {/* Card contexte */}
      <button
        type="button"
        onClick={handleOpen}
        className="group flex items-center w-full text-left bg-[var(--surface-1)] border border-[var(--cykan-border)] hover:bg-[var(--surface-2)] transition-colors duration-(--duration-fast) ease-(--ease-standard) focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cykan)]"
        style={{
          gap: "var(--space-3)",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        {/* Icône agent ou type objet */}
        <span
          className="shrink-0 flex items-center justify-center"
          style={{
            width: "var(--space-10)",
            height: "var(--space-10)",
            borderRadius: "var(--radius-pill)",
            background: "color-mix(in srgb, var(--cykan) 10%, transparent)",
            border: "1px solid var(--cykan-border)",
            color: "var(--cykan)",
          }}
        >
          <AgentOrObjectIcon isAgent={isAgent} roleId={selection.id as AgentRoleId} kind={selection.kind} />
        </span>

        <span className="flex flex-col flex-1 min-w-0">
          {isAgent && (
            <span className="t-9 font-medium uppercase" style={{ color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)" }}>
              Agent sélectionné
            </span>
          )}
          <span className="t-13 font-medium truncate" style={{ color: "var(--text)" }}>
            {isAgent ? agentMeta?.label : (selection.label ?? selection.id)}
          </span>
          {isAgent && agentMeta && (
            <span className="t-9 font-light truncate" style={{ color: "var(--text-faint)" }}>
              {agentMeta.tagline}
            </span>
          )}
        </span>

        <span
          className="shrink-0 t-13 font-mono group-hover:text-[var(--cykan)] transition-colors"
          style={{ color: "var(--text-faint)" }}
          aria-hidden
        >
          ›
        </span>
      </button>
    </section>
  );
}

function ChatContextSection({ focal }: { focal: ReturnType<typeof useFocalStore.getState>["focal"] }) {
  if (!focal) {
    return (
      <section style={{ padding: "var(--space-4)" }}>
        <SectionLabel label="Contexte actuel" icon={<ContextIcon />} />
        <p className="t-11 font-light" style={{ color: "var(--text-faint)", marginTop: "var(--space-3)" }}>
          Aucun focal actif sur ce thread.
        </p>
      </section>
    );
  }
  return (
    <section style={{ padding: "var(--space-4)" }}>
      <SectionLabel label="Contexte actuel" icon={<ContextIcon />} />
      <div
        className="flex flex-col"
        style={{
          gap: "var(--space-2)",
          marginTop: "var(--space-3)",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <span className="t-9 font-medium uppercase" style={{ color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)" }}>
          {FOCAL_TYPE_LABEL[focal.type] ?? focal.type}
        </span>
        <span className="t-13 font-medium truncate" style={{ color: "var(--text)" }}>{focal.title}</span>
        {focal.summary && (
          <span className="t-9 font-light" style={{ color: "var(--text-faint)", lineHeight: "var(--leading-relaxed)" }}>
            {focal.summary}
          </span>
        )}
      </div>
    </section>
  );
}

const FOCAL_TYPE_LABEL: Record<string, string> = {
  message_draft: "Brouillon",
  message_receipt: "Envoi",
  brief: "Briefing",
  outline: "Plan",
  report: "Rapport",
  doc: "Document",
  watcher_draft: "Veille (brouillon)",
  watcher_active: "Veille",
  mission_draft: "Mission (brouillon)",
  mission_active: "Mission",
};

// ── Icône contexte (agent ou objet) ──────────────────────────

function AgentOrObjectIcon({
  isAgent,
  roleId,
  kind,
}: {
  isAgent: boolean;
  roleId: AgentRoleId;
  kind: string;
}) {
  if (isAgent) {
    const Icon = AGENT_ICON_MAP[roleId];
    return Icon ? <Icon color="var(--cykan)" /> : null;
  }
  return <ObjectContextIcon kind={kind} />;
}

function ObjectContextIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "mission": return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "asset":   return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case "report":  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>;
    default: return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/></svg>;
  }
}

// ── Sous-composants layout ─────────────────────────────────────

function SectionLabel({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
      <span style={{ color: "var(--text-faint)" }} aria-hidden>{icon}</span>
      <span
        className="t-9 font-medium uppercase tracking-wide"
        style={{ color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Icônes sections ───────────────────────────────────────────

function LightningIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function RadarIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/></svg>;
}
function ContextIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>;
}

// ── Icônes actions ────────────────────────────────────────────

function MissionIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function ReportIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>;
}
function SourceIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
}
function AnalyseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
