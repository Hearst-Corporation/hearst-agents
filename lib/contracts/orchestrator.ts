/**
 * Schémas zod canoniques pour les routes `/api/orchestrator/*`.
 *
 * Centralise la validation des payloads admin qui déclenchent un run
 * orchestrator (master) — protège contre les inputs malformés avant
 * propagation dans `startRun()`.
 */

import { z } from "zod";
import { type AgentId, ALL_AGENTS } from "@/lib/hom/types";

const agentIdSchema = z.enum(ALL_AGENTS as [AgentId, ...AgentId[]]);

export const startRunSchema = z.object({
  /**
   * Liste d'agents à exécuter dans ce run. Optionnelle : défaut =
   * `ALL_AGENTS`. Les valeurs hors enum sont rejetées plutôt que
   * silencieusement filtrées.
   */
  scope: z.array(agentIdSchema).optional(),
  /** Note libre attachée au run (audit trail). */
  notes: z.string().max(2000).optional(),
});
