/**
 * Runtime State — Persistence types.
 *
 * Canonical types for Supabase-backed run and mission records.
 * These mirror RunRecord / ScheduledMission but are DB-oriented.
 */

export type PersistedRunStatus = "running" | "completed" | "failed" | "awaiting_approval" | "awaiting_clarification";

export interface PersistedRunRecord {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  input: string;
  surface?: string;
  executionMode?: string;
  agentId?: string;
  backend?: string;
  missionId?: string;
  status: PersistedRunStatus;
  createdAt: number;
  completedAt?: number;
  assets: Array<{ id: string; name: string; type: string }>;
  /** Runtime metrics — tokens, cost, latency */
  metrics?: {
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    latencyMs?: number;
  };
  /** Additional metadata for the run */
  metadata?: Record<string, unknown>;
}

export type PersistedMissionRunStatus =
  | "success"
  | "failed"
  | "blocked"
  | "awaiting_approval";

export interface PersistedScheduledMission {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  name: string;
  input: string;
  schedule: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastRunId?: string;
  lastRunStatus?: PersistedMissionRunStatus;
  lastError?: string;
  /**
   * Graphe de workflow optionnel (Mission Control C3). Quand non-null,
   * `mission/[id]/run` route vers `executeWorkflow` au lieu de l'orchestrator
   * standard. Stocké dans `actions.workflowGraph` JSONB côté Supabase.
   */
  workflowGraph?: import("@/lib/workflows/types").WorkflowGraph;
  /**
   * Mission Memory (vague 9) — résumé éditorial actualisé après chaque run.
   * 4 sections : Objectif / État actuel / Décisions actées / Prochaine étape.
   * Stocké dans `actions.contextSummary` JSONB. Ré-injecté dans le prompt
   * système au run suivant pour transformer la mission en compagnon long-terme.
   */
  contextSummary?: string | null;
  /** Timestamp epoch ms de la dernière mise à jour du contextSummary. */
  contextSummaryUpdatedAt?: number;
  /**
   * Budget mensuel max USD (S3-D). Stocké dans `actions.budgetUsd` JSONB.
   * Hard-stop côté scheduler quand le cumul du mois courant atteint ou
   * dépasse cette valeur.
   */
  budgetUsd?: number;
  /**
   * Approbation collaborative multi-acteur (Q3-D). Liste d'emails
   * approbateurs. Stocké dans `actions.approvers` JSONB.
   */
  approvers?: string[];
  /**
   * Mode d'agrégation des votes (Q3-D) : "all" | "any" | "majority".
   * Stocké dans `actions.approvalMode` JSONB.
   */
  approvalMode?: "all" | "any" | "majority";
}
