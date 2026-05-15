/**
 * Mission Engine V2 — Activates and manages recurring/monitoring missions.
 *
 * A mission is born from an approved ExecutionPlan of type "mission" or "monitoring".
 * It lives beyond a single thread conversation and executes on schedule or condition.
 *
 * Lifecycle:
 * - chat intent → planner → ExecutionPlan(type=mission) → approval → MissionDefinition
 * - MissionDefinition: draft → active → paused/completed
 * - Active missions: scheduler checks getDueMissions() and runs them
 *
 * This module does NOT contain scheduling logic (that's in lib/engine/runtime/missions/scheduler.ts).
 * It provides the mission lifecycle management layer above it.
 */

import { logPlanEvent } from "./debug";
import { getActiveMissions, getDueMissions, getMission, saveMission } from "./store";
import type { MissionDefinition } from "./types";

// ── Lifecycle transitions ───────────────────────────────────

export function pauseMission(missionId: string): MissionDefinition | null {
  const mission = getMission(missionId);
  if (!mission || mission.status !== "active") return null;

  mission.status = "paused";
  mission.updatedAt = Date.now();
  saveMission(mission);
  logPlanEvent("mission_paused", { missionId });

  return mission;
}

export function resumeMission(missionId: string): MissionDefinition | null {
  const mission = getMission(missionId);
  if (!mission || mission.status !== "paused") return null;

  mission.status = "active";
  mission.updatedAt = Date.now();

  if (mission.schedule) {
    mission.nextRunAt = computeNextRun(mission.schedule, Date.now());
  }

  saveMission(mission);
  logPlanEvent("mission_resumed", { missionId });

  return mission;
}

// ── Query helpers ───────────────────────────────────────────

export { getActiveMissions, getDueMissions };

// ── Schedule parsing (basic — production should use cron) ───

const SCHEDULE_INTERVALS: Record<string, number> = {
  "every minute": 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  "chaque heure": 60 * 60 * 1000,
  "tous les jours": 24 * 60 * 60 * 1000,
  "chaque jour": 24 * 60 * 60 * 1000,
  "chaque semaine": 7 * 24 * 60 * 60 * 1000,
  "toutes les heures": 60 * 60 * 1000,
};

function computeNextRun(schedule: string, from: number): number {
  const lower = schedule.toLowerCase().trim();
  const interval = SCHEDULE_INTERVALS[lower];
  if (interval) return from + interval;

  // Fallback: daily
  return from + 24 * 60 * 60 * 1000;
}
