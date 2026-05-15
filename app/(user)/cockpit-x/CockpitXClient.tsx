"use client";

import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { useChatStageStore } from "@/stores/chat-stage";
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

/**
 * CockpitXClient — orchestrateur du shell visionOS (P4+).
 *
 * Si `mode === "cockpit"`, rend le greeting + hero card vision-glass +
 * activité directement, alimentés par `CockpitTodayPayload` (la même
 * source que le cockpit legacy : `/api/v2/cockpit/today`).
 *
 * Le rendu suit le mockup `docs/visual/flow-demo-v2.html` et le scene
 * `lab/cli-os/src/scenes/CockpitScene.tsx` — c'est le but du port shell
 * visionOS : remplacer l'orbital view legacy (qui restait verrouillé sur
 * `app/(user)/`) par les nouvelles cartes. Le legacy `app/(user)/` n'est
 * pas touché — il reste actif jusqu'à la bascule P8.
 *
 * Pattern RSC prefetch + client refetch préservé (I-7 cockpit v1.5).
 * Fail-soft (I-2) et honest empty state (I-3) appliqués sur chaque carte.
 */

interface CockpitXClientProps {
  initialCockpitData: CockpitTodayPayload | null;
}

const ACTIVITY_MAX = 5;
const RAIL_MAX = 5;

export function CockpitXClient({ initialCockpitData }: CockpitXClientProps) {
  const mode = useStageStore((s) => s.current.mode);
  const def = STAGE_REGISTRY[mode];
  const setMode = useStageStore((s) => s.setMode);

  // Sources de vérité chat — alimentées par ChatStage (shellData) et ChatDock (runState).
  const shellData = useStageData((s) => s.shellData);
  const chatRunState = useChatStageStore((s) => s.runState);

  const [data, setData] = useState<CockpitTodayPayload | null>(initialCockpitData);

  // Client refetch au mount (I-7 cockpit v1.5) — l'initialData RSC sert au LCP,
  // mais on resync toujours pour éviter un snapshot SSR figé.
  useEffect(() => {
    if (mode !== "cockpit") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v2/cockpit/today", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as CockpitTodayPayload;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[CockpitX] refetch cockpit/today failed:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Router de stages — cockpit mode avec data, autres avec leurs composants P5.
  if (mode === "cockpit") {
    const railItems = buildRailItems(data);
    return (
      <Shell
        centerContent={<CockpitContent data={data} onGoChat={() => setMode({ mode: "chat" })} />}
        railTitle={def.railTitle}
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
  let stageRailTitle: string = shellData?.railTitle ?? def.railTitle;
  let stageRailItems: RailItem[] = shellData?.railItems ? [...shellData.railItems] : [];

  const stageContent = (() => {
    switch (mode) {
      case "chat":
        return <ChatStage mode={mode} />;

      case "mission":
        return <MissionStage mode={mode} />;

      case "asset":
        // AssetStage push railTitle + railItems via useStageData.setShellData.
        return <AssetStage mode={mode} />;

      case "browser":
        return <BrowserStage mode={mode} />;

      case "voice":
        // VoiceStage push railTitle + railItems via useStageData.setShellData.
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
/*                                Cockpit mode                                */
/* -------------------------------------------------------------------------- */

function CockpitContent({
  data,
  onGoChat,
}: {
  data: CockpitTodayPayload | null;
  onGoChat: () => void;
}) {
  const { data: session } = useSession();
  const setMode = useStageStore((s) => s.setMode);
  const firstName = session?.user?.name?.split(" ")[0] ?? null;
  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const summary = buildSummary(data);
  const hero = buildHero(data, setMode);
  const activity = buildActivity(data);

  return (
    <motion.section
      key="cockpit"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Greeting */}
      <header className="flex flex-col gap-4">
        <p className="text-base font-medium text-[var(--text-faint)] capitalize">{todayLabel}</p>
        <h1
          className="font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontSize: "var(--text-display)" }}
        >
          Bonjour{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="max-w-[640px] text-base leading-[1.5] text-[var(--text-muted)]">{summary}</p>
      </header>

      {/* Hero card — focus du jour */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="vision-glass preserve-3d relative flex flex-col gap-6 rounded-xl p-10 transition-transform duration-500 hover:-translate-y-1"
      >
        <div className="relative flex items-baseline justify-between">
          <span className="text-sm font-medium text-[var(--text-faint)]">{hero.label}</span>
          <span className="text-sm text-[var(--text-faint)]">{hero.meta}</span>
        </div>
        <h2
          className="relative max-w-[600px] font-medium leading-[1.2] tracking-tight text-white"
          style={{ fontSize: "var(--text-vision-2xl)" }}
        >
          {hero.title}
        </h2>
        <p className="relative max-w-[580px] text-base leading-[1.6] text-[var(--text-muted)]">
          {hero.body}
        </p>
        <div className="relative flex items-center gap-4 pt-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onGoChat}
            className="vision-btn-primary rounded-pill px-6 py-3 text-base transition-opacity hover:opacity-90"
          >
            Demander à l&apos;agent
          </motion.button>
          {hero.ctaSecondary ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={hero.ctaSecondary.onClick}
              className="vision-btn-glass rounded-pill px-6 py-3 text-base transition-colors hover:bg-[rgba(255,255,255,0.12)]"
            >
              {hero.ctaSecondary.label}
            </motion.button>
          ) : null}
        </div>
      </motion.section>

      {/* Activité */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center justify-between px-2">
          <h2 className="text-base font-medium tracking-tight text-white">Activité du jour</h2>
        </div>

        {activity.length === 0 ? (
          <p className="px-2 text-sm text-[rgba(255,255,255,0.4)]">
            Rien à l&apos;horizon. Lance une mission depuis le chat ou attends ton brief du matin.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.map((item) => (
              <li
                key={item.id}
                onClick={() => {
                  if (item.missionId) {
                    setMode({ mode: "mission", missionId: item.missionId });
                  }
                }}
                className={`flex items-center gap-5 rounded-lg px-4 py-4 transition-colors hover:bg-[var(--surface-2)] ${item.missionId ? "cursor-pointer" : ""}`}
              >
                <span
                  aria-hidden
                  className={`block size-2 rounded-full ${
                    item.tone === "hot"
                      ? "bg-white"
                      : item.tone === "warm"
                        ? "bg-[rgba(255,255,255,0.6)]"
                        : "bg-[rgba(255,255,255,0.3)]"
                  }`}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-base font-medium text-white">{item.title}</span>
                  <span className="text-sm text-[var(--text-faint)]">{item.meta}</span>
                </div>
                <span className="text-sm text-[var(--text-ghost)]">{item.when}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </motion.section>
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
    parts.push(`${runningCount} mission${runningCount > 1 ? "s" : ""} en cours`);
  }
  if (data.agenda.length > 0) {
    parts.push(`${data.agenda.length} rendez-vous`);
  }
  if (data.inbox.brief && data.inbox.brief.items.length > 0) {
    parts.push(`${data.inbox.brief.items.length} signaux inbox`);
  }
  if (parts.length === 0) {
    return "Aucune mission en cours. Tu peux respirer ou lancer une demande.";
  }
  return `${parts.join(" · ")}. Voici ce sur quoi l'agent peut t'aider aujourd'hui.`;
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

  // Priorité 1 : un brief inbox récent (drafts à valider, signaux frais)
  const inboxItems = data.inbox.brief?.items ?? [];
  if (inboxItems.length > 0) {
    const top = inboxItems[0];
    return {
      label: "Inbox",
      meta: `${inboxItems.length} signau${inboxItems.length > 1 ? "x" : ""}`,
      title: top?.title ?? "Tu as des signaux à examiner.",
      body: top?.summary ?? "L'agent a regroupé les nouveaux échanges importants depuis hier.",
    };
  }

  // Priorité 2 : une mission en cours
  const running = data.missionsRunning.find((m) => m.status === "running");
  if (running) {
    return {
      label: "Mission en cours",
      meta: running.lastRunAt ? formatAgo(running.lastRunAt) : "vient de démarrer",
      title: running.name,
      body: running.lastError
        ? `Dernière erreur : ${running.lastError}`
        : "Mission active. L'agent itère, tu peux suivre ses étapes en direct.",
      ctaSecondary: {
        label: "Ouvrir la mission",
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
    body: "Tu peux poser une question, lancer une mission, ou laisser l'agent veiller.",
  };
}

type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  when: string;
  tone: "hot" | "warm" | "cool";
  missionId?: string;
};

function buildActivity(data: CockpitTodayPayload | null): ActivityItem[] {
  if (!data) return [];
  const out: ActivityItem[] = [];

  for (const m of data.missionsRunning) {
    out.push({
      id: `mission-${m.id}`,
      missionId: m.id,
      title: m.name,
      meta:
        m.status === "running"
          ? "En cours"
          : m.status === "success"
            ? "Terminée"
            : m.status === "failed"
              ? "Échec"
              : m.status === "blocked"
                ? "Bloquée"
                : "Inactive",
      when: m.lastRunAt ? formatAgo(m.lastRunAt) : "—",
      tone: m.status === "running" ? "hot" : m.status === "failed" ? "warm" : "cool",
    });
  }

  for (const ev of data.agenda) {
    out.push({
      id: `agenda-${ev.id}`,
      title: ev.title,
      meta: ev.source === "live" ? "Agenda live" : "Agenda",
      when: formatTime(ev.startsAt),
      tone: "warm",
    });
  }

  return out.slice(0, ACTIVITY_MAX);
}

function buildRailItems(data: CockpitTodayPayload | null): RailItem[] {
  if (!data) return [];
  const items: RailItem[] = [];

  if (data.inbox.brief && data.inbox.brief.items.length > 0) {
    items.push({
      t: `${data.inbox.brief.items.length} signaux inbox`,
      s: "Drafts à valider",
      hot: true,
    });
  } else if (data.inbox.needsConnection) {
    items.push({ t: "Inbox déconnectée", s: "Connecte Gmail ou Slack" });
  }

  if (data.agenda.length > 0) {
    const first = data.agenda[0];
    if (first) {
      items.push({ t: first.title, s: formatTime(first.startsAt) });
    }
  } else if (!data.calendarConnected) {
    items.push({ t: "Agenda déconnecté", s: "Connecte Google Calendar" });
  }

  const running = data.missionsRunning.find((m) => m.status === "running");
  if (running) {
    items.push({ t: running.name, s: "Mission en cours" });
  }

  for (const sug of data.suggestions.slice(0, 2)) {
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
        <p className="max-w-[640px] text-base leading-[1.5] text-[rgba(255,255,255,0.7)]">
          Le composant Stage <code className="text-[rgba(255,255,255,0.85)]">{mode}</code> sera
          branché en P5 ou P6. Footer + railTitle alimentés par{" "}
          <code className="text-[rgba(255,255,255,0.85)]">STAGE_REGISTRY</code>.
        </p>
      </header>
    </motion.section>
  );
}
