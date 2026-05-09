"use client";

/**
 * GeneralDashboard — sub-rail droit Cockpit/Chat, refonte graphique 2026-05-08.
 *
 * 3 sections premium, inspirées des maquettes B/principal :
 *   ③ Actions rapides   — cards dark avec icône + titre caps + flèche
 *   ④ Statut            — roue SVG + dot accent-teal + 4 lignes infos
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
import { useDashboardCounts } from "./use-dashboard-counts";

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

interface ModuleAction {
  id: string;
  label: string;
  state: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  /** Si true, badge teal pulsant top-right (proposition d'agent autonome en attente). */
  hasValidation?: boolean;
}

/** Format compteur : "12" ou "—" si inconnu. */
function fmtCount(n: number | null): string {
  if (n === null) return "—";
  return String(n);
}

/**
 * Stub : à remplacer par un hook réel `usePendingAgentProposals()` qui lit un
 * futur store des propositions d'agents autonomes (mission proposée par
 * Cortex / Pilot / etc., en attente de validation utilisateur).
 *
 * Pour l'instant retourne toujours null. Le câblage data viendra dans une
 * future PR (mécanisme calqué sur ApprovalInline du chat).
 */
function usePendingValidationStub(): { agent: string; missionTitle: string } | null {
  return null;
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

// ── Strate 3 — Actions rapides (modules tactiles + validation inline) ──

function QuickActions() {
  const router = useRouter();
  const counts = useDashboardCounts();

  // Stub validation : à câbler à un futur store de propositions d'agents
  // autonomes (cf. spec context-rail v1.1 — "validation inline" pattern,
  // ré-utilisera le mécanisme draft-first du chat / ApprovalInline).
  const pendingValidation = usePendingValidationStub();

  const actions: ModuleAction[] = [
    {
      id: "mission",
      label: "Mission",
      state: fmtCount(counts.missionsTotal),
      icon: <MissionIcon />,
      onClick: () => router.push("/missions/builder"),
      hasValidation: pendingValidation !== null,
    },
    {
      id: "source",
      label: "Source",
      state:
        counts.connectionsConnected !== null && counts.connectionsTotal !== null ? (
          <>
            {counts.connectionsConnected}
            <span className="text-[var(--text-muted)] font-extralight">
              /{counts.connectionsTotal}
            </span>
          </>
        ) : (
          "—"
        ),
      icon: <SourceIcon />,
      onClick: () => router.push("/apps"),
    },
    {
      id: "library",
      label: "Bibliothèque",
      state: fmtCount(counts.assetsCount),
      icon: <AssetIcon />,
      onClick: () => router.push("/assets"),
    },
    {
      id: "marketplace",
      label: "Marketplace",
      state: fmtCount(counts.reportsCount),
      icon: <MarketplaceIcon />,
      onClick: () => router.push("/marketplace"),
    },
  ];

  return (
    <section style={{ padding: "var(--space-4) var(--space-4) var(--space-3)" }}>
      <SectionLabel label="Actions rapides" icon={<LightningIcon />} />
      <ul
        className="grid grid-cols-2"
        style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}
      >
        {actions.map((a) => (
          <li key={a.id} className="aspect-square">
            <button
              type="button"
              onClick={a.onClick}
              className="touch-module group relative w-full h-full text-left flex flex-col justify-between focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal)]"
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
              }}
              aria-label={a.label}
            >
              <span className="touch-module-icon shrink-0" aria-hidden>
                {a.icon}
              </span>
              {a.hasValidation && (
                <span
                  className="touch-module-badge"
                  aria-label="Proposition d'agent à valider"
                  title="Proposition d'agent à valider"
                />
              )}
              <span className="flex items-end justify-between gap-2 min-w-0">
                <span
                  className="t-13 font-light text-[var(--text-l1)] leading-tight"
                  style={{ letterSpacing: "-0.005em" }}
                >
                  {a.label}
                </span>
                <span
                  className="t-22 font-extralight font-mono tabular-nums text-[var(--text-l1)] leading-none"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {a.state}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {pendingValidation && (
        <ValidationStrip
          agent={pendingValidation.agent}
          missionTitle={pendingValidation.missionTitle}
        />
      )}
    </section>
  );
}

// ── Validation strip — pop-up inline d'une proposition d'agent autonome ──

function ValidationStrip({ agent, missionTitle }: { agent: string; missionTitle: string }) {
  const router = useRouter();
  return (
    <div
      role="region"
      aria-label="Validation requise"
      className="touch-validation-strip"
      style={{
        marginTop: "var(--space-2)",
        padding: "var(--space-3) var(--space-3) var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}
      >
        <span aria-hidden className="touch-validation-pulse" />
        <span className="t-11 font-light text-[var(--accent-teal)]" style={{ opacity: 0.9 }}>
          <span className="italic">{agent}</span> propose
        </span>
      </div>
      <div
        className="t-13 font-light text-[var(--text-l1)]"
        style={{ marginBottom: "var(--space-3)", letterSpacing: "-0.005em" }}
      >
        {missionTitle}
      </div>
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={() => router.push("/missions")}
          className="flex-1 t-11 font-light text-[var(--text-faint)] border border-[var(--border-soft)] hover:border-[var(--border-subtle)] hover:text-[var(--text-soft)] transition-colors"
          style={{ padding: "var(--space-2)", borderRadius: "var(--radius-sm)" }}
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => router.push("/missions")}
          className="flex-1 t-11 font-medium text-[var(--accent-teal)] hover:bg-[var(--accent-teal-bg-active)] transition-colors"
          style={{
            padding: "var(--space-2)",
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-teal-surface)",
            border: "1px solid var(--accent-teal-border)",
          }}
        >
          Valider
        </button>
      </div>
    </div>
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

      {/* Card glass : pas d'outline, matérialité par insets */}
      <div
        className="touch-status-card flex items-center"
        style={{
          gap: "var(--space-4)",
          padding: "var(--space-3)",
          marginTop: "var(--space-3)",
          borderRadius: "var(--radius-md)",
        }}
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
                stroke="var(--accent-teal)"
                strokeWidth="1.5"
                strokeDasharray="176"
                strokeDashoffset="44"
                strokeLinecap="round"
                style={{
                  transformOrigin: "center",
                  transform: "rotate(-90deg)",
                  animation: "pulse-status-accent-teal 2s ease-in-out infinite",
                }}
              />
            )}
            {/* Ring intérieur */}
            <circle cx="32" cy="32" r="20" stroke="var(--border-subtle)" strokeWidth="1" opacity={0.5} />
            {/* Dot central */}
            <circle
              cx="32" cy="32" r="5"
              fill="var(--accent-teal)"
              style={{
                filter: isIdle ? "none" : "drop-shadow(0 0 4px var(--accent-teal))",
              }}
            />
          </svg>
        </div>

        {/* Infos à droite de la roue */}
        <div className="flex flex-col min-w-0 flex-1" style={{ gap: "var(--space-2)" }}>
          <div className="flex items-center justify-between">
            <span className="t-11 font-medium" style={{ color: "var(--accent-teal)" }}>
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
                className="t-9 font-light hover:text-[var(--accent-teal)] transition-colors truncate text-left"
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
                className="t-9 font-light hover:text-[var(--accent-teal)] transition-colors truncate text-left"
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
        className="t-9 font-mono font-light shrink-0"
        style={{
          color: "var(--text-faint)",
          letterSpacing: "0.02em",
          minWidth: "var(--space-12)",
        }}
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
          className="t-9 font-mono hover:text-[var(--accent-teal)] transition-colors"
          style={{ color: "var(--text-faint)" }}
          aria-label="Effacer la sélection"
        >
          ×
        </button>
      </div>

      {/* Card contexte — pas d'outline, filet teal vertical seul */}
      <button
        type="button"
        onClick={handleOpen}
        className="touch-context-card group flex items-center w-full text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal)]"
        style={{
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-3) var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-md)",
        }}
      >
        {/* Icône agent ou type objet */}
        <span
          className="shrink-0 flex items-center justify-center"
          style={{
            width: "var(--space-10)",
            height: "var(--space-10)",
            color: "var(--accent-teal)",
            opacity: 0.85,
          }}
        >
          <AgentOrObjectIcon isAgent={isAgent} roleId={selection.id as AgentRoleId} kind={selection.kind} />
        </span>

        <span className="flex flex-col flex-1 min-w-0" style={{ gap: "2px" }}>
          {isAgent && (
            <span
              className="t-11 font-mono font-light"
              style={{ color: "var(--accent-teal)", letterSpacing: "0.02em", opacity: 0.85 }}
            >
              Agent sélectionné
            </span>
          )}
          <span className="t-13 font-light truncate" style={{ color: "var(--text-l1)" }}>
            {isAgent ? agentMeta?.label : (selection.label ?? selection.id)}
          </span>
          {isAgent && agentMeta && (
            <span className="t-11 font-light truncate" style={{ color: "var(--text-faint)" }}>
              {agentMeta.tagline}
            </span>
          )}
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
        className="touch-context-card flex flex-col"
        style={{
          gap: "var(--space-2)",
          marginTop: "var(--space-3)",
          padding: "var(--space-3) var(--space-3) var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <span
          className="t-11 font-mono font-light"
          style={{ color: "var(--accent-teal)", letterSpacing: "0.02em", opacity: 0.85 }}
        >
          {FOCAL_TYPE_LABEL[focal.type] ?? focal.type}
        </span>
        <span className="t-13 font-light truncate" style={{ color: "var(--text-l1)" }}>
          {focal.title}
        </span>
        {focal.summary && (
          <span
            className="t-11 font-light"
            style={{ color: "var(--text-faint)", lineHeight: "var(--leading-relaxed)" }}
          >
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
    return Icon ? <Icon color="var(--accent-teal)" /> : null;
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
      <span style={{ color: "var(--text-muted)" }} aria-hidden>{icon}</span>
      <span
        className="t-13 font-light"
        style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
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
function MarketplaceIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 14h6"/></svg>;
}
function SourceIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
}
function AssetIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
