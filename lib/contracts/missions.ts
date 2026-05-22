/**
 * Schémas zod canoniques pour les routes `/api/v2/missions/*`.
 *
 * Centralise la validation des payloads CRUD + lifecycle (run/pause/resume)
 * des missions afin que les routes API et les éventuels callers internes
 * partagent une seule source de vérité. Les contraintes reflètent les
 * invariants verrouillés de `docs/features/missions.md` :
 *  - I-2 : `windowKey` UTC minute-precision (cron parser strict cf I-6)
 *  - I-9 : hard-delete (DELETE traité ailleurs, pas de body)
 *  - I-11 : status `success | failed | blocked` géré côté backend
 *  - I-17 : ownership check fait par requireScope, pas via le payload
 *  - I-18 : mission ID = UUID v4 généré côté serveur (jamais via body)
 *
 * Côté lifecycle (run/pause/resume) le body est volontairement vide ou
 * minimal — l'identité de la mission vient du path param `[id]`.
 */

import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Email simple — cohérent avec la regex utilisée dans la route
 * `POST /api/v2/missions` (Q3-D approbation collaborative).
 */
const emailSchema = z
  .string()
  .min(3)
  .max(320)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

const approvalModeSchema = z.enum(["all", "any", "majority"]);

const frequencySchema = z.enum(["daily", "weekly", "monthly", "custom"]);

/**
 * `WorkflowGraph` côté HTTP : on tolère un objet structurel (validé
 * sémantiquement par `validateGraph()` côté route). Le but ici est juste
 * d'éviter les payloads non-objet.
 */
const workflowGraphLooseSchema = z
  .object({
    startNodeId: z.string().optional(),
    nodes: z.array(z.unknown()).optional(),
    edges: z.array(z.unknown()).optional(),
  })
  .passthrough();

// ── POST /api/v2/missions — création ─────────────────────────

/**
 * Création d'une mission. Deux cas :
 *  - branch legacy : `input` + `schedule` requis
 *  - branch C3 : `workflowGraph` fourni → `input`/`schedule` peuvent être
 *    dérivés côté route (cf logique existante). On garde donc `input` et
 *    `schedule` optionnels au niveau zod ; la route fait la vérif finale.
 */
export const createMissionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  input: z.string().min(1).max(10_000).optional(),
  schedule: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  workflowGraph: workflowGraphLooseSchema.optional(),
  approvers: z.array(emailSchema).max(50).optional(),
  approvalMode: approvalModeSchema.optional(),
});

// ── PATCH /api/v2/missions — bulk toggle ────────────────────

/**
 * Toggle bulk d'un seul mission via PATCH /api/v2/missions
 * (différent de PATCH /api/v2/missions/[id]).
 */
export const toggleMissionSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

// ── PATCH /api/v2/missions/[id] — update ────────────────────

/**
 * Update d'une mission existante. Tous les champs sont optionnels —
 * la route applique partiellement. `prompt` est l'alias UI de `input`
 * (cohérent avec le code existant). `budgetUsd` accepte `null` pour
 * effacer la valeur.
 */
export const updateMissionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  prompt: z.string().min(1).max(10_000).optional(),
  frequency: frequencySchema.optional(),
  customCron: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  budgetUsd: z.number().finite().min(0).max(100_000).nullable().optional(),
  approvers: z.array(emailSchema).max(50).nullable().optional(),
  approvalMode: approvalModeSchema.optional(),
});

// ── POST /api/v2/missions/[id]/run — exécution manuelle ─────

/**
 * Aucun body attendu côté `/run`. On accepte un objet vide pour
 * compatibilité avec les fetchs qui sérialisent `{}` par défaut.
 */
export const runMissionSchema = z.object({}).strict();

// ── POST /api/v2/missions/[id]/pause ────────────────────────

export const pauseMissionSchema = z.object({}).strict();

// ── POST /api/v2/missions/[id]/resume ───────────────────────

export const resumeMissionSchema = z.object({}).strict();
