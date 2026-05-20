"use client";

/**
 * MissionListStage — liste toutes les demandes de l'utilisateur.
 *
 * Affiché quand le mode est "mission" mais qu'aucun missionId n'est
 * présent dans le store (landing /missions sans sélection).
 *
 * Clic sur une card → setMode({ mode: "mission", missionId: mission.id })
 * Bouton "Nouvelle demande" → setCommandeurOpen(true, { prefilledQuery })
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EmptyState, StageErrorBanner } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { STAGE_REGISTRY } from "./registry";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: VISION_EASE },
  },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: (idx: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: VISION_EASE, delay: idx * 0.05 },
  }),
  exit: { opacity: 0, y: -4, transition: { duration: 0.2 } },
};

// ── Types API ─────────────────────────────────────────────────────────────────

interface ApiMission {
  id: string;
  name: string;
  input: string;
  schedule: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastRunStatus?: "success" | "failed" | "blocked" | "awaiting_approval";
  lastError?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Étiquette FR pour le statut global de la mission. */
function missionStatusLabel(mission: ApiMission): string {
  switch (mission.lastRunStatus) {
    case "success":
      return "Réussi";
    case "failed":
      return "Échec";
    case "blocked":
      return "Bloqué";
    case "awaiting_approval":
      return "Approbation requise";
    default:
      return mission.enabled ? "En cours" : "En attente";
  }
}

function badgeClass(mission: ApiMission): { className: string; pulse: boolean } {
  const isError = mission.lastRunStatus === "failed" || mission.lastRunStatus === "blocked";
  const isApproval = mission.lastRunStatus === "awaiting_approval";
  const isSuccess = mission.lastRunStatus === "success";
  const isRunning = mission.enabled && !mission.lastRunStatus;

  if (isError)
    return {
      className: "bg-(--danger)/10 border border-(--danger)/35 text-(--danger)",
      pulse: false,
    };
  if (isApproval)
    return {
      className: "bg-(--gold-surface) border border-(--gold-border) text-(--gold)",
      pulse: false,
    };
  if (isSuccess)
    return {
      className: "bg-(--surface-1) border border-(--line) text-text-muted",
      pulse: false,
    };
  if (isRunning)
    return {
      className:
        "bg-(--accent-teal-surface) border border-(--accent-teal-border) text-(--accent-teal)",
      pulse: true,
    };
  return {
    className: "bg-(--surface-1) border border-(--line) text-text-ghost",
    pulse: false,
  };
}

// ── Démo dev-only ────────────────────────────────────────────────────────────
// Affiché uniquement en dev quand la liste réelle est vide, pour développer
// le design sans dépendre de l'API. Inchangé en production.

const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_MISSIONS: ApiMission[] = [
  {
    id: "demo-1",
    name: "Veille concurrentielle hebdomadaire",
    input:
      "Surveiller les annonces produit des trois principaux concurrents et produire une synthèse priorisée.",
    schedule: "0 8 * * 1",
    enabled: true,
    createdAt: new Date("2026-04-22T09:12:00").getTime(),
    lastRunAt: new Date("2026-05-12T08:03:00").getTime(),
    lastRunStatus: "success",
  },
  {
    id: "demo-2",
    name: "Synthèse des tickets support critiques",
    input: "Agréger les tickets P0/P1 ouverts depuis 24h et alerter l'astreinte.",
    schedule: "0 * * * *",
    enabled: true,
    createdAt: new Date("2026-05-02T14:40:00").getTime(),
    lastRunAt: new Date("2026-05-18T07:00:00").getTime(),
  },
  {
    id: "demo-3",
    name: "Relance commerciale prospects dormants",
    input:
      "Identifier les prospects sans contact depuis 30 jours et préparer un email de relance personnalisé.",
    schedule: "0 9 * * 2",
    enabled: false,
    createdAt: new Date("2026-03-15T11:05:00").getTime(),
    lastRunAt: new Date("2026-05-13T09:00:00").getTime(),
    lastRunStatus: "awaiting_approval",
  },
  {
    id: "demo-4",
    name: "Rapport financier mensuel",
    input: "Compiler les indicateurs de revenus et générer le rapport pour la direction.",
    schedule: "manual",
    enabled: false,
    createdAt: new Date("2026-02-01T08:00:00").getTime(),
    lastRunAt: new Date("2026-05-01T18:30:00").getTime(),
    lastRunStatus: "success",
  },
  {
    id: "demo-5",
    name: "Modération des avis clients",
    input: "Analyser les nouveaux avis publics et signaler les contenus à risque.",
    schedule: "0 12 * * *",
    enabled: true,
    createdAt: new Date("2026-04-30T16:20:00").getTime(),
    lastRunAt: new Date("2026-05-17T12:00:00").getTime(),
    lastRunStatus: "failed",
    lastError: "Quota API dépassé",
  },
  {
    id: "demo-6",
    name: "Onboarding automatique nouveaux clients",
    input: "Envoyer la séquence de bienvenue et créer les accès dès la signature d'un contrat.",
    schedule: "0 10 * * *",
    enabled: true,
    createdAt: new Date("2026-05-10T10:00:00").getTime(),
  },
  {
    id: "demo-7",
    name: "Sauvegarde des exports analytics",
    input: "Exporter les données analytics de la semaine et les archiver sur Drive.",
    schedule: "0 23 * * 0",
    enabled: false,
    createdAt: new Date("2026-01-20T22:00:00").getTime(),
    lastRunAt: new Date("2026-05-11T23:00:00").getTime(),
    lastRunStatus: "blocked",
    lastError: "Espace de stockage insuffisant",
  },
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function humanCron(cron: string): string {
  if (!cron || cron === "manual") return "Manuel";
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [min, hour, , , dow] = parts;
  if (!min || !hour) return cron;
  if (dow === "*" && min !== "*" && hour !== "*")
    return `Quotidien à ${hour.padStart(2, "0")}h${min === "0" ? "" : min}`;
  if (min === "0" && hour === "*") return "Toutes les heures";
  if (min !== "*" && hour !== "*") return `À ${hour}h${min === "0" ? "" : min}`;
  return cron;
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy={true} className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-(--surface-2)" />
      ))}
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="t-9 font-mono uppercase self-start px-(--space-2) py-(--space-1) rounded-(--radius-sm) bg-(--surface-1) text-(--text-faint) tracking-[var(--tracking-badge)]">
      Démo · données fictives (dev)
    </span>
  );
}

function MissionListEmpty() {
  const setMode = useStageStore((s) => s.setMode);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
    >
      <EmptyState
        title="Aucune mission récurrente."
        description="Demande à l'agent d'en créer une — par exemple « résume mes emails chaque matin »."
        cta={{
          label: "Demander à l'agent",
          onClick: () => setMode({ mode: "chat" }),
        }}
        className="max-w-[var(--width-mission-empty-copy)] mx-auto"
      />
    </motion.div>
  );
}

function MissionCard({
  mission,
  index,
  onClick,
}: {
  mission: ApiMission;
  index: number;
  onClick: () => void;
}) {
  const label = missionStatusLabel(mission);
  const badge = badgeClass(mission);

  return (
    <motion.div
      custom={index}
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="px-5 py-4 rounded-xl bg-(--surface-2) hover:bg-(--surface-1) border border-(--line-strong) cursor-pointer transition-[background] duration-150 flex flex-col gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-teal)"
    >
      {/* Ligne principale : nom + badge */}
      <div className="flex items-center gap-3">
        <span className="t-15 font-medium text-(--text-soft) flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {mission.name}
        </span>

        {/* Badge statut — JS-computed colors kept in style */}
        <span
          className={`inline-flex items-center gap-1.5 t-11 px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}
        >
          {badge.pulse && (
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-(--accent-teal)/85 inline-block"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            />
          )}
          {label}
        </span>
      </div>

      {/* Input preview */}
      <p className="t-13 text-(--text-faint) leading-[var(--leading-body-tight)] overflow-hidden text-ellipsis whitespace-nowrap">
        {mission.input.slice(0, 120)}
      </p>

      {/* Meta : date + schedule */}
      <div className="flex items-center gap-4 t-11 text-(--text-decor-25)">
        <span>{formatDate(mission.createdAt)}</span>
        <span className="text-text-decor-25">·</span>
        <span>{humanCron(mission.schedule)}</span>
      </div>
    </motion.div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function MissionListStage({ mode }: { mode: string }) {
  const setMode = useStageStore((s) => s.setMode);

  const [missions, setMissions] = useState<ApiMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    const doFetch = async () => {
      try {
        const res = await fetch("/api/v2/missions", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { missions: ApiMission[] };
        if (!cancelled) setMissions(json.missions ?? []);
      } catch (err) {
        if (!cancelled) setFetchError(sanitizeApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void doFetch();
    return () => {
      cancelled = true;
    };
  }, []);

  // Démo dev-only : liste réelle vide + pas de chargement + pas d'erreur →
  // on rend le chemin plein avec des demandes fictives. Données réelles
  // prioritaires : dès qu'une demande réelle existe, la démo disparaît.
  const showDemo = IS_DEV && !loading && !fetchError && missions.length === 0;
  const displayMissions = missions.length > 0 ? missions : showDemo ? DEMO_MISSIONS : [];

  useEffect(() => {
    if (displayMissions.length === 0) {
      useStageData.getState().clearShellData();
      return;
    }
    useStageData.getState().setShellData(
      `Demandes (${displayMissions.length})`,
      displayMissions.slice(0, 5).map(
        (m): RailItem => ({
          t: m.name,
          s: missionStatusLabel(m),
          hot: m.enabled && !m.lastRunStatus,
        }),
      ),
    );
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [displayMissions]);

  function handleNewMission() {
    useStageStore
      .getState()
      .setCommandeurOpen(true, { prefilledQuery: "Créer une nouvelle demande" });
  }

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-8"
    >
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="t-13 text-(--text-ghost)">Toutes les demandes</p>
          <h1 className="t-30 font-medium tracking-tight text-(--text-soft)">Demandes</h1>
          {STAGE_REGISTRY.mission.tagline && (
            <p className="t-13 text-(--text-faint) leading-[var(--leading-body-tight)]">
              {STAGE_REGISTRY.mission.tagline}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleNewMission}
          className="px-4 py-2 rounded-lg bg-(--surface-2) hover:bg-(--surface-1) border border-(--line-strong) text-text-muted t-13 font-medium cursor-pointer transition-[background] duration-150"
        >
          Nouvelle demande
        </button>
      </header>

      {/* Badge démo — dev uniquement, liste réelle vide */}
      {showDemo && <DemoBadge />}

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Erreur */}
      {!loading && fetchError && <StageErrorBanner message={fetchError} variant="emphasis" />}

      {/* Empty state — prod, ou dev sans démo possible */}
      {!loading && !fetchError && missions.length === 0 && !showDemo && <MissionListEmpty />}

      {/* Liste (données réelles ou démo dev) */}
      {!loading && !fetchError && displayMissions.length > 0 && (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {displayMissions.map((mission, idx) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                index={idx}
                onClick={() => setMode({ mode: "mission", missionId: mission.id })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
}
