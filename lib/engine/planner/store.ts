/**
 * Planner Store — In-memory persistence for ExecutionPlans and MissionDefinitions.
 *
 * Dev implementation. Production: swap with Supabase/DB adapter
 * using the same interface.
 */

import type { ExecutionPlan, MissionDefinition } from "./types";

// ── In-memory plan store ────────────────────────────────────

const plans = new Map<string, ExecutionPlan>();
const plansByThread = new Map<string, Set<string>>();

export function savePlan(plan: ExecutionPlan): void {
  plans.set(plan.id, plan);
  let threadSet = plansByThread.get(plan.threadId);
  if (!threadSet) {
    threadSet = new Set();
    plansByThread.set(plan.threadId, threadSet);
  }
  threadSet.add(plan.id);
}

export function getPlan(planId: string): ExecutionPlan | null {
  return plans.get(planId) ?? null;
}

export function getPlansForThread(threadId: string): ExecutionPlan[] {
  const ids = plansByThread.get(threadId);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => plans.get(id))
    .filter((p): p is ExecutionPlan => p !== undefined);
}

export function getAllPlans(): ExecutionPlan[] {
  return Array.from(plans.values());
}

// ── In-memory mission store ─────────────────────────────────

const missions = new Map<string, MissionDefinition>();
const missionsByThread = new Map<string, Set<string>>();

export function saveMission(mission: MissionDefinition): void {
  missions.set(mission.id, mission);
  let threadSet = missionsByThread.get(mission.threadId);
  if (!threadSet) {
    threadSet = new Set();
    missionsByThread.set(mission.threadId, threadSet);
  }
  threadSet.add(mission.id);
}

export function getMission(missionId: string): MissionDefinition | null {
  return missions.get(missionId) ?? null;
}

export function getMissionsForThread(threadId: string): MissionDefinition[] {
  const ids = missionsByThread.get(threadId);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => missions.get(id))
    .filter((m): m is MissionDefinition => m !== undefined);
}

export function getActiveMissions(): MissionDefinition[] {
  return Array.from(missions.values()).filter((m) => m.status === "active");
}

export function getDueMissions(now: number): MissionDefinition[] {
  return Array.from(missions.values()).filter(
    (m) => m.status === "active" && m.nextRunAt !== undefined && m.nextRunAt <= now,
  );
}

/** Wipe every plan and planner-mission from memory. Server-only cleanup. */
export function clearAllPlannerStores(): void {
  plans.clear();
  plansByThread.clear();
  missions.clear();
  missionsByThread.clear();
}
