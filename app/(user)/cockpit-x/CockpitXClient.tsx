"use client";

import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
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
import type { RailItem } from "../_stages/types";
import { VoiceStage } from "../_stages/VoiceStage";
import { ChatDock } from "../components/ChatDock";
import { ConnectionsHub } from "../components/ConnectionsHub";

/**
 * CockpitXClient — orchestrateur du shell visionOS (P4+).
 *
 * Mode `cockpit` = Dashboard personnel : header compact + focus du jour avec
 * télémétrie discrète + propositions actionnables de l'agent + demandes en cours
 * + vue globale (Messages / Agenda). Toutes
 * les surfaces sont alimentées par `CockpitTodayPayload`
 * (`/api/v2/cockpit/today`). Pas de mock, pas de faux bouton : empty
 * states honnêtes, CTA câblés sur Chat / Mission / Commandeur uniquement.
 *
 * Vocabulaire visible : « Demandes » → code mode `"mission"`, « Messages »
 * → champ `inbox`. Rename UI 2026-05 pour parler à monsieur tout le monde ;
 * types/store/routes inchangés.
 *
 * Le legacy `app/(user)/` reste actif jusqu'à la bascule P8.
 *
 * Pattern RSC prefetch + client refetch préservé (I-7 cockpit v1.5).
 * Fail-soft (I-2) et honest empty state (I-3) appliqués sur chaque carte.
 */

interface CockpitXClientProps {
  initialCockpitData: CockpitTodayPayload | null;
}

const FACTORY_MAX = 5;
const RAIL_MAX = 5;

export function CockpitXClient({ initialCockpitData }: CockpitXClientProps) {
  const mode = useStageStore((s) => s.current.mode);
  const def = STAGE_REGISTRY[mode];
  const setMode = useStageStore((s) => s.setMode);

  // Sources de vérité chat — alimentées par ChatStage (shellData) et ChatDock (runState).
  const shellData = useStageData((s) => s.shellData);

  const [data, setData] = useState<CockpitTodayPayload | null>(initialCockpitData);
  const [refetchState, setRefetchState] = useState<"idle" | "loading" | "error">("idle");

  // Client refetch au mount (I-7 cockpit v1.5) — l'initialData RSC sert au LCP,
  // mais on resync toujours pour éviter un snapshot SSR figé.
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

  // Router de stages — cockpit mode avec data, autres avec leurs composants P5.
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

  // Stages P5 branchés — contenu + rail items par mode.
  //
  // Pattern data-bound (complet, vagues 1-3) : chaque Stage pousse son railTitle
  // + railItems via `useStageData.setShellData(...)` au mount, clear au unmount.
  // CockpitXClient lit `shellData` du store et fallback registry si rien n'a été push.
  // Tous les 12 stages sont désormais data-bound — plus de hardcodes ici.
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

  const summary = buildSummary(data);
  const hero = buildHero(data, setMode);
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="preserve-3d flex w-full max-w-[760px] flex-col 2xl:max-w-[820px]"
      style={{ gap: "var(--space-10)" }}
    >
      {/* HEADER compact */}
      <header className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <p className="t-13 capitalize" style={{ color: "var(--text-faint)" }}>
          {todayLabel}
        </p>
        <h1
          className="font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontSize: "var(--text-display)" }}
        >
          Bonjour{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p
          className="max-w-[640px] text-base leading-normal"
          style={{ color: "var(--text-muted)" }}
        >
          {summary}
        </p>
        {showError ? (
          <p className="t-13" style={{ color: "var(--text-faint)" }}>
            Synchronisation indisponible pour l&apos;instant. Réessaie dans un instant.
          </p>
        ) : null}
      </header>

      {/* FOCUS — priorité du moment + télémétrie compacte */}
      <FocusCard
        hero={hero}
        telemetry={telemetry}
        onGoChat={onGoChat}
        onInboxConnect={() => openCommandeur("connecter inbox gmail")}
        onAgendaConnect={() => openCommandeur("connecter google calendar")}
      />

      {/* Propositions actionnables de l'agent */}
      <AgentProposals proposals={proposals} onSuggestionOpen={(title) => openCommandeur(title)} />

      {/* FACTORY LINE — missions running/récentes */}
      <FactoryLine
        rows={factoryRows}
        onOpenMission={(id) => setMode({ mode: "mission", missionId: id })}
        onGoChat={onGoChat}
      />

      {/* Vue globale — signaux / agenda */}
      <WatchBlock
        watch={watch}
        onInboxOpen={() => openCommandeur("brief inbox")}
        onAgendaOpen={() => openCommandeur("agenda du jour")}
      />
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
  /** True quand le footnote suggère une action de connexion (CTA Commandeur). */
  needsConnection?: boolean;
}

function FocusCard({
  hero,
  telemetry,
  onGoChat,
  onInboxConnect,
  onAgendaConnect,
}: {
  hero: HeroContent;
  telemetry: TelemetryItem[];
  onGoChat: () => void;
  onInboxConnect: () => void;
  onAgendaConnect: () => void;
}) {
  return (
    <section
      className="preserve-3d relative flex flex-col"
      style={{
        padding: "var(--space-2) 0",
        gap: "var(--space-3)",
      }}
    >
      <div className="relative flex items-baseline justify-between">
        <span className="t-12 font-medium" style={{ color: "var(--accent-teal)" }}>
          {hero.label}
        </span>
        <span className="t-12" style={{ color: "var(--text-faint)" }}>
          {hero.meta}
        </span>
      </div>
      <h2
        className="relative max-w-[640px] font-medium leading-[1.2] tracking-tight text-white"
        style={{ fontSize: "var(--text-vision-2xl)" }}
      >
        {hero.title}
      </h2>
      <p
        className="relative max-w-[600px] text-lg leading-[1.6]"
        style={{ color: "var(--text-muted)" }}
      >
        {hero.body}
      </p>
      <TelemetryGrid
        telemetry={telemetry}
        onInboxConnect={onInboxConnect}
        onAgendaConnect={onAgendaConnect}
      />
      <div
        className="relative flex items-center"
        style={{ gap: "var(--space-3)", paddingTop: "var(--space-4)" }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onGoChat}
          className="vision-btn-primary t-13 font-medium"
          style={{
            padding: "var(--space-2-5) var(--space-5)",
            borderRadius: "var(--radius-pill)",
            cursor: "pointer",
          }}
        >
          Demander à l&apos;agent
        </motion.button>
        {hero.ctaSecondary ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={hero.ctaSecondary.onClick}
            className="vision-btn-glass t-13"
            style={{
              padding: "var(--space-2-5) var(--space-5)",
              borderRadius: "var(--radius-pill)",
              cursor: "pointer",
            }}
          >
            {hero.ctaSecondary.label}
          </motion.button>
        ) : null}
      </div>
    </section>
  );
}

function TelemetryGrid({
  telemetry,
  onInboxConnect,
  onAgendaConnect,
}: {
  telemetry: TelemetryItem[];
  onInboxConnect: () => void;
  onAgendaConnect: () => void;
}) {
  return (
    <div
      className="relative flex flex-wrap"
      style={{
        gap: "var(--space-3)",
        paddingTop: "var(--space-2)",
      }}
    >
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
            aria-label={connectHandler ? `${item.label} — ${item.footnote}` : undefined}
            className="flex items-center text-left transition-opacity hover:opacity-80"
            style={{
              padding: "var(--space-1-5) var(--space-3)",
              borderRadius: "var(--radius-pill)",
              background: item.tone === "warn" ? "var(--gold-surface)" : "var(--surface-1)",
              border: `1px solid ${item.tone === "warn" ? "var(--gold-border)" : "transparent"}`,
              gap: "var(--space-2)",
              cursor: connectHandler ? "pointer" : "default",
            }}
          >
            <span className="t-12" style={{ color: "var(--text-faint)" }}>
              {item.label}
            </span>
            {item.value !== "—" && (
              <span className="font-medium text-white t-12">{item.value}</span>
            )}
            <span
              className="t-11"
              style={{ color: item.tone === "warn" ? "var(--gold)" : "var(--text-muted)" }}
            >
              {item.footnote}
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
    <section className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div
        className="flex items-baseline justify-between"
        style={{ paddingInline: "var(--space-1)" }}
      >
        <h2 className="t-15 font-medium text-white">L&apos;agent propose</h2>
        <span className="t-11" style={{ color: "var(--text-faint)" }}>
          {proposals.length > 0
            ? `${proposals.length} idée${proposals.length > 1 ? "s" : ""}`
            : "aucune idée prête"}
        </span>
      </div>
      {proposals.length === 0 ? (
        <div
          className="flex flex-col"
          style={{
            padding: "var(--space-2) 0",
            gap: "var(--space-1)",
          }}
        >
          <p className="t-13" style={{ color: "var(--text-muted)" }}>
            Aucune proposition fiable pour le moment.
          </p>
          <p className="t-11" style={{ color: "var(--text-faint)" }}>
            Les propositions apparaissent quand une source connectée donne assez de contexte.
          </p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          {proposals.map((proposal) => (
            <button
              key={proposal.id}
              type="button"
              onClick={() => onSuggestionOpen(proposal.title)}
              className="flex w-full items-center text-left transition-opacity hover:opacity-70 group"
              style={{
                padding: "var(--space-3) 0",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--border-default) 40%, transparent)",
                gap: "var(--space-3)",
                cursor: "pointer",
              }}
            >
              <span
                className="shrink-0"
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background:
                    proposal.status === "ready" ? "var(--accent-teal)" : "var(--text-ghost)",
                }}
              />
              <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
                <span className="t-13 font-medium text-white">{proposal.title}</span>
                <span className="t-12" style={{ color: "var(--text-muted)" }}>
                  {proposal.description}
                </span>
              </span>
              <span
                className="t-11"
                style={{
                  color: proposal.status === "ready" ? "var(--accent-teal)" : "var(--text-faint)",
                }}
              >
                {proposal.status === "ready" ? "Prêt" : "À compléter"}
              </span>
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
    <section className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div
        className="flex items-baseline justify-between"
        style={{ paddingInline: "var(--space-1)" }}
      >
        <h2 className="t-15 font-medium text-white">Suivi des demandes</h2>
        <span className="t-11" style={{ color: "var(--text-faint)" }}>
          {rows.length > 0 ? `${rows.length} demande${rows.length > 1 ? "s" : ""}` : "vide"}
        </span>
      </div>
      {rows.length === 0 ? (
        <div
          className="flex flex-col items-start"
          style={{
            padding: "var(--space-2) 0",
            gap: "var(--space-2)",
          }}
        >
          <p className="t-13" style={{ color: "var(--text-muted)" }}>
            Aucune demande en cours. Demande à l&apos;agent de t&apos;aider — il propose le plan.
          </p>
          <button
            type="button"
            onClick={onGoChat}
            className="vision-btn-glass t-12"
            style={{
              padding: "var(--space-1-5) var(--space-3)",
              borderRadius: "var(--radius-pill)",
              cursor: "pointer",
            }}
          >
            Faire une demande
          </button>
        </div>
      ) : (
        <ul className="flex flex-col" style={{ gap: "0" }}>
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpenMission(row.missionId)}
                className="flex w-full items-center text-left transition-opacity hover:opacity-70"
                style={{
                  padding: "var(--space-2) 0",
                  gap: "var(--space-3)",
                  cursor: "pointer",
                }}
              >
                <StatusPill status={row.status} label={row.statusLabel} />
                <div className="flex flex-1 flex-col" style={{ gap: "2px" }}>
                  <span className="t-13 font-medium text-white">{row.name}</span>
                  {row.detail ? (
                    <span className="t-11" style={{ color: "var(--text-faint)" }}>
                      {row.detail}
                    </span>
                  ) : null}
                </div>
                <span className="t-11" style={{ color: "var(--text-ghost)" }}>
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

function StatusPill({ status, label }: { status: FactoryRow["status"]; label: string }) {
  const { dot, fg, pulse } = pillTokens(status);
  return (
    <span
      className="flex items-center"
      style={{
        gap: "var(--space-1-5)",
        minWidth: "90px",
      }}
    >
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
      <span className="t-12 font-medium" style={{ color: fg }}>
        {label}
      </span>
    </span>
  );
}

function pillTokens(status: FactoryRow["status"]): {
  dot: string;
  surface: string;
  fg: string;
  pulse: boolean;
} {
  switch (status) {
    case "running":
      return {
        dot: "var(--accent-teal)",
        surface: "var(--accent-teal-surface)",
        fg: "var(--text-l1)",
        pulse: true,
      };
    case "success":
      return {
        dot: "var(--accent-teal)",
        surface: "var(--accent-teal-surface)",
        fg: "var(--text-l1)",
        pulse: false,
      };
    case "failed":
      return {
        dot: "var(--danger)",
        surface: "var(--danger-surface)",
        fg: "var(--text-l1)",
        pulse: false,
      };
    case "blocked":
      return {
        dot: "var(--gold)",
        surface: "var(--gold-surface)",
        fg: "var(--text-l1)",
        pulse: false,
      };
    default:
      return {
        dot: "var(--text-ghost)",
        surface: "var(--surface-1)",
        fg: "var(--text-faint)",
        pulse: false,
      };
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

  // Messages (Inbox)
  if (watch.inbox.kind === "items") {
    blocks.push({
      key: "inbox",
      node: (
        <WatchCard
          title="Messages"
          meta={`${watch.inbox.items.length} à examiner`}
          action={{ label: "Ouvrir le brief", onClick: onInboxOpen }}
        >
          <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            {watch.inbox.items.slice(0, 3).map((it) => (
              <li key={it.id} className="flex flex-col" style={{ gap: "var(--space-0-5)" }}>
                <span className="t-13 text-white">{it.title}</span>
                <span className="t-11" style={{ color: "var(--text-faint)" }}>
                  {it.summary}
                </span>
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
        <WatchCard
          title="Messages"
          meta="déconnectée"
          tone="warn"
          action={{ label: "Connecter Gmail ou Slack", onClick: onInboxOpen }}
        >
          <p className="t-12" style={{ color: "var(--text-muted)" }}>
            L&apos;agent ne lit aucune messagerie pour l&apos;instant. Connectez une source pour
            recevoir un brief du jour.
          </p>
        </WatchCard>
      ),
    });
  }

  // Agenda
  if (watch.agenda.kind === "items") {
    blocks.push({
      key: "agenda",
      node: (
        <WatchCard
          title="Agenda"
          meta={`${watch.agenda.items.length} rendez-vous`}
          action={{ label: "Voir le détail", onClick: onAgendaOpen }}
        >
          <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            {watch.agenda.items.slice(0, 3).map((ev) => (
              <li
                key={ev.id}
                className="flex items-baseline justify-between"
                style={{ gap: "var(--space-3)" }}
              >
                <span className="t-13 text-white">{ev.title}</span>
                <span className="t-11" style={{ color: "var(--text-ghost)" }}>
                  {ev.when}
                </span>
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
        <WatchCard
          title="Agenda"
          meta="déconnecté"
          tone="warn"
          action={{ label: "Connecter Google Calendar", onClick: onAgendaOpen }}
        >
          <p className="t-12" style={{ color: "var(--text-muted)" }}>
            Pas de calendrier branché. Connectez-le pour voir les rendez-vous du jour sur ce
            dashboard.
          </p>
        </WatchCard>
      ),
    });
  }

  if (blocks.length === 0) {
    return (
      <section className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        <h2 className="t-15 font-medium text-white" style={{ paddingInline: "var(--space-1)" }}>
          Vue globale
        </h2>
        <div
          className="flex flex-col"
          style={{
            padding: "var(--space-2) 0",
            gap: "var(--space-1)",
          }}
        >
          <p className="t-13" style={{ color: "var(--text-muted)" }}>
            Rien d&apos;important à afficher pour le moment.
          </p>
          <p className="t-11" style={{ color: "var(--text-faint)" }}>
            L&apos;agent vous préviendra dès qu&apos;un message ou un rendez-vous arrive.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <h2 className="t-15 font-medium text-white" style={{ paddingInline: "var(--space-1)" }}>
        Vue globale
      </h2>
      <div
        className="grid"
        style={{
          gridTemplateColumns: blocks.length > 1 ? "repeat(auto-fit, minmax(260px, 1fr))" : "1fr",
          gap: "var(--space-6)",
        }}
      >
        {blocks.map((b) => (
          <div key={b.key}>{b.node}</div>
        ))}
      </div>
    </section>
  );
}

function WatchCard({
  title,
  meta,
  tone = "default",
  action,
  children,
}: {
  title: string;
  meta?: string;
  tone?: "default" | "warn";
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full flex-col"
      style={{
        padding: "var(--space-2) 0",
        gap: "var(--space-3)",
        borderTop: "1px solid color-mix(in srgb, var(--border-default) 40%, transparent)",
        paddingTop: "var(--space-3)",
      }}
    >
      <header className="flex items-baseline gap-2">
        <span className="t-13 font-medium text-white">{title}</span>
        {meta ? (
          <span
            className="t-11"
            style={{ color: tone === "warn" ? "var(--gold)" : "var(--text-faint)" }}
          >
            — {meta}
          </span>
        ) : null}
      </header>
      <div className="flex-1 pl-1">{children}</div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="t-12 self-start font-medium transition-opacity hover:opacity-70"
          style={{
            color: "var(--text-muted)",
            cursor: "pointer",
            marginTop: "var(--space-1)",
          }}
        >
          {action.label} →
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                       Builders data-bound fail-soft                        */
/* -------------------------------------------------------------------------- */

function buildSummary(data: CockpitTodayPayload | null): string {
  if (!data) return "Synchronisation en cours…";
  const parts: string[] = [];
  const runningCount = data.missionsRunning.filter((m) => m.status === "running").length;
  if (runningCount > 0) {
    parts.push(`${runningCount} demande${runningCount > 1 ? "s" : ""} en cours`);
  }
  if (data.agenda.length > 0) {
    parts.push(`${data.agenda.length} rendez-vous`);
  }
  if (data.inbox.brief && data.inbox.brief.items.length > 0) {
    const n = data.inbox.brief.items.length;
    parts.push(`${n} message${n > 1 ? "s" : ""} à examiner`);
  }
  if (parts.length === 0) {
    return "Aucune demande en cours. Tu peux respirer ou demander à l'agent de t'aider.";
  }
  return `${parts.join(" · ")}. Voici ce sur quoi l'agent peut t'aider aujourd'hui.`;
}

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
      ? `en cours · ${recentCount} récente${recentCount > 1 ? "s" : ""}`
      : recentCount > 0
        ? `${recentCount} récente${recentCount > 1 ? "s" : ""}`
        : "rien en cours";

  const agendaCount = data.agenda.length;
  const agendaCard: TelemetryItem = !data.calendarConnected
    ? {
        id: "agenda",
        label: "Agenda",
        value: "—",
        footnote: "déconnecté · connecter",
        tone: "warn",
        progress: 20,
        needsConnection: true,
      }
    : {
        id: "agenda",
        label: "Agenda",
        value: String(agendaCount),
        footnote: agendaCount > 0 ? "rendez-vous à venir" : "rien aujourd'hui",
        tone: agendaCount > 0 ? "active" : "rest",
        progress: progressFromCount(agendaCount, 4),
      };

  const inboxItems = data.inbox.brief?.items.length ?? 0;
  const inboxCard: TelemetryItem = data.inbox.needsConnection
    ? {
        id: "inbox",
        label: "Messages",
        value: "—",
        footnote: "déconnectée · connecter",
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

type HeroContent = {
  label: string;
  meta: string;
  title: string;
  body: string;
  ctaSecondary?: { label: string; onClick: () => void };
};

function buildHero(
  data: CockpitTodayPayload | null,
  setMode: (p: import("@/stores/stage").StagePayload) => void,
): HeroContent {
  if (!data) {
    return {
      label: "Cockpit",
      meta: "synchronisation",
      title: "Chargement du brief du jour.",
      body: "Les données vont apparaître dans quelques secondes.",
    };
  }

  // Priorité 1 : un brief inbox récent (drafts à valider, messages frais)
  const inboxItems = data.inbox.brief?.items ?? [];
  if (inboxItems.length > 0) {
    const top = inboxItems[0];
    return {
      label: "Messages",
      meta: `${inboxItems.length} à examiner`,
      title: top?.title ?? "Vous avez des messages à examiner.",
      body: top?.summary ?? "L'agent a regroupé les nouveaux échanges importants depuis hier.",
    };
  }

  // Priorité 2 : une demande en cours
  const running = data.missionsRunning.find((m) => m.status === "running");
  if (running) {
    return {
      label: "Demande en cours",
      meta: running.lastRunAt ? formatAgo(running.lastRunAt) : "vient de démarrer",
      title: running.name,
      body: running.lastError
        ? `Dernière erreur : ${running.lastError}`
        : "Demande active. L'agent travaille, vous pouvez suivre ses étapes en direct.",
      ctaSecondary: {
        label: "Ouvrir la demande",
        onClick: () => setMode({ mode: "mission", missionId: running.id }),
      },
    };
  }

  // Priorité 3 : un rendez-vous imminent
  if (data.agenda.length > 0) {
    const next = data.agenda[0];
    if (next) {
      return {
        label: "Agenda",
        meta: formatTime(next.startsAt),
        title: next.title,
        body: "Prochain rendez-vous. Veux-tu un récap rapide ?",
      };
    }
  }

  // Priorité 4 : une suggestion (rapport applicable)
  if (data.suggestions.length > 0) {
    const sug = data.suggestions[0];
    if (sug) {
      return {
        label: "Suggestion",
        meta: sug.status === "ready" ? "prêt" : "partiel",
        title: sug.title,
        body: sug.description,
      };
    }
  }

  // Honest empty state (I-3) — pas de mock.
  return {
    label: "Cockpit",
    meta: "calme",
    title: "Rien d'urgent ce matin.",
    body: "Vous pouvez poser une question, faire une demande, ou laisser l'agent veiller.",
  };
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

  // Priorité 1 : inbox brief (messages à examiner)
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

  // Priorité 2 : demande en cours (hot)
  const running = data.missionsRunning.find((m) => m.status === "running");
  if (running) {
    items.push({ t: running.name, s: "Demande en cours", hot: true });
  }

  // Priorité 3 : demande en échec récente (warn)
  const failed = data.missionsRunning.find((m) => m.status === "failed");
  if (failed && items.length < RAIL_MAX) {
    items.push({ t: failed.name, s: "Demande en échec" });
  }

  // Priorité 4 : agenda imminent
  if (data.agenda.length > 0 && items.length < RAIL_MAX) {
    const first = data.agenda[0];
    if (first) items.push({ t: first.title, s: formatTime(first.startsAt) });
  } else if (!data.calendarConnected && items.length < RAIL_MAX) {
    items.push({ t: "Agenda déconnecté", s: "Connecter Google Calendar" });
  }

  // Priorité 5 : propositions (l'agent propose)
  for (const sug of data.suggestions.slice(0, RAIL_MAX - items.length)) {
    items.push({ t: sug.title, s: sug.status === "ready" ? "Prêt" : "Partiel" });
  }

  // Fillers : favoris (si reste de la place)
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
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
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
