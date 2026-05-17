"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import type { StagePayload } from "@/stores/stage";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { Shell } from "../_shell/Shell";
import { ArtifactStage } from "../_stages/ArtifactStage";
import { AssetCompareStage } from "../_stages/AssetCompareStage";
import { AssetStage } from "../_stages/AssetStage";
import { BrowserStage } from "../_stages/BrowserStage";
import { ChatStage } from "../_stages/ChatStage";
import { KGStage } from "../_stages/KGStage";
import { MeetingStage } from "../_stages/MeetingStage";
import { MissionStage } from "../_stages/MissionStage";
import { STAGE_REGISTRY } from "../_stages/registry";
import { SignalStage } from "../_stages/SignalStage";
import { SimulationStage } from "../_stages/SimulationStage";
import type { RailItem, StageKey } from "../_stages/types";
import { VoiceStage } from "../_stages/VoiceStage";
import { ChatDock } from "../components/ChatDock";
import { ConnectionsHub } from "../components/ConnectionsHub";

/**
 * CockpitXClient — orchestrateur du shell visionOS (P4+).
 */

interface CockpitXClientProps {
  initialCockpitData: CockpitTodayPayload | null;
  initialMode?: string;
  openNewMission?: boolean;
}

const FACTORY_MAX = 5;
const RAIL_MAX = 5;

export function CockpitXClient({
  initialCockpitData,
  initialMode,
  openNewMission,
}: CockpitXClientProps) {
  const mode = useStageStore((s) => s.current.mode);
  const def = STAGE_REGISTRY[mode];
  const setMode = useStageStore((s) => s.setMode);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);

  const shellData = useStageData((s) => s.shellData);
  const [data, setData] = useState<CockpitTodayPayload | null>(initialCockpitData);

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
    ];
    if (safeModesWithoutRequired.includes(initialMode as StageKey)) {
      setMode({ mode: initialMode } as StagePayload);
    }
  }, []);

  useEffect(() => {
    if (openNewMission) {
      setCommandeurOpen(true, { prefilledQuery: "Créer une nouvelle mission" });
    }
  }, []);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/" && modeRef.current !== "cockpit") {
      setMode({ mode: "cockpit" });
    }
  }, [pathname, setMode]);

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
    const railItems = buildRailItems(data);
    return (
      <Shell
        centerContent={
          <CockpitContent
            data={data}
            refetchState={refetchState}
            onGoChat={() => setMode({ mode: "chat" })}
          />
        }
        railTitle="À surveiller"
        railItems={railItems}
        composer={<ChatDock />}
      />
    );
  }

  const stageRailTitle: string = shellData?.railTitle ?? def.railTitle;
  const stageRailItems: RailItem[] = shellData?.railItems ? [...shellData.railItems] : [];

  const stageContent = (() => {
    switch (mode) {
      case "chat":
        return <ChatStage mode={mode} />;
      case "mission":
        return <MissionStage mode={mode} />;
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

  return (
    <Shell
      centerContent={stageContent}
      railTitle={stageRailTitle}
      railItems={stageRailItems}
      composer={<ChatDock />}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                       Cockpit — factory cockpit content                    */
/* -------------------------------------------------------------------------- */

function CockpitContent({
  data,
  refetchState,
  onGoChat,
}: {
  data: CockpitTodayPayload | null;
  refetchState: "idle" | "loading" | "error";
  onGoChat: () => void;
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

  const telemetry = buildTelemetry(data);
  const factoryRows = buildFactoryRows(data);
  const watch = buildWatch(data);
  const proposals = buildProposals(data);
  const showError = refetchState === "error" && !data;

  const openCommandeur = (prefilledQuery?: string) =>
    setCommandeurOpen(true, prefilledQuery ? { prefilledQuery } : undefined);

  return (
    <motion.section
      key="cockpit"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="preserve-3d flex w-full flex-col mx-auto h-full overflow-hidden"
      style={{ gap: "var(--space-8)", maxWidth: "1600px", paddingBottom: "var(--space-4)" }}
    >
      {/* HEADER ultra-minimal */}
      <header
        className="flex flex-col relative w-full pb-2 shrink-0"
        style={{ gap: "var(--space-2)" }}
      >
        {/* Decor SVG */}
        <div className="absolute top-0 right-0 opacity-20 pointer-events-none hidden md:block">
          <svg width="200" height="80" viewBox="0 0 200 80" fill="none">
            <line
              x1="0"
              y1="40"
              x2="200"
              y2="40"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
            <circle cx="160" cy="40" r="20" stroke="white" strokeWidth="0.5" />
            <circle cx="160" cy="40" r="2" fill="white" />
          </svg>
        </div>

        <p className="uppercase tracking-[0.2em] text-[9px]" style={{ color: "var(--text-faint)" }}>
          {todayLabel}
        </p>
        <h1
          className="font-light leading-[1] tracking-tighter text-white"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3.5rem)" }}
        >
          {firstName ? `Bonjour, ${firstName}.` : "Bonjour."}
        </h1>
        {showError ? (
          <p className="uppercase tracking-[0.1em] text-[10px] text-white/40 mt-1">
            SYSTÈME HORS LIGNE
          </p>
        ) : null}

        <div className="mt-8">
          <TelemetryLine
            telemetry={telemetry}
            onInboxConnect={() => openCommandeur("connecter inbox gmail")}
            onAgendaConnect={() => openCommandeur("connecter google calendar")}
          />
        </div>
      </header>

      {/* Grid: 3 columns layout for ultra-wide screen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 w-full flex-1 overflow-hidden min-h-0 pt-4 border-t border-white/10">
        <div className="flex flex-col h-full overflow-hidden">
          <FactoryLine
            rows={factoryRows}
            onOpenMission={(id) => setMode({ mode: "mission", missionId: id })}
            onGoChat={onGoChat}
          />
        </div>
        <div className="flex flex-col h-full overflow-hidden">
          <WatchBlock
            watch={watch}
            onInboxOpen={() => openCommandeur("brief inbox")}
            onAgendaOpen={() => openCommandeur("agenda du jour")}
          />
        </div>
        <div className="flex flex-col h-full overflow-hidden">
          <AgentProposals
            proposals={proposals}
            onSuggestionOpen={(title) => openCommandeur(title)}
          />
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

function TelemetryLine({
  telemetry,
  onInboxConnect,
  onAgendaConnect,
}: {
  telemetry: TelemetryItem[];
  onInboxConnect: () => void;
  onAgendaConnect: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-6 lg:gap-12">
      {telemetry.map((item) => {
        const connectHandler =
          item.needsConnection && item.id === "inbox"
            ? onInboxConnect
            : item.needsConnection && item.id === "agenda"
              ? onAgendaConnect
              : null;
        const Wrapper = connectHandler ? "button" : "div";
        return (
          <Wrapper
            key={item.id}
            type={connectHandler ? "button" : undefined}
            onClick={connectHandler ?? undefined}
            className="flex items-center gap-3 transition-opacity hover:opacity-100 opacity-60"
            style={{ cursor: connectHandler ? "pointer" : "default" }}
          >
            <span className="font-light text-white text-xl">
              {item.value !== "—" ? item.value : "-"}
            </span>
            <span className="uppercase tracking-[0.2em] text-[9px] text-white pt-1">
              {item.label}
            </span>
          </Wrapper>
        );
      })}
    </div>
  );
}

interface AgentProposal {
  id: string;
  title: string;
  description: string;
  status: "ready" | "partial";
}

function AgentProposals({
  proposals,
  onSuggestionOpen,
}: {
  proposals: AgentProposal[];
  onSuggestionOpen: (prompt: string) => void;
}) {
  return (
    <section className="flex flex-col w-full h-full min-h-0">
      <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4 shrink-0">
        <h2 className="uppercase tracking-[0.15em] text-[10px] text-white">Propositions</h2>
        <span className="text-[9px] text-white/40">{proposals.length}</span>
      </div>
      {proposals.length === 0 ? (
        <div className="flex items-center justify-center py-8 opacity-20 shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="0.5" />
            <line
              x1="12"
              y1="0"
              x2="12"
              y2="24"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
            <line
              x1="0"
              y1="12"
              x2="24"
              y2="12"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto min-h-0 pb-4 pr-2">
          {proposals.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSuggestionOpen(p.title)}
              className="flex flex-col text-left group py-3 gap-1 opacity-70 hover:opacity-100 transition-opacity"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium text-white">{p.title}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: p.status === "ready" ? "white" : "var(--text-ghost)" }}
                />
              </div>
              <span className="text-xs text-white/50">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
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

function FactoryLine({
  rows,
  onOpenMission,
  onGoChat,
}: {
  rows: FactoryRow[];
  onOpenMission: (missionId: string) => void;
  onGoChat: () => void;
}) {
  return (
    <section className="flex flex-col w-full h-full min-h-0">
      <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4 shrink-0">
        <h2 className="uppercase tracking-[0.15em] text-[10px] text-white">Demandes</h2>
        <span className="text-[9px] text-white/40">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-8 opacity-20 shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="6" width="12" height="12" stroke="white" strokeWidth="0.5" />
            <line
              x1="12"
              y1="0"
              x2="12"
              y2="24"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
            <line
              x1="0"
              y1="12"
              x2="24"
              y2="12"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          </svg>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto min-h-0 pb-4 pr-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpenMission(row.missionId)}
                className="flex w-full items-start text-left py-3 gap-4 opacity-70 hover:opacity-100 transition-opacity"
              >
                <StatusPill status={row.status} />
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-sm font-medium text-white">{row.name}</span>
                  {row.detail ? <span className="text-xs text-white/40">{row.detail}</span> : null}
                </div>
                <span className="text-[10px] uppercase tracking-wide text-white/30">
                  {row.when}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: FactoryRow["status"] }) {
  const { dot, pulse } = pillTokens(status);
  return (
    <span className="flex items-center pt-1.5">
      <span
        aria-hidden
        className={pulse ? "animate-pulse" : ""}
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: dot,
        }}
      />
    </span>
  );
}

function pillTokens(status: FactoryRow["status"]): {
  dot: string;
  pulse: boolean;
} {
  switch (status) {
    case "running":
      return { dot: "white", pulse: true };
    case "success":
      return { dot: "var(--text-l2)", pulse: false };
    case "failed":
    case "blocked":
      return { dot: "white", pulse: false };
    default:
      return { dot: "var(--text-ghost)", pulse: false };
  }
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

function WatchBlock({
  watch,
  onInboxOpen,
  onAgendaOpen,
}: {
  watch: WatchData;
  onInboxOpen: () => void;
  onAgendaOpen: () => void;
}) {
  const blocks: { key: string; node: React.ReactNode }[] = [];

  if (watch.inbox.kind === "items") {
    blocks.push({
      key: "inbox",
      node: (
        <WatchCard title="Messages" action={{ label: "Ouvrir", onClick: onInboxOpen }}>
          <ul className="flex flex-col gap-3">
            {watch.inbox.items.slice(0, 3).map((it) => (
              <li key={it.id} className="flex flex-col gap-1">
                <span className="text-sm text-white">{it.title}</span>
                <span className="text-xs text-white/40">{it.summary}</span>
              </li>
            ))}
          </ul>
        </WatchCard>
      ),
    });
  } else if (watch.inbox.kind === "disconnected") {
    blocks.push({
      key: "inbox",
      node: (
        <WatchCard title="Messages" action={{ label: "Connecter", onClick: onInboxOpen }}>
          <p className="text-xs text-white/40">Source déconnectée.</p>
        </WatchCard>
      ),
    });
  }

  if (watch.agenda.kind === "items") {
    blocks.push({
      key: "agenda",
      node: (
        <WatchCard title="Agenda" action={{ label: "Détail", onClick: onAgendaOpen }}>
          <ul className="flex flex-col gap-3">
            {watch.agenda.items.slice(0, 3).map((ev) => (
              <li key={ev.id} className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-white">{ev.title}</span>
                <span className="text-[10px] uppercase tracking-wide text-white/40">{ev.when}</span>
              </li>
            ))}
          </ul>
        </WatchCard>
      ),
    });
  } else if (watch.agenda.kind === "disconnected") {
    blocks.push({
      key: "agenda",
      node: (
        <WatchCard title="Agenda" action={{ label: "Connecter", onClick: onAgendaOpen }}>
          <p className="text-xs text-white/40">Calendrier déconnecté.</p>
        </WatchCard>
      ),
    });
  }

  return (
    <section className="flex flex-col w-full h-full min-h-0">
      <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4 shrink-0">
        <h2 className="uppercase tracking-[0.15em] text-[10px] text-white">Signaux</h2>
      </div>
      {blocks.length === 0 ? (
        <div className="flex items-center justify-center py-8 opacity-20 shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 22,22 2,22" stroke="white" strokeWidth="0.5" />
            <line
              x1="12"
              y1="0"
              x2="12"
              y2="24"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
            <line
              x1="0"
              y1="12"
              x2="24"
              y2="12"
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto min-h-0 pb-4 pr-2">
          {blocks.map((b) => (
            <div key={b.key}>{b.node}</div>
          ))}
        </div>
      )}
    </section>
  );
}

function WatchCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col py-3 gap-2">
      <header className="flex items-center justify-between">
        <span className="text-xs tracking-widest uppercase text-white/50">{title}</span>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            {action.label}
          </button>
        ) : null}
      </header>
      <div className="flex-1 mt-1">{children}</div>
    </div>
  );
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

function buildRailItems(data: CockpitTodayPayload | null): RailItem[] {
  if (!data) return [];
  const items: RailItem[] = [];

  if (data.inbox.brief && data.inbox.brief.items.length > 0) {
    const n = data.inbox.brief.items.length;
    items.push({
      t: `${n} message${n > 1 ? "s" : ""} à examiner`,
      s: "À surveiller",
      hot: true,
    });
  } else if (data.inbox.needsConnection) {
    items.push({ t: "Messages déconnectés", s: "Connecter Gmail ou Slack" });
  }

  const running = data.missionsRunning.find((m) => m.status === "running");
  if (running) {
    items.push({ t: running.name, s: "Demande en cours", hot: true });
  }

  const failed = data.missionsRunning.find((m) => m.status === "failed");
  if (failed && items.length < RAIL_MAX) {
    items.push({ t: failed.name, s: "Demande en échec" });
  }

  if (data.agenda.length > 0 && items.length < RAIL_MAX) {
    const first = data.agenda[0];
    if (first) items.push({ t: first.title, s: formatTime(first.startsAt) });
  } else if (!data.calendarConnected && items.length < RAIL_MAX) {
    items.push({ t: "Agenda déconnecté", s: "Connecter Google Calendar" });
  }

  for (const sug of data.suggestions.slice(0, RAIL_MAX - items.length)) {
    items.push({ t: sug.title, s: sug.status === "ready" ? "Prêt" : "Partiel" });
  }

  for (const fav of data.favoriteReports.slice(0, RAIL_MAX - items.length)) {
    items.push({ t: fav.title, s: "Rapport disponible" });
  }

  return items.slice(0, RAIL_MAX);
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
      style={{ maxWidth: "1600px", margin: "0 auto" }}
    >
      <header className="flex flex-col gap-4">
        <p className="text-base font-medium text-[rgba(255,255,255,0.5)]">
          Shell visionOS · stage non câblé
        </p>
        <h1
          className="font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontSize: "var(--text-display)" }}
        >
          {def.label}
          {def.hotkey ? (
            <span className="ml-4 text-base font-normal text-[rgba(255,255,255,0.4)]">
              {def.hotkey}
            </span>
          ) : null}
        </h1>
        <p className="max-w-[640px] text-base leading-normal text-[rgba(255,255,255,0.7)]">
          Le composant Stage <code className="text-[rgba(255,255,255,0.85)]">{mode}</code> sera
          branché en P5 ou P6. Footer + railTitle alimentés par{" "}
          <code className="text-[rgba(255,255,255,0.85)]">STAGE_REGISTRY</code>.
        </p>
      </header>
    </motion.section>
  );
}
