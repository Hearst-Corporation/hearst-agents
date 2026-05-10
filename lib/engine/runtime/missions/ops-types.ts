/**
 * Scheduler & Mission Operations types — runtime observability shapes.
 */

export type SchedulerMode = "leader" | "standby" | "local_fallback";

export interface SchedulerStatus {
  instanceId: string;
  isLeader: boolean;
  leaderInstanceId?: string | null;
  leadershipExpiresAt?: string | null;
  heartbeatAt?: number;
  mode: SchedulerMode;
}

export type MissionExecutionStatus =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "blocked"
  /** Q3-D — session d'approbation collaborative en cours. */
  | "awaiting_approval";

/**
 * Drift Alert (S3-E) — exposé côté UI via `MissionOpsRecord.drift`.
 * Présent uniquement quand N runs consécutifs sans changement significatif
 * ont été détectés. La présence de ce champ allume le badge gold "Drift"
 * dans MissionRow ; `suggestion` sert de tooltip et de body de notif.
 */
export interface MissionDriftState {
  staleRuns: number;
  suggestion: string;
  /** ISO timestamp du dernier changement détecté (avant la séquence stale). */
  lastChangeAt: string | null;
  /** Epoch ms — empêche le re-spam de notification tant que le drift persiste. */
  notifiedAt: number;
}

/**
 * État d'approbation collaborative (Q3-D) — exposé au cockpit pour
 * afficher le badge "En attente d'approbation — N/M votes" dans
 * MissionRow. Présent uniquement si une session pending existe.
 */
export interface MissionApprovalState {
  /** Mode d'agrégation : "all" | "any" | "majority". */
  mode: "all" | "any" | "majority";
  /** Nombre total d'approbateurs sollicités. */
  total: number;
  /** Nombre de votes "approved". */
  approved: number;
  /** Nombre de votes "rejected". */
  rejected: number;
  /** Nombre de votes "pending". */
  pending: number;
}

export interface MissionOpsRecord {
  missionId: string;
  name: string;
  tenantId: string;
  workspaceId: string;
  enabled: boolean;

  status: MissionExecutionStatus;
  lastRunAt?: number;
  lastRunId?: string;
  lastRunStatus?: "success" | "failed" | "blocked" | "awaiting_approval";
  lastError?: string;

  runningSince?: number;

  /** Présent quand un drift a été détecté (≥ minStaleRuns sans changement). */
  drift?: MissionDriftState;

  /**
   * Approbation collaborative (Q3-D) — présent quand des approvers ont
   * été configurés ET qu'une session est en cours. Allume un badge
   * gold "En attente d'approbation — N/M votes" dans MissionRow.
   */
  approval?: MissionApprovalState;
}
