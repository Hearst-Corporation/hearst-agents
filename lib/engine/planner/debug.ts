/**
 * Planner Debug / Observability — Silent by default.
 *
 * Enable: process.env.HEARST_PLANNER_DEBUG=1
 */

const debugEnabled =
  typeof process !== "undefined" && process.env.HEARST_PLANNER_DEBUG === "1";

export function logPlanEvent(
  event: string,
  detail?: Record<string, unknown>,
): void {
  if (!debugEnabled) return;
  console.log(`[Planner] ${event}`, detail ?? "");
}
