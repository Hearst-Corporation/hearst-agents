"use client";

/**
 * MissionStage — consumer data-bound de la mission active.
 *
 * Lit `missionId` depuis `useStageStore`, fetche `/api/v2/missions/[id]`,
 * et pousse les 5 premières steps vers `useStageData.shellData` pour
 * alimenter le ContextRail.
 *
 * Pas de mockup : si pas de missionId → empty state explicite.
 * Source de vérité : store stage + API.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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

const STEP_VARIANTS = {
  hidden: { opacity: 0, x: -8 },
  visible: (idx: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: VISION_EASE, delay: idx * 0.04 },
  }),
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

type StepStatus = "done" | "running" | "error" | "requires_approval" | "pending";

interface MissionStep {
  id: string;
  name: string;
  status: StepStatus;
  desc?: string;
  time?: string;
}

/** Étiquette FR pour l'état d'un step. */
function stateLabel(status: StepStatus): string {
  switch (status) {
    case "done":
      return "Réussi";
    case "running":
      return "En cours";
    case "error":
      return "Échec";
    case "requires_approval":
      return "Approbation requise";
    case "pending":
    default:
      return "En attente";
  }
}

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

/** Dérive une liste de MissionStep depuis une ApiMission. */
function deriveSteps(mission: ApiMission): MissionStep[] {
  const runStatusToStep: StepStatus =
    mission.lastRunStatus === "success"
      ? "done"
      : mission.lastRunStatus === "failed"
        ? "error"
        : mission.lastRunStatus === "blocked"
          ? "error"
          : mission.lastRunStatus === "awaiting_approval"
            ? "requires_approval"
            : mission.enabled
              ? "running"
              : "pending";

  return [
    {
      id: "step-created",
      name: "Mission créée",
      status: "done",
      desc: mission.input.slice(0, 120),
      time: new Date(mission.createdAt).toLocaleDateString("fr-FR"),
    },
    {
      id: `step-run-${mission.id}`,
      name: "Dernière exécution",
      status: runStatusToStep,
      desc:
        mission.lastRunStatus === "failed"
          ? `Échec — ${mission.lastError ?? "erreur inconnue"}`
          : mission.lastRunStatus === "success"
            ? "Exécution réussie"
            : mission.lastRunStatus === "awaiting_approval"
              ? "En attente d'approbation"
              : mission.lastRunAt
                ? `Exécuté le ${new Date(mission.lastRunAt).toLocaleDateString("fr-FR")}`
                : "Jamais exécutée",
      time: mission.lastRunAt
        ? new Date(mission.lastRunAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
    },
    {
      id: "step-next",
      name: "Prochaine exécution",
      status: "pending",
      desc: `Schedule : ${humanCron(mission.schedule)}`,
      time: "—",
    },
  ];
}

function humanCron(cron: string): string {
  if (!cron || cron === "manual") return "manuel";
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [min, hour, , , dow] = parts;
  if (dow === "*" && min !== "*" && hour !== "*")
    return `Tous les jours à ${hour.padStart(2, "0")}h${min === "0" ? "" : min}`;
  if (min === "0" && hour === "*") return "Toutes les heures";
  if (min !== "*" && hour !== "*") return `À ${hour}h${min === "0" ? "" : min}`;
  return cron;
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function EmptyMissionState() {
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
        Sélectionne une mission depuis la liste ou lance une commande.
      </p>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
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

function MissionHeader({ mission }: { mission: ApiMission }) {
  const status = missionStatusLabel(mission);
  const isRunning = mission.enabled && !mission.lastRunStatus;
  const isError = mission.lastRunStatus === "failed" || mission.lastRunStatus === "blocked";
  const isApproval = mission.lastRunStatus === "awaiting_approval";

  const badgeBg = isError
    ? "rgba(255,80,80,0.1)"
    : isApproval
      ? "rgba(212,175,55,0.1)"
      : isRunning
        ? "rgba(94,229,195,0.1)"
        : "rgba(255,255,255,0.06)";
  const badgeBorder = isError
    ? "1px solid rgba(255,120,120,0.35)"
    : isApproval
      ? "1px solid rgba(212,175,55,0.35)"
      : isRunning
        ? "1px solid rgba(94,229,195,0.3)"
        : "1px solid rgba(255,255,255,0.1)";
  const badgeColor = isError
    ? "rgba(255,140,140,0.9)"
    : isApproval
      ? "rgba(212,175,55,0.9)"
      : isRunning
        ? "rgba(94,229,195,0.85)"
        : "rgba(255,255,255,0.45)";

  return (
    <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,.35)",
        }}
      >
        Mission active
      </p>
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 500,
          letterSpacing: "-.02em",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        {mission.name}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            padding: "3px 9px",
            borderRadius: "9999px",
            background: badgeBg,
            border: badgeBorder,
            color: badgeColor,
          }}
        >
          {isRunning && (
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
          {status}
        </span>
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,.5)" }}>
        {mission.input.slice(0, 120)}
      </p>
    </header>
  );
}

function ApprovalBar({
  stepId,
  missionId,
  onApproved,
}: {
  stepId: string;
  missionId: string;
  onApproved: () => void;
}) {
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`/api/v2/missions/${missionId}/approve-step`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      onApproved();
    } catch {
      // fail-soft
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="approval-bar">
      <div className="approval-bar-t">Action write — gate approbation requis avant envoi.</div>
      <button className="vision-btn-primary appr-btn" disabled={approving} onClick={handleApprove}>
        {approving ? "Approbation…" : "Approuver tout"}
      </button>
      <button className="appr-btn ghost">Relire un par un</button>
    </div>
  );
}

function StepRow({
  step,
  index,
  missionId,
  onApproved,
}: {
  step: MissionStep;
  index: number;
  missionId: string;
  onApproved: () => void;
}) {
  const isDone = step.status === "done";
  const isRunning = step.status === "running";
  const isError = step.status === "error";
  const isApproval = step.status === "requires_approval";
  const isPending = step.status === "pending";

  const nodeClass = isDone
    ? "mtl-node done"
    : isApproval
      ? "mtl-node gold"
      : isRunning
        ? "mtl-node active"
        : isError
          ? "mtl-node error"
          : "mtl-node";

  const rowClass = isDone
    ? "mtl-row done vis"
    : isApproval
      ? "mtl-row approval vis"
      : isRunning
        ? "mtl-row active vis"
        : isError
          ? "mtl-row error vis"
          : "mtl-row pend";

  return (
    <motion.div
      custom={index}
      variants={STEP_VARIANTS}
      initial="hidden"
      animate="visible"
      className={rowClass}
      style={{ opacity: isPending ? 0.35 : 1 }}
    >
      <div className={nodeClass}>{isDone ? "✓" : isApproval ? "!" : isError ? "✕" : index + 1}</div>
      <div className="mtl-c">
        <div className="mtl-t">{step.name}</div>
        {step.desc && <div className="mtl-d">{step.desc}</div>}
        {isApproval && (
          <ApprovalBar stepId={step.id} missionId={missionId} onApproved={onApproved} />
        )}
      </div>
      <span className="mtl-time">{step.time ?? "—"}</span>
    </motion.div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function MissionStage({ mode }: { mode: string }) {
  const missionId = useStageStore((s) =>
    s.current.mode === "mission" ? s.current.missionId : null,
  );

  const [mission, setMission] = useState<ApiMission | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch mission quand missionId change
  useEffect(() => {
    if (!missionId) {
      setMission(null);
      setLoading(false);
      setFetchError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    const doFetch = async () => {
      try {
        const res = await fetch(`/api/v2/missions/${missionId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { mission: ApiMission };
        if (!cancelled) setMission(json.mission ?? null);
      } catch (err) {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void doFetch();
    return () => {
      cancelled = true;
    };
  }, [missionId, refreshKey]);

  const steps = mission ? deriveSteps(mission) : [];

  // Pousse les 5 premières steps dans shellData → ContextRail miroir
  useEffect(() => {
    if (!mission) {
      useStageData.getState().clearShellData();
      return;
    }
    const items: RailItem[] = steps.slice(0, 5).map((s) => ({
      t: s.name,
      s: stateLabel(s.status),
      hot: s.status === "running",
    }));
    useStageData.getState().setShellData(`Mission · ${mission.name}`, items);
    return () => {
      useStageData.getState().clearShellData();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length, mission?.id, mission?.lastRunStatus]);

  function handleApproved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Empty state — pas de missionId */}
      {!missionId && !loading && <EmptyMissionState />}

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Erreur fetch */}
      {!loading && fetchError && <ErrorBanner error={fetchError} />}

      {/* Contenu mission */}
      {!loading && !fetchError && mission && (
        <>
          <MissionHeader mission={mission} />

          {/* Timeline */}
          <div className="mtl">
            <AnimatePresence initial={false}>
              {steps.map((step, idx) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={idx}
                  missionId={mission.id}
                  onApproved={handleApproved}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.section>
  );
}
