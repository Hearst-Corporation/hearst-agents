/**
 * Mission Ops Store — in-memory runtime status for observability.
 *
 * Tracks current execution state of each mission so APIs and UI
 * can show running / success / failed / blocked without polling the DB.
 * Does not replace persistence — this is ephemeral per-process state.
 */

import type { MissionExecutionStatus, MissionDriftState } from "./ops-types";

interface OpsEntry {
  status: MissionExecutionStatus;
  lastRunStatus?: "success" | "failed" | "blocked";
  lastRunAt?: number;
  lastRunId?: string;
  lastError?: string;
  runningSince?: number;
  /**
   * État Drift Alert (S3-E) — présent si N runs consécutifs sans changement.
   * Effacé automatiquement quand un nouveau delta significatif est détecté.
   */
  drift?: MissionDriftState;
}

const store = new Map<string, OpsEntry>();

export function setMissionRunning(missionId: string): void {
  const existing = store.get(missionId);
  store.set(missionId, {
    ...existing,
    status: "running",
    runningSince: Date.now(),
    lastError: existing?.lastError,
    lastRunStatus: existing?.lastRunStatus,
    lastRunAt: existing?.lastRunAt,
    lastRunId: existing?.lastRunId,
  });
}

export function setMissionResult(
  missionId: string,
  result: { status: "success" | "failed" | "blocked"; runId?: string; error?: string },
): void {
  const previous = store.get(missionId);
  store.set(missionId, {
    status: result.status === "success" ? "success" : result.status,
    lastRunStatus: result.status,
    lastRunAt: Date.now(),
    lastRunId: result.runId,
    lastError: result.error,
    runningSince: undefined,
    // Drift est porté par `setMissionDrift` / `clearMissionDrift` après le
    // post-run hook ; on conserve la valeur précédente le temps que le hook
    // se rejoue, sinon le badge clignote à chaque tick.
    drift: previous?.drift,
  });
}

/**
 * Marque un drift détecté (S3-E). Stocke la suggestion FR + meta pour la
 * notification. `notifiedAt` permet d'empêcher le re-spam à chaque run :
 * tant que le drift persiste sans nouveau delta franc, on ne renotifie pas.
 */
export function setMissionDrift(missionId: string, drift: MissionDriftState): void {
  const existing = store.get(missionId);
  if (!existing) {
    store.set(missionId, { status: "idle", drift });
    return;
  }
  store.set(missionId, { ...existing, drift });
}

/** Efface le drift lorsque la mission a bougé. Idempotent. */
export function clearMissionDrift(missionId: string): void {
  const existing = store.get(missionId);
  if (!existing || !existing.drift) return;
  const next: OpsEntry = { ...existing };
  delete next.drift;
  store.set(missionId, next);
}

export function getMissionDrift(missionId: string): MissionDriftState | undefined {
  return store.get(missionId)?.drift;
}

export function getAllMissionOps(): Map<string, OpsEntry> {
  return store;
}
