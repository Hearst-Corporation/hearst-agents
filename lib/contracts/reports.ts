/**
 * Schémas zod canoniques pour les routes `/api/reports/*` et
 * `/api/v2/reports/*`.
 *
 * Centralise la validation des payloads (création, update, export, run,
 * partage, commentaires, versions, templates) afin que toutes les routes
 * partagent une seule source de vérité. Les contraintes reflètent les
 * invariants verrouillés de `docs/features/reports.md` :
 *  - I-1  : token HMAC vérifié côté `signed-url.ts` — JAMAIS validé via zod
 *           ici (token raw n'est ni accepté ni stocké côté API hors public/)
 *  - I-7  : TTL share `1 ≤ ttlHours ≤ 168`, défaut 24
 *  - I-15 : `MAX_ROWS_PER_BLOCK = 200` (cap engine, hors zod)
 *  - I-16 : limites `ReportSpec` (sources/transforms/blocks/narration)
 *           appliquées par `reportSpecSchema` côté `lib/reports/spec/schema.ts`
 *
 * Les routes consomment ces schémas via `safeParse` puis renvoient 400
 * `invalid_payload` (ou `invalid_input` historique) avec `error.issues` en
 * détail. Les schémas Zod inline présents dans certaines routes ont été
 * remplacés par les exports d'ici pour éviter la divergence.
 *
 * IMPORTANT : on ne valide JAMAIS un token de partage HMAC avec zod —
 * la vérification est faite par `verifyToken()` côté
 * `lib/reports/sharing/signed-url.ts` (signature + expiration + révocation).
 */

import { z } from "zod";
import { TTL_DEFAULT_HOURS, TTL_MAX_HOURS, TTL_MIN_HOURS } from "@/lib/reports/sharing/signed-url";
import { reportSpecSchema } from "@/lib/reports/spec/schema";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Format export supporté côté `/api/reports/[reportId]/export`.
 * Aligné sur `lib/reports/export/{pdf,xlsx,csv}.ts`.
 */
const exportFormatSchema = z.enum(["pdf", "xlsx", "csv"]);

/** Limite générique liste templates (cap raisonnable client-side). */
const VERSION_LIST_LIMIT_DEFAULT = 50;
const VERSION_LIST_LIMIT_MAX = 200;

// ── POST /api/reports/share — création share token ───────────

/**
 * Génération d'un share link HMAC pour un asset kind=report.
 *
 * Note : `assetId` est l'id texte d'un asset (cf `assets.id` text). Le
 * token HMAC lui-même est construit côté `signToken()` — on ne le valide
 * jamais via zod (I-1). `ttlHours` est clampé dans [1, 168] (I-7).
 */
export const createReportShareSchema = z.object({
  assetId: z.string().min(1).max(200),
  ttlHours: z.number().int().min(TTL_MIN_HOURS).max(TTL_MAX_HOURS).default(TTL_DEFAULT_HOURS),
});

export type CreateReportSharePayload = z.infer<typeof createReportShareSchema>;

// ── POST /api/v2/reports/[specId]/run — run pipeline ─────────

/**
 * Exécute un report (catalog ou template) via le pipeline 10 étapes
 * (I-9). Tous les champs sont optionnels — si `threadId` est fourni
 * et `sample !== true`, l'asset est persisté côté route.
 *
 * `customerEmail` est utilisé par certains rapports catalogue
 * (Customer 360) comme paramètre de build du spec. `noCache` et
 * `sample` désactivent les caches L1/L2/L3 (I-10) pour preview Studio.
 */
export const runReportSchema = z.object({
  threadId: z.string().min(1).max(200).optional(),
  customerEmail: z.string().min(3).max(320).optional(),
  noCache: z.boolean().optional(),
  sample: z.boolean().optional(),
});

export type RunReportPayload = z.infer<typeof runReportSchema>;

// ── POST /api/reports/[reportId]/rerun — rerun depuis asset ──

/**
 * Re-déclenche le pipeline d'un asset existant. Le spec est résolu
 * côté route via `provenance.specId` (catalog ou template). Le body
 * accepte juste `noCache` pour bypasser les caches.
 */
export const rerunReportSchema = z.object({
  noCache: z.boolean().optional(),
});

export type RerunReportPayload = z.infer<typeof rerunReportSchema>;

// ── GET /api/reports/[reportId]/export?format=… ──────────────

/**
 * Validation de la query string `?format=pdf|xlsx|csv` (défaut pdf).
 */
export const exportReportQuerySchema = z.object({
  format: exportFormatSchema.default("pdf"),
});

export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;

// ── POST /api/reports/templates et /api/v2/reports/specs ─────

/**
 * Création d'un template (custom report spec). La validation Zod du
 * spec est déléguée à `reportSpecSchema` (I-16 : sources 1-8,
 * transforms ≤24, blocks 1-12, narration.maxTokens 60-1500).
 *
 * `basedOnSpecId` (V2 only) permet de tracer la lineage d'un fork.
 */
export const createReportTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  spec: reportSpecSchema,
  isPublic: z.boolean().default(false),
  basedOnSpecId: z.string().min(1).max(200).optional(),
});

export type CreateReportTemplatePayload = z.infer<typeof createReportTemplateSchema>;

/**
 * Update partiel d'un template existant. Tous les champs sont
 * optionnels. Si `spec` est fourni il est revalidé intégralement par
 * `reportSpecSchema`. La route force le scope du caller dans le spec
 * (sécurité — cf `app/api/v2/reports/specs/[specId]/route.ts`).
 */
export const updateReportTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  spec: reportSpecSchema.optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateReportTemplatePayload = z.infer<typeof updateReportTemplateSchema>;

/**
 * Query string commune `GET /api/reports/templates` et
 * `GET /api/v2/reports/specs` — filtre optionnel par domaine.
 */
export const listReportTemplatesQuerySchema = z.object({
  domain: z.string().min(1).max(80).optional(),
});

export type ListReportTemplatesQuery = z.infer<typeof listReportTemplatesQuerySchema>;

// ── POST /api/v2/reports/specs/sample ────────────────────────

/**
 * Sample run inline — exécute un spec sans persister. Le spec est
 * validé intégralement par `reportSpecSchema` (I-16). La route force
 * le scope du caller (sécurité).
 */
export const sampleReportSpecSchema = z.object({
  spec: reportSpecSchema,
});

export type SampleReportSpecPayload = z.infer<typeof sampleReportSpecSchema>;

// ── POST /api/reports/[reportId]/comments ────────────────────

/**
 * Ajout d'un commentaire sur un report (asset kind=report).
 * `blockRef` permet d'attacher le commentaire à un bloc précis du
 * RenderPayload (cf `lib/reports/comments/store.ts`).
 */
export const createReportCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  blockRef: z.string().min(1).max(120).optional(),
});

export type CreateReportCommentPayload = z.infer<typeof createReportCommentSchema>;

// ── GET /api/reports/[reportId]/versions ─────────────────────

/**
 * Pagination simple liste versions (append-only — I-17).
 */
export const listReportVersionsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(VERSION_LIST_LIMIT_MAX)
    .default(VERSION_LIST_LIMIT_DEFAULT),
});

export type ListReportVersionsQuery = z.infer<typeof listReportVersionsQuerySchema>;

// ── GET /api/reports/[reportId]/versions/diff ────────────────

/**
 * Comparaison structurelle de deux versions (I-17 : append-only,
 * `version_number` toujours croissant). On accepte from === to (la
 * route renvoie alors un diff vide sans hit DB).
 */
export const diffReportVersionsQuerySchema = z.object({
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
});

export type DiffReportVersionsQuery = z.infer<typeof diffReportVersionsQuerySchema>;

// ── GET /POST /api/reports/[reportId]/versions/[n] ───────────

/**
 * Path param `versionNumber` — entier ≥ 1, coerced depuis la string
 * du segment dynamique.
 */
export const reportVersionNumberSchema = z.coerce.number().int().min(1);

export type ReportVersionNumber = z.infer<typeof reportVersionNumberSchema>;

// ── Path params communs ──────────────────────────────────────

/**
 * `[reportId]` — id texte d'un asset kind=report. Utilisé par toutes
 * les routes `/api/reports/[reportId]/*`. Vérification de format
 * basique : non-vide. Le check d'ownership est fait côté
 * `resolveAssetTenant()` dans chaque route.
 */
export const reportIdParamSchema = z.object({
  reportId: z.string().min(1).max(200),
});

export type ReportIdParam = z.infer<typeof reportIdParamSchema>;
