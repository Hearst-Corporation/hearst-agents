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
  | "blocked";

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

export interface MissionOpsRecord {
  missionId: string;
  name: string;
  tenantId: string;
  workspaceId: string;
  enabled: boolean;

  status: MissionExecutionStatus;
  lastRunAt?: number;
  lastRunId?: string;
  lastRunStatus?: "success" | "failed" | "blocked";
  lastError?: string;

  runningSince?: number;

  /** Présent quand un drift a été détecté (≥ minStaleRuns sans changement). */
  drift?: MissionDriftState;
}
