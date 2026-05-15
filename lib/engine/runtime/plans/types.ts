/**
 * Plan types — Database layer for cognitive plans.
 *
 * Types for the plans/plan_steps tables (not to be confused with planner/types.ts
 * which is for ExecutionPlan runtime model).
 */

// ── Plan Status ───────────────────────────────────────────

export type PlanStatus = "active" | "completed" | "abandoned";

export type PlanStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// ── Plan ───────────────────────────────────────────────────

export interface Plan {
  id: string;
  run_id: string;
  reasoning: string;
  status: PlanStatus;
  steps: PlanStep[];
  created_at: string;
}

// ── Plan Step ─────────────────────────────────────────────

export interface PlanStep {
  id: string;
  plan_id: string;
  order: number;
  intent: string;
  agent: string;
  task_description: string;
  expected_output: string;
  retrieval_mode?: string;
  depends_on: string[];
  optional: boolean;
  status: PlanStepStatus;
  run_step_id: string | null;
  completed_at: string | null;
  created_at?: string;
}
