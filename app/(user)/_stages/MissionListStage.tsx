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
import type { RailItem } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

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
      bg: "rgba(255,80,80,0.1)",
      border: "1px solid rgba(255,120,120,0.35)",
      color: "rgba(255,140,140,0.9)",
      pulse: false,
    };
  if (isApproval)
    return {
      bg: "rgba(212,175,55,0.1)",
      border: "1px solid rgba(212,175,55,0.35)",
      color: "rgba(212,175,55,0.9)",
      pulse: false,
    };
  if (isSuccess)
    return {
      bg: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "rgba(255,255,255,0.45)",
      pulse: false,
    };
  if (isRunning)
    return {
      bg: "rgba(94,229,195,0.1)",
      border: "1px solid rgba(94,229,195,0.3)",
      color: "rgba(94,229,195,0.85)",
      pulse: true,
    };
  return {
    bg: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)",
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
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-[14px]"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
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
      style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(255,80,80,0.08)",
        borderLeft: "2px solid rgba(255,120,120,0.55)",
        color: "rgba(255,200,200,0.85)",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur</strong> — {error}
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <p
        className="t-15"
        style={{
          color: "rgba(255,255,255,0.45)",
          maxWidth: "440px",
          lineHeight: 1.6,
        }}
      >
        Aucune demande. Demande à l&apos;agent d&apos;en créer une.
      </p>
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
  const [hovered, setHovered] = useState(false);
  const label = missionStatusLabel(mission);
  const badge = badgeTokens(mission);

  return (
    <motion.div
      custom={index}
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "16px 20px",
        borderRadius: "14px",
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer",
        transition: "background 0.15s ease",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* Ligne principale : nom + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.9)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {mission.name}
        </span>

        {/* Badge statut */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            padding: "3px 9px",
            borderRadius: "9999px",
            background: badge.bg,
            border: badge.border,
            color: badge.color,
            flexShrink: 0,
          }}
        >
          {badge.pulse && (
            <motion.span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "rgba(94,229,195,0.85)",
                display: "inline-block",
              }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            />
          )}
          {label}
        </span>
      </div>

      {/* Input preview */}
      <p
        style={{
          fontSize: "13px",
          color: "rgba(255,255,255,0.4)",
          lineHeight: 1.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {mission.input.slice(0, 120)}
      </p>

      {/* Meta : date + schedule */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "11px",
          color: "rgba(255,255,255,0.3)",
        }}
      >
        <span>{formatDate(mission.createdAt)}</span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,.35)" }}>Toutes les demandes</p>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 500,
              letterSpacing: "-.02em",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Demandes
          </h1>
        </div>

        <button
          type="button"
          onClick={handleNewMission}
          style={{
            padding: "8px 16px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.8)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.13)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
          }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
