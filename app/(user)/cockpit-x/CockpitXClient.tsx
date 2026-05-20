"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import type { StagePayload } from "@/stores/stage";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { Shell } from "../_shell/Shell";
import { ChatStage } from "../_stages/ChatStage";
import { MissionListStage } from "../_stages/MissionListStage";
import { MissionStage } from "../_stages/MissionStage";
import { STAGE_REGISTRY } from "../_stages/registry";
import type { RailItem, StageKey } from "../_stages/types";
import { ChatDock } from "../components/ChatDock";

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
const RAIL_MAX = 3;

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

  /* Mémoïsation des données dérivées — évite les re-calculs à chaque render */
  const telemetry = useMemo(() => buildTelemetry(data), [data]);
  const factoryRows = useMemo(() => buildFactoryRows(data), [data]);
  const watch = useMemo(() => buildWatch(data), [data]);
  const proposals = useMemo(() => buildProposals(data), [data]);
  const railItems = useMemo(() => buildRailItems(data), [data]);

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
        railTitle="ARBITRAGE REQUIS"
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

  return (
    <motion.section
      key="cockpit"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="preserve-3d flex w-full flex-col mx-auto flex-1 relative min-h-screen"
      style={{ maxWidth: "1600px" }}
    >
      {/* Contenu Principal - Alignement Editorial */}
      <div className="relative z-10 flex flex-col w-full max-w-[620px] px-14 pt-16 pb-32">
        {/* État d'erreur silencieux — affiché quand le refetch échoue */}
        {refetchState === "error" && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-8 rounded-(--radius-sm) border border-white/10 bg-white/5 px-(--space-4) py-(--space-3)"
          >
            <p className="t-13 text-white/60">
              Impossible de rafraîchir les données. Affichage des dernières informations connues.
            </p>
          </div>
        )}
        {/* Top Left - Ancrage système */}
        <header className="flex flex-col gap-1 mb-20">
          <div className="t-10 uppercase tracking-[var(--tracking-display)] text-white/30 font-mono font-bold">
            {todayLabel}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse" />
            <span className="t-9 uppercase tracking-[var(--tracking-display)] text-white/30 font-bold">
              En écoute
            </span>
          </div>
        </header>

        {/* Focus - Accueil & Arbitrage */}
        <div className="flex flex-col gap-4 mb-20">
          <h1 className="t-64 leading-[1.1] font-light tracking-[-0.04em] text-white/90">
            {firstName ? `Bonjour, ${firstName}.` : "Bonjour."}
          </h1>
          <p className="t-20 font-light text-white/55">
            {telemetry[0]?.value !== "0" && telemetry[0]?.value !== "—"
              ? `${telemetry[0].value} exécutions requièrent votre attention.`
              : telemetry[2]?.value !== "0" && telemetry[2]?.value !== "—"
                ? `${telemetry[2].value} communications requièrent votre arbitrage.`
                : "Aucune décision urgente requise."}
          </p>
        </div>

        {/* Listes Éditoriales (Max 3 items au total) */}
        <div className="flex flex-col gap-16">
          {/* EXÉCUTION */}
          {factoryRows.length > 0 && (
            <div className="flex flex-col gap-10">
              {/* EXÉCUTION ACTIVE */}
              <div className="flex flex-col">
                <div className="border-t border-white/5 pt-4 mb-6">
                  <h2 className="t-10 uppercase tracking-[var(--tracking-display)] font-bold text-white/30">
                    Exécution active
                  </h2>
                </div>
                <div className="flex flex-col gap-6">
                  {factoryRows.slice(0, 1).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      aria-label={`Mission ${row.name}, statut ${row.statusLabel}`}
                      onClick={() => setMode({ mode: "mission", missionId: row.missionId })}
                      className="flex flex-col text-left group gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-(--radius-sm)"
                    >
                      <span className="t-18 text-white/80 group-hover:text-white transition-colors duration-500">
                        {row.name}
                      </span>
                      {row.detail && <span className="t-15 text-white/45">{row.detail}</span>}
                      <span className="t-11 uppercase font-mono text-white/25 mt-1">
                        Dernière activité — {row.when}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* EN FILE */}
              {factoryRows.length > 1 && (
                <div className="flex flex-col">
                  <div className="border-t border-white/5 pt-4 mb-6">
                    <h2 className="t-10 uppercase tracking-[var(--tracking-display)] font-bold text-white/30">
                      En file
                    </h2>
                  </div>
                  <div className="flex flex-col gap-4">
                    {factoryRows.slice(1, 3).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        aria-label={`Mission ${row.name}, statut ${row.statusLabel}`}
                        onClick={() => setMode({ mode: "mission", missionId: row.missionId })}
                        className="flex flex-col text-left group gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-(--radius-sm)"
                      >
                        <span className="t-15 text-white/50 group-hover:text-white transition-colors duration-500">
                          {row.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RADAR (Inbox / Agenda) */}
          {(watch.inbox.kind === "items" || watch.agenda.kind === "items") && (
            <div className="flex flex-col">
              <div className="border-t border-white/5 pt-4 mb-6">
                <h2 className="t-10 uppercase tracking-[var(--tracking-display)] font-bold text-white/30">
                  Radar
                </h2>
              </div>
              <div className="flex flex-col gap-6">
                {watch.inbox.kind === "items" &&
                  watch.inbox.items.slice(0, 1).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      aria-label={`Message : ${it.title}`}
                      onClick={() => openCommandeur("brief inbox")}
                      className="flex flex-col text-left group gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-(--radius-sm)"
                    >
                      <span className="t-15 text-white/70 group-hover:text-white transition-colors duration-500">
                        {it.title}
                      </span>
                      <span className="t-14 text-white/45">{it.summary}</span>
                    </button>
                  ))}
                {watch.agenda.kind === "items" &&
                  watch.agenda.items.slice(0, 1).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      aria-label={`Événement agenda : ${ev.title} à ${ev.when}`}
                      onClick={() => openCommandeur("agenda du jour")}
                      className="flex flex-col text-left group gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-(--radius-sm)"
                    >
                      <span className="t-15 text-white/70 group-hover:text-white transition-colors duration-500">
                        Prochain engagement : {ev.title}
                      </span>
                      <span className="t-10 uppercase font-mono text-white/25 mt-1">{ev.when}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* INITIATIVES */}
          {proposals.length > 0 && (
            <div className="flex flex-col">
              <div className="border-t border-white/5 pt-4 mb-6">
                <h2 className="t-10 uppercase tracking-[var(--tracking-display)] font-bold text-white/30">
                  Initiatives
                </h2>
              </div>
              <div className="flex flex-col gap-6">
                {proposals.slice(0, 1).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={`Initiative : ${p.title}`}
                    onClick={() => openCommandeur(p.title)}
                    className="flex flex-col text-left group gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-(--radius-sm)"
                  >
                    <span className="t-15 text-white/70 group-hover:text-white transition-colors duration-500">
                      {p.title}
                    </span>
                    <span className="t-14 text-white/45">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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

function buildRailItems(data: CockpitTodayPayload | null): RailItem[] {
  if (!data) return [];
  const items: RailItem[] = [];

  // Priorité 1 : Messages déconnectés ou urgents
  if (data.inbox.needsConnection) {
    items.push({ t: "Messages déconnectés", s: "Connecter Gmail ou Slack" });
  } else if (data.inbox.brief && data.inbox.brief.items.length > 0) {
    const n = data.inbox.brief.items.length;
    items.push({
      t: `${n} message${n > 1 ? "s" : ""} à examiner`,
      s: "Action requise",
      hot: true,
    });
  }

  // Priorité 2 : Rapports disponibles (ex: Deal-to-Cash)
  for (const fav of data.favoriteReports) {
    if (items.length >= RAIL_MAX) break;
    items.push({ t: fav.title, s: "Rapport disponible" });
  }

  // Priorité 3 : Demandes en échec
  const failed = data.missionsRunning.find((m) => m.status === "failed");
  if (failed && items.length < RAIL_MAX) {
    items.push({ t: failed.name, s: "Demande en échec" });
  }

  // Priorité 4 : Agenda déconnecté ou prochain event
  if (!data.calendarConnected && items.length < RAIL_MAX) {
    items.push({ t: "Agenda déconnecté", s: "Connecter Google Calendar" });
  } else if (data.agenda.length > 0 && items.length < RAIL_MAX) {
    const first = data.agenda[0];
    if (first) items.push({ t: first.title, s: formatTime(first.startsAt) });
  }

  // Priorité 5 : Suggestions
  for (const sug of data.suggestions) {
    if (items.length >= RAIL_MAX) break;
    items.push({ t: sug.title, s: sug.status === "ready" ? "Prêt" : "Partiel" });
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
        <p className="text-base font-medium text-(--text-faint)">
          Shell visionOS · stage non câblé
        </p>
        <h1
          className="font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontSize: "var(--text-display)" }}
        >
          {def.label}
          {def.hotkey ? (
            <span className="ml-4 text-base font-normal text-(--text-ghost)">{def.hotkey}</span>
          ) : null}
        </h1>
        <p className="max-w-[640px] text-base leading-normal text-(--text-muted)">
          Le composant Stage <code className="text-(--text-soft)">{mode}</code> sera branché en P5
          ou P6. Footer + railTitle alimentés par{" "}
          <code className="text-(--text-soft)">STAGE_REGISTRY</code>.
        </p>
      </header>
    </motion.section>
  );
}
