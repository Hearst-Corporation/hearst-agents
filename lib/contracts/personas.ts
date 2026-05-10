/**
 * Schémas zod canoniques pour les routes `/api/v2/personas/*`.
 *
 * Centralise la validation des payloads de gestion des personas (variantes
 * de voix appliquées à l'orchestrator) afin que les routes API partagent
 * une seule source de vérité. Les contraintes reflètent les invariants
 * verrouillés de `docs/features/personas.md` :
 *  - I-1 : builtins préfixés `builtin:` immutables (enforcement côté route)
 *  - I-3 : `systemPromptAddon` max 1500 chars (budget cache Anthropic)
 *  - I-7 : `PersonaTone` enum closed → `formal | casual | analytical | creative | direct`
 *  - I-8 : `vocabulary.preferred` et `.avoid` max 12 items chacun
 *  - I-10 : UNIQUE (user_id, tenant_id, name) — violation = 409 (côté store)
 *
 * Les caps de longueur reproduisent les `slice(0, N)` historiques côté
 * routes (`name` 80, `description` 280, `styleGuide` 2000, `addon` 1500)
 * pour préserver la compatibilité avec le store Supabase existant.
 */

import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────

/** I-7 : enum closed — voir `lib/personas/types.ts#PERSONA_TONES`. */
const personaToneSchema = z.enum([
  "formal",
  "casual",
  "analytical",
  "creative",
  "direct",
]);

/** Surface canonique d'application automatique (cf I-4). */
const personaSurfaceSchema = z.enum([
  "chat",
  "inbox",
  "simulation",
  "voice",
  "cockpit",
]);

/**
 * I-8 : vocabulaire préféré/évité capé à 12 items chacun. Chaque entrée
 * est trim/cap à 80 chars pour éviter les payloads abusifs.
 */
const personaVocabularySchema = z
  .object({
    preferred: z.array(z.string().min(1).max(80)).max(12).optional(),
    avoid: z.array(z.string().min(1).max(80)).max(12).optional(),
  })
  .strict();

// ── POST /api/v2/personas — création ─────────────────────────

/**
 * Création d'une persona custom. `userId` / `tenantId` viennent de
 * `requireScope` côté route — jamais via le payload (cf I-17 missions,
 * pattern identique ici).
 */
export const createPersonaSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  tone: personaToneSchema.nullable().optional(),
  vocabulary: personaVocabularySchema.nullable().optional(),
  styleGuide: z.string().max(2000).nullable().optional(),
  /** I-3 : cap strict 1500 chars (budget cache Anthropic). */
  systemPromptAddon: z.string().max(1500).nullable().optional(),
  surface: personaSurfaceSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
});

export type CreatePersonaPayload = z.infer<typeof createPersonaSchema>;

// ── PATCH /api/v2/personas/[id] — mise à jour partielle ──────

/**
 * Update partiel d'une persona existante. Tous les champs sont optionnels.
 * Les valeurs `null` permettent d'effacer (tone, vocabulary, styleGuide,
 * addon, surface). Le `id` vient du path param, pas du body.
 *
 * Note : les builtins (id préfixé `builtin:`) sont rejetés côté route avec
 * un 400 `builtin_immutable` (I-1), pas via zod.
 */
export const updatePersonaSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(280).optional(),
  tone: personaToneSchema.nullable().optional(),
  vocabulary: personaVocabularySchema.nullable().optional(),
  styleGuide: z.string().max(2000).nullable().optional(),
  systemPromptAddon: z.string().max(1500).nullable().optional(),
  surface: personaSurfaceSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdatePersonaPayload = z.infer<typeof updatePersonaSchema>;

// ── POST /api/v2/personas/ab-test — comparaison voix ─────────

/**
 * A/B test : envoie un message simple à 2 personas en parallèle pour
 * comparer la voix produite. `personaIdA` / `personaIdB` peuvent être des
 * IDs custom (UUID) ou builtins (`builtin:*`). On accepte les deux.
 */
export const abTestPersonaSchema = z.object({
  message: z.string().min(1).max(4000),
  personaIdA: z.string().min(1).max(120),
  personaIdB: z.string().min(1).max(120),
});

export type AbTestPersonaPayload = z.infer<typeof abTestPersonaSchema>;
