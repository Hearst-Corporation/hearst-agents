"use client";

/**
 * <MissionRow> — rendu d'une rangée mission dans /missions.
 *
 * Extrait depuis missions/page.tsx (524 lignes → 350) pour rendre la page
 * lisible et permettre la mémoisation par mission. Le composant est
 * stateless ; tous les callbacks viennent du parent.
 */

import { GhostIconPencil, GhostIconPlay, GhostIconTrash } from "../ghost-icons";

export type MissionOpsStatus =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "blocked"
  /** Q3-D — session d'approbation collaborative en cours. */
  | "awaiting_approval";

/**
 * Drift Alert (S3-E) — payload propagé depuis l'ops-store côté server.
 * Présent uniquement si la mission a tourné ≥ 3 fois sans changement
 * significatif d'output. Allume un badge gold + tooltip dans la rangée.
 */
export interface MissionDriftPayload {
  staleRuns: number;
  suggestion: string;
}

/**
 * Approbation collaborative (Q3-D) — payload propagé depuis ops-store.
 * Présent uniquement si la mission a des approvers et qu'une session
 * est active. Allume un badge gold "En attente d'approbation — N/M votes".
 */
export interface MissionApprovalPayload {
  mode: "all" | "any" | "majority";
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface Mission {
  id: string;
  name: string;
  /** Absent du payload API — champ optionnel pour ne pas casser l'affichage. */
  description?: string;
  /** Absent du payload API — dérivé de `enabled` + `lastRunStatus` côté page. */
  status?: "active" | "paused" | "error";
  lastRun?: string;
  nextRun?: string;
  /** Absent du payload API — copié depuis `schedule` (cron string). */
  frequency?: string;
  enabled: boolean;
  input?: string;
  schedule?: string;
  lastRunAt?: number;
  lastRunStatus?: "success" | "failed" | "blocked" | "awaiting_approval";
  opsStatus?: MissionOpsStatus;
  lastError?: string;
  runningSince?: number;
  drift?: MissionDriftPayload;
  approval?: MissionApprovalPayload;
  /** Q3-D — config persistée des approbateurs (sert à pré-remplir l'éditeur). */
  approvers?: string[];
  /** Q3-D — mode d'agrégation des votes. */
  approvalMode?: "all" | "any" | "majority";
}

interface MissionRowProps {
  mission: Mission;
  currentTime: number;
  onToggle: (mission: Mission) => void;
  onOpen: (mission: Mission) => void;
  onEdit: (mission: Mission) => void;
  onRunNow: (missionId: string) => void;
  onDelete: (mission: Mission) => void;
}

const STATUS_LINE: Record<MissionOpsStatus, string> = {
  running: "border-(--accent-teal) text-(--accent-teal)",
  success: "border-[var(--money)] text-(--money)",
  failed: "border-(--danger) text-(--danger)",
  blocked: "border-(--warn) text-(--warn)",
  awaiting_approval: "border-(--gold) text-(--gold)",
  idle: "border-(--line-strong) text-text-muted",
};

const STATUS_LABEL: Record<MissionOpsStatus, string> = {
  running: "En cours",
  success: "Réussi",
  failed: "Échec",
  blocked: "Bloqué",
  awaiting_approval: "En attente d'approbation",
  idle: "En pause",
};

export function MissionRow({
  mission,
  currentTime,
  onToggle,
  onOpen,
  onEdit,
  onRunNow,
  onDelete,
}: MissionRowProps) {
  const ops: MissionOpsStatus = mission.opsStatus ?? "idle";

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 items-start py-6 border-b border-(--border-soft) px-2 group transition-colors"
    >
      <div className="min-w-0 flex gap-4">
        <button
          type="button"
          onClick={() => onToggle(mission)}
          className={`w-2 h-2 rounded-pill mt-1 shrink-0 transition-colors ${
            mission.enabled ? "bg-[var(--money)]" : "bg-[var(--text-faint)]"
          }`}
          title={mission.enabled ? "Désactiver" : "Activer"}
          aria-label={mission.enabled ? "Désactiver" : "Activer"}
        />
        <button
          type="button"
          onClick={() => onOpen(mission)}
          className="min-w-0 text-left group/open cursor-pointer"
          title={`Open ${mission.name}`}
        >
          <p className="t-9 font-light text-text-faint mb-1">
            Réf {mission.id.slice(0, 8)}
          </p>
          <h3 className="t-13 font-medium text-text tracking-tight group-hover/open:text-(--accent-teal) transition-colors">
            {mission.name}
          </h3>
          {(mission.description ?? mission.input) && (
            <p className="t-11 font-light leading-relaxed text-text-muted mt-1">
              {mission.description ?? mission.input}
            </p>
          )}
          {mission.lastError && (
            <p
              className="t-10 font-mono text-(--danger) truncate mt-2 border-b border-(--danger) pb-0.5 inline-block max-w-full"
              title={mission.lastError}
            >
              Erreur : {mission.lastError}
            </p>
          )}
        </button>
      </div>
      <div className="text-right space-y-2">
        {mission.drift && (
          <button
            type="button"
            onClick={() => onOpen(mission)}
            className="block ml-auto t-9 font-medium border-b border-(--gold) text-(--gold) pb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
            title={mission.drift.suggestion}
          >
            Drift · {mission.drift.staleRuns} runs
          </button>
        )}
        {mission.approval && (
          <button
            type="button"
            onClick={() => onOpen(mission)}
            className="block ml-auto t-9 font-medium border-b border-(--gold) text-(--gold) pb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
            title={`Mode ${mission.approval.mode} · ${mission.approval.approved} approuvé(s) · ${mission.approval.pending} en attente${mission.approval.rejected > 0 ? ` · ${mission.approval.rejected} rejeté(s)` : ""}`}
          >
            En attente d&apos;approbation · {mission.approval.approved}/{mission.approval.total} votes
          </button>
        )}
        <span className={`inline-block t-9 font-medium border-b pb-0.5 ${STATUS_LINE[ops]}`}>
          {STATUS_LABEL[ops]}
        </span>
        <div className="t-10 font-mono tabular-nums text-text-faint space-y-1">
          {(mission.frequency ?? mission.schedule) && (
            <div>{mission.frequency ?? mission.schedule}</div>
          )}
          {mission.runningSince && (
            <div className="text-(--accent-teal)">
              {Math.floor((currentTime - mission.runningSince) / 1000)} s
            </div>
          )}
          {mission.nextRun && (
            <div>Prochain {new Date(mission.nextRun).toLocaleDateString()}</div>
          )}
        </div>
      </div>
      <div className="flex items-start justify-end gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => onRunNow(mission.id)}
          disabled={ops === "running"}
          className="p-2 text-text-faint hover:text-(--accent-teal) transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Exécuter maintenant"
        >
          <GhostIconPlay className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(mission)}
          className="p-2 text-text-faint hover:text-text transition-colors"
          title="Modifier"
        >
          <GhostIconPencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(mission)}
          className="p-2 text-text-faint hover:text-(--danger) transition-colors"
          title="Supprimer"
        >
          <GhostIconTrash className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
