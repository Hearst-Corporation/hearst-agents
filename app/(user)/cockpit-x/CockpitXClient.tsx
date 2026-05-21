"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import type { StagePayload } from "@/stores/stage";
import { useStageStore } from "@/stores/stage";
import { KpiGrid } from "../_shell/KpiGrid";
import { Shell } from "../_shell/Shell";
import { ChatStage } from "../_stages/ChatStage";
import { MissionListStage } from "../_stages/MissionListStage";
import { MissionStage } from "../_stages/MissionStage";
import { STAGE_REGISTRY } from "../_stages/registry";
import type { StageKey } from "../_stages/types";

/* Stages non-critiques — lazy-load pour réduire le bundle initial */
const ArtifactStage = dynamic(() =>
  import("../_stages/ArtifactStage").then((m) => m.ArtifactStage),
);
const AssetCompareStage = dynamic(() =>
  import("../_stages/AssetCompareStage").then((m) => m.AssetCompareStage),
);
const AssetStage = dynamic(() => import("../_stages/AssetStage").then((m) => m.AssetStage));
const BrowserStage = dynamic(() => import("../_stages/BrowserStage").then((m) => m.BrowserStage));
const ConnectionsHub = dynamic(() =>
  import("../components/ConnectionsHub").then((m) => m.ConnectionsHub),
);
const KGStage = dynamic(() => import("../_stages/KGStage").then((m) => m.KGStage));
const MeetingStage = dynamic(() => import("../_stages/MeetingStage").then((m) => m.MeetingStage));
const SignalStage = dynamic(() => import("../_stages/SignalStage").then((m) => m.SignalStage));
const SimulationStage = dynamic(() =>
  import("../_stages/SimulationStage").then((m) => m.SimulationStage),
);
const VoiceStage = dynamic(() => import("../_stages/VoiceStage").then((m) => m.VoiceStage));

/**
 * CockpitXClient — orchestrateur du shell visionOS (P4+).
 */

interface CockpitXClientProps {
  initialCockpitData: CockpitTodayPayload | null;
  initialMode?: string;
  openNewMission?: boolean;
}

const FACTORY_MAX = 5;

export function CockpitXClient({
  initialCockpitData,
  initialMode,
  openNewMission,
}: CockpitXClientProps) {
  const mode = useStageStore((s) => s.current.mode);
  const def = STAGE_REGISTRY[mode];
  const setMode = useStageStore((s) => s.setMode);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);

  const [data, setData] = useState<CockpitTodayPayload | null>(initialCockpitData);

  const telemetry = useMemo(() => buildTelemetry(data), [data]);
  const factoryRows = useMemo(() => buildFactoryRows(data), [data]);
  const watch = useMemo(() => buildWatch(data), [data]);
  const proposals = useMemo(() => buildProposals(data), [data]);
  useEffect(() => {
    if (!initialMode || initialMode === "cockpit") return;
    const safeModesWithoutRequired: StageKey[] = [
      "chat",
      "mission",
      "voice",
      "kg",
      "artifact",
      "signal",
      "simulation",
      "connections",
      "meeting",
      "asset",
      "asset_compare",
    ];
    if (safeModesWithoutRequired.includes(initialMode as StageKey)) {
      setMode({ mode: initialMode } as StagePayload);
      return;
    }
    // browser exige un sessionId : sans session active on entre avec un
    // sessionId vide — BrowserStage rend son état idle (cf. _stages/
    // BrowserStage.tsx, sessionId falsy → fetchState "idle", pas de crash).
    if (initialMode === "browser") {
      setMode({ mode: "browser", sessionId: "" });
    }
  }, [initialMode, setMode]);

  useEffect(() => {
    if (openNewMission) {
      setCommandeurOpen(true, { prefilledQuery: "Créer une nouvelle mission" });
    }
  }, [openNewMission, setCommandeurOpen]);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/" && modeRef.current !== "cockpit") {
      setMode({ mode: "cockpit" });
    }
  }, [pathname, setMode]);

  const hasMissionId = useStageStore((s) => s.current.mode === "mission" && !!s.current.missionId);

  const [refetchState, setRefetchState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (mode !== "cockpit") return;
    let cancelled = false;
    setRefetchState((prev) => (prev === "idle" && !initialCockpitData ? "loading" : prev));
    (async () => {
      try {
        const res = await fetch("/api/v2/cockpit/today", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setRefetchState("error");
          return;
        }
        const payload = (await res.json()) as CockpitTodayPayload;
        if (!cancelled) {
          setData(payload);
          setRefetchState("idle");
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[CockpitX] refetch cockpit/today failed:", err);
        }
        if (!cancelled) setRefetchState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, initialCockpitData]);

  if (mode === "cockpit") {
    return (
      <Shell
        centerContent={
          <CockpitContent
            data={data}
            refetchState={refetchState}
            onGoChat={() => setMode({ mode: "chat" })}
            telemetry={telemetry}
            factoryRows={factoryRows}
            watch={watch}
            proposals={proposals}
          />
        }
      />
    );
  }

  const stageContent = (() => {
    switch (mode) {
      case "chat":
        return <ChatStage mode={mode} />;
      case "mission":
        return hasMissionId ? <MissionStage mode={mode} /> : <MissionListStage mode={mode} />;
      case "asset":
        return <AssetStage mode={mode} />;
      case "browser":
        return <BrowserStage mode={mode} />;
      case "voice":
        return <VoiceStage mode={mode} />;
      case "meeting":
        return <MeetingStage mode={mode} />;
      case "kg":
        return <KGStage mode={mode} />;
      case "artifact":
        return <ArtifactStage mode={mode} />;
      case "signal":
        return <SignalStage mode={mode} />;
      case "asset_compare":
        return <AssetCompareStage mode={mode} />;
      case "simulation":
        return <SimulationStage mode={mode} />;
      case "connections":
        return <ConnectionsHub />;
      default:
        return <ModePlaceholder mode={mode} def={def} />;
    }
  })();

  return <Shell centerContent={stageContent} />;
}

/* -------------------------------------------------------------------------- */
/*                       Cockpit — factory cockpit content                    */
/* -------------------------------------------------------------------------- */

function CockpitContent({
  data,
  refetchState,
  onGoChat,
  telemetry,
  factoryRows,
  watch,
  proposals,
}: {
  data: CockpitTodayPayload | null;
  refetchState: "idle" | "loading" | "error";
  onGoChat: () => void;
  telemetry: TelemetryItem[];
  factoryRows: FactoryRow[];
  watch: WatchData;
  proposals: AgentProposal[];
}) {
  const { data: session } = useSession();
  const setMode = useStageStore((s) => s.setMode);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const firstName = session?.user?.name?.split(" ")[0] ?? null;
  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const openCommandeur = useCallback(
    (prefilledQuery?: string) =>
      setCommandeurOpen(true, prefilledQuery ? { prefilledQuery } : undefined),
    [setCommandeurOpen],
  );

  const attentionLabel =
    telemetry[0]?.value !== "0" && telemetry[0]?.value !== "—"
      ? `${telemetry[0].value} exécutions requièrent votre attention.`
      : telemetry[2]?.value !== "0" && telemetry[2]?.value !== "—"
        ? `${telemetry[2].value} messages requièrent votre attention.`
        : "Aucune décision urgente requise.";

  return (
    <motion.section
      key="cockpit"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="preserve-3d w-full flex-1 relative"
    >
      <div
        style={{
          maxWidth: "var(--width-cockpit-max)",
          marginInline: "auto",
          padding: "var(--space-6) var(--space-6) var(--space-24)",
        }}
      >
        {refetchState === "error" && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-6 rounded-(--radius-sm) border border-(--border-shell) bg-(--surface-1) px-(--space-4) py-(--space-3)"
          >
            <p className="t-13 text-text-muted">
              Impossible de rafraîchir les données. Affichage des dernières informations connues.
            </p>
          </div>
        )}

        {/* ── Header ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: "var(--space-8)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span
              className="t-11 font-semibold uppercase"
              style={{
                letterSpacing: "var(--tracking-caption)",
                color: "var(--accent-teal)",
              }}
            >
              Helm · Cockpit
            </span>
            <span
              className="t-10 font-semibold uppercase"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                color: "var(--text-ghost)",
                letterSpacing: "var(--tracking-display)",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--accent-teal)",
                  display: "inline-block",
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                className="t-11 font-semibold uppercase"
                style={{
                  letterSpacing: "var(--tracking-caption)",
                  color: "var(--text-ghost)",
                }}
              >
                {todayLabel} · En écoute
              </span>
            </span>
          </div>
          <h1
            className="t-34 font-light"
            style={{
              letterSpacing: "var(--tracking-editorial)",
              color: "var(--text)",
              lineHeight: 1.05,
              marginBottom: "var(--space-3)",
            }}
          >
            {firstName ? `Bonjour, ${firstName}.` : "Bonjour."}
          </h1>
          <p
            style={{
              fontSize: "var(--ct-font-md, 15px)",
              color: "var(--text-muted)",
              fontWeight: 300,
            }}
          >
            {attentionLabel}
          </p>
        </header>

        {/* ── KPI Grid 4 colonnes ───────────────────────────────────── */}
        <KpiGrid items={telemetry} />

        {/* ── Layout 2 colonnes ──────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              watch.inbox.kind === "items" || watch.agenda.kind === "items" || proposals.length > 0
                ? "2fr 1fr"
                : "1fr",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* Colonne gauche — Exécution */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {factoryRows.length > 0 && (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-shell)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <div
                  className="t-10 font-bold uppercase"
                  style={{
                    letterSpacing: "var(--tracking-display)",
                    color: "var(--text-ghost)",
                    paddingBottom: "var(--space-3)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  Exécution active
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {factoryRows.slice(0, FACTORY_MAX).map((row, i) => (
                    <button
                      key={row.id}
                      type="button"
                      aria-label={`Mission ${row.name}`}
                      onClick={() => setMode({ mode: "mission", missionId: row.missionId })}
                      style={{
                        background: "none",
                        border: "none",
                        padding:
                          i < factoryRows.slice(0, FACTORY_MAX).length - 1
                            ? `0 0 var(--space-4) 0`
                            : "0",
                        borderBottom:
                          i < factoryRows.slice(0, FACTORY_MAX).length - 1
                            ? "1px solid var(--line)"
                            : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-1)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span
                          className="t-14 font-medium"
                          style={{
                            color: "var(--text-soft)",
                          }}
                        >
                          {row.name}
                        </span>
                        <span
                          className="t-10 font-semibold uppercase"
                          style={{
                            letterSpacing: "var(--tracking-caption)",
                            color:
                              row.status === "running"
                                ? "var(--accent-teal)"
                                : row.status === "failed"
                                  ? "var(--danger)"
                                  : "var(--text-ghost)",
                            background:
                              row.status === "running"
                                ? "color-mix(in srgb, var(--accent-teal) 10%, transparent)"
                                : "var(--surface-2)",
                            borderRadius: "var(--radius-pill)",
                            padding: "2px 8px",
                            flexShrink: 0,
                          }}
                        >
                          {row.statusLabel}
                        </span>
                      </div>
                      {row.detail && (
                        <span
                          className="t-13"
                          style={{
                            color: "var(--text-faint)",
                          }}
                        >
                          {row.detail}
                        </span>
                      )}
                      <span
                        className="t-11 font-semibold uppercase"
                        style={{
                          letterSpacing: "var(--tracking-caption)",
                          color: "var(--text-ghost)",
                        }}
                      >
                        {row.when}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite — Radar + Initiatives */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {(watch.inbox.kind === "items" || watch.agenda.kind === "items") && (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-shell)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <div
                  className="t-10 font-bold uppercase"
                  style={{
                    letterSpacing: "var(--tracking-display)",
                    color: "var(--text-ghost)",
                    paddingBottom: "var(--space-3)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  Radar
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {watch.inbox.kind === "items" &&
                    watch.inbox.items.slice(0, 3).map((it, i, arr) => (
                      <button
                        key={it.id}
                        type="button"
                        aria-label={`Message : ${it.title}`}
                        onClick={() => openCommandeur("brief inbox")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: i < arr.length - 1 ? `0 0 var(--space-4) 0` : "0",
                          borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-1)",
                        }}
                      >
                        <span
                          className="t-14 font-medium"
                          style={{
                            color: "var(--text-soft)",
                          }}
                        >
                          {it.title}
                        </span>
                        <span
                          className="t-13"
                          style={{
                            color: "var(--text-faint)",
                          }}
                        >
                          {it.summary}
                        </span>
                      </button>
                    ))}
                  {watch.agenda.kind === "items" &&
                    watch.agenda.items.slice(0, 2).map((ev, i, arr) => (
                      <button
                        key={ev.id}
                        type="button"
                        aria-label={`Agenda : ${ev.title}`}
                        onClick={() => openCommandeur("agenda du jour")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: i < arr.length - 1 ? `0 0 var(--space-4) 0` : "0",
                          borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-1)",
                        }}
                      >
                        <span
                          className="t-14 font-medium"
                          style={{
                            color: "var(--text-soft)",
                          }}
                        >
                          {ev.title}
                        </span>
                        <span
                          className="t-11 font-semibold uppercase"
                          style={{
                            letterSpacing: "var(--tracking-caption)",
                            color: "var(--text-ghost)",
                          }}
                        >
                          {ev.when}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
            {proposals.length > 0 && (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-shell)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <div
                  className="t-10 font-bold uppercase"
                  style={{
                    letterSpacing: "var(--tracking-display)",
                    color: "var(--text-ghost)",
                    paddingBottom: "var(--space-3)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  Initiatives
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {proposals.slice(0, 3).map((p, i, arr) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={`Initiative : ${p.title}`}
                      onClick={() => openCommandeur(p.title)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: i < arr.length - 1 ? `0 0 var(--space-4) 0` : "0",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-1)",
                      }}
                    >
                      <span
                        className="t-14 font-medium"
                        style={{
                          color: "var(--text-soft)",
                        }}
                      >
                        {p.title}
                      </span>
                      <span
                        className="t-13"
                        style={{
                          color: "var(--text-faint)",
                        }}
                      >
                        {p.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Sub-composants UI                             */
/* -------------------------------------------------------------------------- */

type TelemetryTone = "active" | "rest" | "warn";

interface TelemetryItem {
  id: "missions" | "agenda" | "inbox" | "suggestions";
  label: string;
  value: string;
  footnote: string;
  tone: TelemetryTone;
  progress: number;
  needsConnection?: boolean;
}

interface AgentProposal {
  id: string;
  title: string;
  description: string;
  status: "ready" | "partial";
}

interface FactoryRow {
  id: string;
  missionId: string;
  name: string;
  status: "running" | "success" | "failed" | "blocked" | "idle";
  statusLabel: string;
  when: string;
  detail: string | null;
}

interface WatchData {
  inbox:
    | { kind: "items"; items: { id: string; title: string; summary: string }[] }
    | { kind: "disconnected" }
    | { kind: "empty" };
  agenda:
    | { kind: "items"; items: { id: string; title: string; when: string }[] }
    | { kind: "disconnected" }
    | { kind: "empty" };
}

/* -------------------------------------------------------------------------- */
/*                       Builders data-bound fail-soft                        */
/* -------------------------------------------------------------------------- */

function buildTelemetry(data: CockpitTodayPayload | null): TelemetryItem[] {
  if (!data) {
    const idle: TelemetryItem = {
      id: "missions",
      label: "Demandes",
      value: "—",
      footnote: "synchronisation",
      tone: "rest",
      progress: 12,
    };
    return [
      idle,
      { ...idle, id: "agenda", label: "Agenda" },
      { ...idle, id: "inbox", label: "Messages" },
      { ...idle, id: "suggestions", label: "Propositions" },
    ];
  }

  const runningCount = data.missionsRunning.filter((m) => m.status === "running").length;
  const recentCount = data.missionsRunning.length;
  const missionsValue =
    runningCount > 0 ? String(runningCount) : recentCount > 0 ? String(recentCount) : "0";
  const missionsFootnote =
    runningCount > 0
      ? `en cours · ${recentCount} récentes`
      : recentCount > 0
        ? `${recentCount} récentes`
        : "rien en cours";

  const agendaCount = data.agenda.length;
  const agendaCard: TelemetryItem = !data.calendarConnected
    ? {
        id: "agenda",
        label: "Agenda",
        value: "—",
        footnote: "déconnecté",
        tone: "warn",
        progress: 20,
        needsConnection: true,
      }
    : {
        id: "agenda",
        label: "Agenda",
        value: String(agendaCount),
        footnote: agendaCount > 0 ? "à venir" : "rien aujourd'hui",
        tone: agendaCount > 0 ? "active" : "rest",
        progress: progressFromCount(agendaCount, 4),
      };

  const inboxItems = data.inbox.brief?.items.length ?? 0;
  const inboxCard: TelemetryItem = data.inbox.needsConnection
    ? {
        id: "inbox",
        label: "Messages",
        value: "—",
        footnote: "déconnectée",
        tone: "warn",
        progress: 20,
        needsConnection: true,
      }
    : {
        id: "inbox",
        label: "Messages",
        value: String(inboxItems),
        footnote:
          inboxItems > 0 ? "à examiner" : data.inbox.stale ? "à rafraîchir" : "rien d'urgent",
        tone: inboxItems > 0 ? "active" : "rest",
        progress: progressFromCount(inboxItems, 6),
      };

  const suggCount = data.suggestions.length;
  const suggCard: TelemetryItem = {
    id: "suggestions",
    label: "Propositions",
    value: String(suggCount),
    footnote: suggCount > 0 ? "l'agent propose" : "rien à proposer",
    tone: suggCount > 0 ? "active" : "rest",
    progress: progressFromCount(suggCount, 3),
  };

  return [
    {
      id: "missions",
      label: "Demandes",
      value: missionsValue,
      footnote: missionsFootnote,
      tone: runningCount > 0 ? "active" : "rest",
      progress: progressFromCount(runningCount || recentCount, 4),
    },
    agendaCard,
    inboxCard,
    suggCard,
  ];
}

function progressFromCount(count: number, max: number): number {
  if (count <= 0) return 16;
  return Math.min(100, Math.max(28, Math.round((count / max) * 100)));
}

function buildProposals(data: CockpitTodayPayload | null): AgentProposal[] {
  if (!data) return [];
  return data.suggestions.slice(0, 3).map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    status: s.status,
  }));
}

function buildFactoryRows(data: CockpitTodayPayload | null): FactoryRow[] {
  if (!data) return [];
  return data.missionsRunning.slice(0, FACTORY_MAX).map((m) => {
    const statusLabel = factoryStatusLabel(m.status);
    const detail =
      m.status === "failed" && m.lastError
        ? truncate(m.lastError, 80)
        : m.status === "running" && m.runningSince
          ? `démarrée ${formatAgo(m.runningSince)}`
          : null;
    return {
      id: `mission-${m.id}`,
      missionId: m.id,
      name: m.name,
      status: m.status,
      statusLabel,
      when: m.lastRunAt ? formatAgo(m.lastRunAt) : "—",
      detail,
    };
  });
}

function factoryStatusLabel(status: FactoryRow["status"]): string {
  switch (status) {
    case "running":
      return "En cours";
    case "success":
      return "Réussi";
    case "failed":
      return "Échec";
    case "blocked":
      return "Bloquée";
    default:
      return "Inactive";
  }
}

function buildWatch(data: CockpitTodayPayload | null): WatchData {
  if (!data) {
    return {
      inbox: { kind: "empty" },
      agenda: { kind: "empty" },
    };
  }

  const inboxItems = data.inbox.brief?.items ?? [];
  const inbox: WatchData["inbox"] =
    inboxItems.length > 0
      ? {
          kind: "items",
          items: inboxItems.map((it) => ({
            id: it.id,
            title: it.title,
            summary: it.summary,
          })),
        }
      : data.inbox.needsConnection
        ? { kind: "disconnected" }
        : { kind: "empty" };

  const agenda: WatchData["agenda"] =
    data.agenda.length > 0
      ? {
          kind: "items",
          items: data.agenda.map((ev) => ({
            id: ev.id,
            title: ev.title,
            when: formatTime(ev.startsAt),
          })),
        }
      : !data.calendarConnected
        ? { kind: "disconnected" }
        : { kind: "empty" };

  return {
    inbox,
    agenda,
  };
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

function formatTime(input: string | number | Date | null | undefined): string {
  if (!input) return "—";
  try {
    const d = new Date(input);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

/* -------------------------------------------------------------------------- */
/*                       Placeholder pour les autres modes                    */
/* -------------------------------------------------------------------------- */

function ModePlaceholder({
  mode,
  def,
}: {
  mode: string;
  def: (typeof STAGE_REGISTRY)[keyof typeof STAGE_REGISTRY];
}) {
  return (
    <motion.section
      key={mode}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="preserve-3d flex w-full flex-col gap-16"
      style={{ maxWidth: "min(100%, var(--width-cockpit-max))", margin: "0 auto" }}
    >
      <header className="flex flex-col gap-4">
        <p className="t-13 font-medium text-text-faint">Shell visionOS · stage non câblé</p>
        <h1 className="t-48 font-medium leading-tight tracking-tight text-text">
          {def.label}
          {def.hotkey ? (
            <span className="ml-4 t-13 font-normal text-text-ghost">{def.hotkey}</span>
          ) : null}
        </h1>
        <p
          className="t-15 font-light text-text-muted leading-relaxed"
          style={{ maxWidth: "var(--width-prose-narrow)" }}
        >
          Le composant Stage <code className="text-(--text-soft)">{mode}</code> sera branché en P5
          ou P6. Footer + railTitle alimentés par{" "}
          <code className="text-(--text-soft)">STAGE_REGISTRY</code>.
        </p>
      </header>
    </motion.section>
  );
}
