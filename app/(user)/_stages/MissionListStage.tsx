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

function badgeTokens(mission: ApiMission): {
  bg: string;
  border: string;
  color: string;
  pulse: boolean;
} {
  const isError = mission.lastRunStatus === "failed" || mission.lastRunStatus === "blocked";
  const isApproval = mission.lastRunStatus === "awaiting_approval";
  const isSuccess = mission.lastRunStatus === "success";
  const isRunning = mission.enabled && !mission.lastRunStatus;

  if (isError)
    return {
      bg: "var(--danger-surface-soft)",
      border: "1px solid var(--danger-border)",
      color: "var(--danger)",
      pulse: false,
    };
  if (isApproval)
    return {
      bg: "var(--gold-surface)",
      border: "1px solid var(--gold-border)",
      color: "var(--gold)",
      pulse: false,
    };
  if (isSuccess)
    return {
      bg: "var(--card-flat-bg)",
      border: "1px solid var(--line-strong)",
      color: "var(--text-faint)",
      pulse: false,
    };
  if (isRunning)
    return {
      bg: "var(--accent-teal-surface)",
      border: "1px solid var(--accent-teal-border)",
      color: "var(--accent-teal)",
      pulse: true,
    };
  return {
    bg: "var(--card-flat-bg)",
    border: "1px solid var(--line-strong)",
    color: "var(--text-l2)",
    pulse: false,
  };
}

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

function ErrorBanner({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      className="px-4.5 py-3.5 rounded-xl bg-(--danger)/8 border-l-2 border-(--danger)/55 text-(--danger)/85 t-13 leading-comfortable"
    >
      <strong className="text-(--danger)/95 font-semibold">Erreur</strong> — {error}
    </motion.div>
  );
}

function EmptyState() {
  const setMode = useStageStore((s) => s.setMode);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      className="flex flex-col items-center justify-center gap-(--space-5) py-20 text-center"
    >
      <p className="t-15 text-(--text-faint) max-w-prose-tight leading-relaxed">
        Aucune mission récurrente. Demande à l&apos;agent d&apos;en créer une — par exemple « résume
        mes emails chaque matin ».
      </p>
      <button
        type="button"
        onClick={() => setMode({ mode: "chat" })}
        className="cockpit-action max-w-cockpit-action"
      >
        <span className="ca-label">Demander à l&apos;agent</span>
      </button>
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
  const badge = badgeTokens(mission);

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
      className="px-5 py-4 rounded-xl bg-(--surface-2) hover:bg-white/7 border border-(--line-strong) cursor-pointer transition-[background] duration-base flex flex-col gap-2"
    >
      {/* Ligne principale : nom + badge */}
      <div className="flex items-center gap-3">
        <span className="t-15 font-medium text-(--text-soft) flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {mission.name}
        </span>

        {/* Badge statut — JS-computed colors kept in style */}
        <span
          className="inline-flex items-center gap-1 t-11 px-2.5 py-1 rounded-full shrink-0"
          style={{
            background: badge.bg,
            border: badge.border,
            color: badge.color,
          }}
        >
          {badge.pulse && (
            <motion.span
              className="size-1.5 rounded-full bg-(--accent-teal)/85 inline-block"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            />
          )}
          {label}
        </span>
      </div>

      {/* Input preview */}
      <p className="t-13 text-(--text-faint) leading-body-tight overflow-hidden text-ellipsis whitespace-nowrap">
        {mission.input.slice(0, 120)}
      </p>

      {/* Meta : date + schedule */}
      <div className="flex items-center gap-4 t-11 text-(--text-decor-25)">
        <span>{formatDate(mission.createdAt)}</span>
        <span className="text-(--text-l3)">·</span>
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

  useEffect(() => {
    if (missions.length === 0) {
      useStageData.getState().clearShellData();
      return;
    }
    useStageData.getState().setShellData(
      `Demandes (${missions.length})`,
      missions.slice(0, 5).map(
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
  }, [missions]);

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
            <p className="t-13 text-(--text-faint) leading-body-tight">
              {STAGE_REGISTRY.mission.tagline}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleNewMission}
          className="px-4 py-2 rounded-card bg-white/8 hover:bg-white/13 border border-white/12 text-(--text-muted) t-13 font-medium cursor-pointer transition-[background] duration-base"
        >
          Nouvelle demande
        </button>
      </header>

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Erreur */}
      {!loading && fetchError && <ErrorBanner error={fetchError} />}

      {/* Empty state */}
      {!loading && !fetchError && missions.length === 0 && <EmptyState />}

      {/* Liste */}
      {!loading && !fetchError && missions.length > 0 && (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {missions.map((mission, idx) => (
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
