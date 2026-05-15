/**
 * Scheduled Mission types — recurring automations executed via the orchestrator.
 *
 * Server-side scheduled missions that run through the orchestrator.
 */

import { z } from "zod";

/**
 * Configuration d'export automatique pour une mission schedulée.
 * Quand enabled=true, un job `export_scheduled_report` est enqueué après
 * chaque run réussi de la mission.
 */
export const autoExportConfigSchema = z.object({
  enabled: z.boolean(),
  format: z.enum(["pdf", "excel"]),
  recipients: z
    .array(z.string().email("recipient doit être un email valide"))
    .min(1, "au moins un destinataire requis"),
  /** reportId cible — l'asset id du rapport à exporter. */
  reportId: z.string().uuid("reportId doit être un UUID valide"),
});

export type AutoExportConfig = z.infer<typeof autoExportConfigSchema>;

/**
 * Mode d'agrégation pour l'approbation collaborative (Q3-D).
 *
 * - "all"      → tous les approvers doivent voter "approved" (unanimité, défaut)
 * - "any"      → un seul "approved" suffit pour déclencher l'exécution
 * - "majority" → > 50% des approvers ont voté "approved"
 *
 * Un seul vote "rejected" bloque la session quel que soit le mode.
 */
export const approvalModeSchema = z.enum(["all", "any", "majority"]);
export type ApprovalMode = z.infer<typeof approvalModeSchema>;

/**
 * Configuration d'approbation collaborative pour une mission scheduled (Q3-D).
 * Quand `approvers.length > 0`, le scheduler crée une session d'approbation
 * (N emails signés HMAC) avant chaque tick et n'exécute le run qu'après
 * satisfaction de `mode`.
 */
export const approvalConfigSchema = z.object({
  approvers: z
    .array(z.string().email("approver doit être un email valide"))
    .min(1, "au moins un approbateur requis"),
  mode: approvalModeSchema.default("all"),
});

export type ApprovalConfig = z.infer<typeof approvalConfigSchema>;

export interface ScheduledMission {
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
  lastRunStatus?: "success" | "failed" | "blocked" | "awaiting_approval";
  lastError?: string;
  /** Export automatique optionnel — enqueué après chaque run réussi. */
  autoExport?: AutoExportConfig;
  /**
   * Workflow graph optionnel (Mission Control C3 Builder).
   * Quand présent, le run utilise `executeWorkflow` au lieu de l'orchestrator
   * standard. La forme correspond à WorkflowGraph (lib/workflows/types).
   */
  workflowGraph?: unknown;
  /**
   * Budget mensuel maximum en USD (S3-D). Quand défini, le scheduler hard-stop
   * la mission si la somme des `cost_usd` des runs du mois courant atteint ou
   * dépasse cette valeur. La fenêtre est calendaire (UTC), reset implicite le
   * 1er du mois. Valeur 0 ou négative ignorée.
   */
  budgetUsd?: number;
  /**
   * Approbation collaborative multi-acteur (Q3-D). Quand non vide, le
   * scheduler attend que les votes satisfont `approvalMode` avant
   * d'exécuter chaque run. Stocké dans `actions.approvers` JSONB.
   */
  approvers?: string[];
  /** Mode d'agrégation des votes (défaut "all" — unanimité). */
  approvalMode?: ApprovalMode;
}
