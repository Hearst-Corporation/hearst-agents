"use client";

/**
 * GeneralDashboard — sub-rail droit du Cockpit/Chat (refonte 2026-05-04 v3).
 *
 * Spec : [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md)
 *
 * Rend les 5 strates verticales du panneau droit en mode `cockpit` ou `chat`.
 * Cette refonte n'inclut **pas encore** les strates 3D (Strate 1 services,
 * Strate 2 constellation) — elles sont rendues séparément dans
 * `<SystemServicesRow>` et `<SystemConstellation>` au-dessus de ce composant
 * dans `ContextRail.CockpitChatBody`.
 *
 * Strates rendues ici :
 *   ③ Actions rapides     4 CTA sobres
 *   ④ Statut système       état + session + alerte + dernière activité
 *   ⑤ Contexte sélectionné Cockpit → useSelectionStore. Chat → useFocalStore.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";
import { useFocalStore } from "@/stores/focal";
import { useSelectionStore, type Selection } from "@/stores/selection";
import { useNotificationsStore, type AppNotification } from "@/stores/notifications";
import { AGENT_METADATA, type AgentRoleId, AGENT_ROLES } from "@/lib/cockpit/agents";

interface GeneralDashboardProps {
  /** @deprecated Préservé pour compat call-site ; non utilisé depuis v3. */
  assets?: unknown;
  /** @deprecated Idem. */
  missions?: unknown;
  /** @deprecated Idem (la navigation est désormais explicite via Strate 3). */
  onViewChange?: (view: "reports" | "missions" | "assets") => void;
  activeThreadId?: string | null;
  loading?: boolean;
}

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

// ──────────────────────────────────────────────────────────────

export function GeneralDashboard({
  assets: _assetsProp,
  missions: _missionsProp,
  onViewChange,
  activeThreadId: _activeThreadIdProp,
  loading: _loadingProp,
}: GeneralDashboardProps) {
  // Compat : props préservées dans la signature publique le temps que tous les
  // call-sites les retirent. Non lues dans la nouvelle implémentation.
  void _assetsProp;
  void _missionsProp;
  void onViewChange;
  void _activeThreadIdProp;
  void _loadingProp;

  return (
    <div
      className="flex flex-col"
      style={{
        padding: "var(--space-5) var(--space-5) var(--space-6)",
        gap: "var(--space-6)",
      }}
    >
      <QuickActions />
      <SystemStatus />
      <SelectedContext />
    </div>
  );
}

// ── Strate 3 — Actions rapides ───────────────────────────────

function QuickActions() {
  const router = useRouter();
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);

  const items: Array<{ label: string; onClick: () => void }> = [
    {
      label: "Nouvelle mission",
      onClick: () => router.push("/missions/builder"),
    },
    {
      label: "Nouveau rapport",
      onClick: () => router.push("/reports"),
    },
    {
      label: "Ajouter une source",
      onClick: () => router.push("/apps"),
    },
    {
      label: "Lancer analyse",
      onClick: () => setCommandeurOpen(true, { prefilledQuery: "Analyser " }),
    },
  ];

  return (
    <Section label="Actions">
      <ul
        className="flex flex-col"
        style={{ gap: "var(--space-1)" }}
      >
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              onClick={it.onClick}
              className="group flex items-center w-full text-left transition-colors focus:outline-none focus-visible:ring-1"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-2)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-l2)",
                ["--tw-ring-color" as string]: "var(--cykan)",
              }}
            >
              <span
                className="t-13 font-light flex-1 truncate group-hover:text-[var(--text)] transition-colors"
              >
                {it.label}
              </span>
              <span
                className="t-13 font-mono shrink-0 group-hover:text-[var(--cykan)] transition-colors"
                style={{ color: "var(--text-faint)" }}
                aria-hidden
              >
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ── Strate 4 — Statut système ────────────────────────────────

function SystemStatus() {
  const router = useRouter();
  const coreState = useRuntimeStore((s) => s.coreState);
  const events = useRuntimeStore((s) => s.events);
  const stageMode = useStageStore((s) => s.current.mode);
  const setMode = useStageStore((s) => s.setMode);
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  const notifications = useNotificationsStore((s) => s.notifications);

  // ── Live clock ──
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    queueMicrotask(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const timeLabel = now
    ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  // ── Session active ──
  const session: { kind: "voice" | "browser" | "meeting"; label: string } | null =
    voiceActive
      ? { kind: "voice", label: "Session vocale" }
      : stageMode === "browser"
        ? { kind: "browser", label: "Session navigateur" }
        : stageMode === "meeting"
          ? { kind: "meeting", label: "Réunion en cours" }
          : null;

  const onOpenSession = () => {
    if (!session) return;
    if (session.kind === "voice") setMode({ mode: "voice" });
    else if (session.kind === "browser") setMode({ mode: "browser", sessionId: "" });
    else if (session.kind === "meeting") setMode({ mode: "meeting", meetingId: "" });
  };

  // ── Alerte ──
  const alert: AppNotification | null =
    notifications.find(
      (n) => (n.severity === "critical" || n.severity === "warning") && n.read_at === null,
    ) ?? null;

  // ── Dernière activité ──
  const lastAssetEvent = events.find((e) => e.type === "asset_generated");
  const lastActivityLabel: string | null = lastAssetEvent
    ? `${(lastAssetEvent as Record<string, unknown>).name as string ?? "Livrable"} · ${formatRelative(lastAssetEvent.timestamp)}`
    : null;

  return (
    <Section label="Statut">
      <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        {/* ① État + heure */}
        <li className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <BulletDot tone="cykan" pulse={coreState !== "idle"} />
          <span className="t-13 font-light flex-1 truncate" style={{ color: "var(--text-soft)" }}>
            {CORE_STATE_LABEL[coreState] ?? "En ligne"}
          </span>
          <span
            className="t-11 font-mono tabular-nums shrink-0"
            style={{ color: "var(--text-faint)" }}
          >
            {timeLabel}
          </span>
        </li>

        {/* ② Session active */}
        <StatusRow label="Session">
          {session ? (
            <button
              type="button"
              onClick={onOpenSession}
              className="t-11 font-light text-left truncate hover:text-[var(--cykan)] transition-colors"
              style={{ color: "var(--text-l2)" }}
            >
              {session.label}
            </button>
          ) : (
            <span className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
              Aucune
            </span>
          )}
        </StatusRow>

        {/* ③ Alerte */}
        <StatusRow label="Alerte">
          {alert ? (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="t-11 font-light text-left truncate hover:text-[var(--cykan)] transition-colors"
              style={{
                color:
                  alert.severity === "critical"
                    ? "var(--danger)"
                    : "var(--warn)",
              }}
            >
              {alert.title}
            </button>
          ) : (
            <span className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
              Aucune
            </span>
          )}
        </StatusRow>

        {/* ④ Dernière activité */}
        <StatusRow label="Activité">
          {lastActivityLabel ? (
            <span
              className="t-11 font-light truncate"
              style={{ color: "var(--text-l2)" }}
            >
              {lastActivityLabel}
            </span>
          ) : (
            <span className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
              Aucune
            </span>
          )}
        </StatusRow>
      </ul>
    </Section>
  );
}

// ── Strate 5 — Contexte sélectionné ──────────────────────────

function SelectedContext() {
  const stageMode = useStageStore((s) => s.current.mode);
  const selection = useSelectionStore((s) => s.current);
  const focal = useFocalStore((s) => s.focal);

  const inCockpit = stageMode === "cockpit";

  // Mode cockpit : lit useSelectionStore. Mode chat : lit useFocalStore.
  // Autres modes : on rend tout de même la zone pour préserver la structure
  // mais avec un empty hint neutre — l'utilisateur peut toujours cliquer un
  // rôle dans la constellation et voir sa fiche, indépendamment du Stage.

  if (inCockpit) {
    return <CockpitContextSection selection={selection} />;
  }

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
      else if (meta.openTarget.kind === "stage") setMode({ mode: meta.openTarget.mode });
      return;
    }
    if (selection.kind === "mission") {
      setMode({ mode: "mission", missionId: selection.id });
      return;
    }
    if (selection.kind === "asset") {
      setMode({ mode: "asset", assetId: selection.id });
      return;
    }
    if (selection.kind === "report") {
      router.push("/reports");
      return;
    }
  };

  if (!selection) {
    return (
      <Section label="Contexte">
        <p
          className="t-11 font-light"
          style={{ color: "var(--text-faint)", lineHeight: "var(--leading-relaxed)" }}
        >
          Sélectionne un rôle ou un objet pour voir son contexte.
        </p>
      </Section>
    );
  }

  return (
    <Section label="Contexte" onClose={clearSelection}>
      {selection.kind === "agent" && (
        <AgentContextCard roleId={selection.id as AgentRoleId} />
      )}
      {selection.kind !== "agent" && (
        <GenericContextCard selection={selection} />
      )}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-baseline w-full text-left transition-colors group"
        style={{ marginTop: "var(--space-3)", gap: "var(--space-2)" }}
      >
        <span
          className="t-13 font-light flex-1 group-hover:text-[var(--text)] transition-colors"
          style={{ color: "var(--text-l2)" }}
        >
          Ouvrir
        </span>
        <span
          className="t-13 font-mono shrink-0 group-hover:text-[var(--cykan)] transition-colors"
          style={{ color: "var(--text-faint)" }}
          aria-hidden
        >
          →
        </span>
      </button>
    </Section>
  );
}

function AgentContextCard({ roleId }: { roleId: AgentRoleId }) {
  const meta = AGENT_METADATA[roleId];
  if (!meta) {
    return (
      <p className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
        Rôle inconnu : {roleId}
      </p>
    );
  }
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <span
        className="t-13 font-medium"
        style={{ color: "var(--text)" }}
      >
        {meta.label}
      </span>
      <span
        className="t-11 font-light"
        style={{ color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}
      >
        {meta.tagline}
      </span>
    </div>
  );
}

function GenericContextCard({ selection }: { selection: Selection }) {
  const kindLabel: Record<typeof selection.kind, string> = {
    agent: "Rôle",
    mission: "Mission",
    asset: "Livrable",
    report: "Rapport",
  };
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <span className="t-9 font-medium" style={{ color: "var(--text-ghost)" }}>
        {kindLabel[selection.kind]}
      </span>
      <span
        className="t-13 font-light truncate"
        style={{ color: "var(--text)" }}
      >
        {selection.label ?? selection.id}
      </span>
    </div>
  );
}

function ChatContextSection({ focal }: { focal: ReturnType<typeof useFocalStore.getState>["focal"] }) {
  if (!focal) {
    return (
      <Section label="Contexte">
        <p
          className="t-11 font-light"
          style={{ color: "var(--text-faint)", lineHeight: "var(--leading-relaxed)" }}
        >
          Aucun focal actif sur ce thread.
        </p>
      </Section>
    );
  }
  return (
    <Section label="Contexte">
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <span className="t-9 font-medium" style={{ color: "var(--text-ghost)" }}>
          {FOCAL_TYPE_LABEL[focal.type] ?? focal.type}
        </span>
        <span
          className="t-13 font-light truncate"
          style={{ color: "var(--text)" }}
        >
          {focal.title}
        </span>
        {focal.summary && (
          <span
            className="t-11 font-light"
            style={{ color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}
          >
            {focal.summary}
          </span>
        )}
      </div>
    </Section>
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

// ── Sous-composants partagés ─────────────────────────────────

function Section({
  label,
  children,
  onClose,
}: {
  label: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <section className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <header
        className="flex items-baseline justify-between"
        style={{
          paddingBottom: "var(--space-2)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          className="t-11 font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          {label}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Effacer la sélection"
            className="t-11 font-mono hover:text-[var(--cykan)] transition-colors"
            style={{ color: "var(--text-faint)" }}
          >
            ×
          </button>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-baseline" style={{ gap: "var(--space-3)" }}>
      <span
        className="t-11 font-light shrink-0"
        style={{ color: "var(--text-faint)", minWidth: "var(--space-16)" }}
      >
        {label}
      </span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </li>
  );
}

function BulletDot({
  tone,
  pulse = false,
}: {
  tone: "cykan" | "danger" | "neutral";
  pulse?: boolean;
}) {
  const color =
    tone === "cykan"
      ? "var(--cykan)"
      : tone === "danger"
        ? "var(--danger)"
        : "var(--text-faint)";
  return (
    <span
      className="rounded-pill shrink-0"
      style={{
        width: "var(--space-2)",
        height: "var(--space-2)",
        background: color,
        boxShadow: tone === "cykan" ? "var(--shadow-neon-cykan)" : "none",
        animation: pulse
          ? tone === "cykan"
            ? "pulse-status-cykan 2s ease-in-out infinite"
            : "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          : "none",
      }}
      aria-hidden
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatRelative(ts?: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) {
    const m = Math.round(diff / 60_000);
    return `il y a ${m} min`;
  }
  if (diff < 86_400_000) {
    const h = Math.round(diff / 3_600_000);
    return `il y a ${h} h`;
  }
  const d = Math.round(diff / 86_400_000);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Compat re-exports ────────────────────────────────────────

export { AGENT_ROLES };
