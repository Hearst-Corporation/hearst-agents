# Marketplace — `marketplace`

## Métadonnées
| **id** | `marketplace` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 (review) |

## Description

Galerie communautaire de templates partageables entre tenants Hearst OS. Trois kinds supportés : `workflow` (WorkflowGraph), `report_spec` (ReportSpec), `persona` (PersonaPayload). N'importe quel utilisateur authentifié peut publier ; tout utilisateur peut cloner, noter et signaler. La marketplace est globale (cross-tenant) : les templates publiés par un tenant A sont visibles et clonables par un tenant B.

Différence avec `features/reports.md` : les templates du marketplace ne sont pas des reports actifs — ils sont des specs dormantes en JSONB Supabase qui deviennent des ressources actives uniquement à la clone. Différence avec les templates custom privés (`lib/reports/templates/store`) : ceux-ci sont `isPublic: false` et n'apparaissent jamais dans la marketplace.

## Surface publique

Routes UI :
- `GET /marketplace` — grille browse (filtres kind + search + featured)
- `GET /marketplace/[id]` — détail + actions (cloner, noter, signaler)

API :
- `GET /api/v2/marketplace/templates` — liste paginée, params `kind`, `tags`, `featured`, `q`, `limit`, `offset`
- `POST /api/v2/marketplace/templates` — publie un template (auth requis)
- `GET /api/v2/marketplace/templates/[id]` — détail + ratings
- `POST /api/v2/marketplace/templates/[id]/clone` — clone dans le tenant du caller
- `POST /api/v2/marketplace/templates/[id]/rate` — note 1-5 + commentaire
- `POST /api/v2/marketplace/templates/[id]/report` — signalement abuse
- `PATCH /api/v2/marketplace/templates/[id]` — archive (owner only, soft delete)

Composants :
- `MarketplaceTemplateCard` — card cliquable vers détail
- `PublishTemplateModal` — modale publication depuis Studio/Builder/Personas

## Types clés

```ts
// lib/marketplace/types.ts

export const MARKETPLACE_KINDS = ["workflow", "report_spec", "persona"] as const;
export type MarketplaceKind = (typeof MARKETPLACE_KINDS)[number];

export interface MarketplaceTemplateSummary {
  id: string;
  kind: MarketplaceKind;
  title: string;
  description: string | null;
  authorDisplayName: string | null; // null si publié anonyme
  authorTenantId: string;
  tags: string[];            // max 5, alphanumérique + tirets, 2-24 chars
  ratingAvg: number;
  ratingCount: number;
  cloneCount: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceTemplate extends MarketplaceTemplateSummary {
  payload: WorkflowGraph | ReportSpec | PersonaPayload;
  authorUserId: string;
}

export interface MarketplaceRating {
  templateId: string;
  userId: string;
  rating: number;        // 1-5
  comment: string | null;
  createdAt: string;
}

export interface CloneResult {
  ok: boolean;
  resourceId?: string;  // id de la ressource créée dans le tenant cible
  error?: string;
}
```

## Invariants verrouillés

### I-1. Validation payload double-pass (publish + load)
Le payload d'un template est validé via `validatePayload(kind, payload)` à la publication **et** au chargement depuis Supabase (defense-in-depth). Un payload invalide au chargement provoque un `null` silencieux (warn console) — jamais une erreur 500 côté UI.

### I-2. Clone → ressource tenant cible, jamais une copie du template
Cloner un workflow crée une `ScheduledMission` dans le store missions + Supabase du tenant cible. Cloner un `report_spec` crée un template report privé (`isPublic: false`). Cloner un `persona` crée une persona (`isDefault: false`). Le `cloneCount` est incrémenté best-effort (non-bloquant, race condition acceptable MVP).

### I-3. Scope injecté à la clone, jamais repris du template
Pour `report_spec`, le `scope` (`tenantId`, `workspaceId`, `userId`) est réécrit avec les coordonnées du tenant cible — la valeur du template source est ignorée. Même logique pour `authorUserId`/`tenantId` dans personas.

### I-4. Rate limiting in-memory : 10 actions/min par (userId, action)
Les endpoints `/clone`, `/rate`, `/report`, `/publish` passent tous par `checkRateLimit(userId, action)` avant toute écriture. Le bucket est in-memory (pas Redis) : ne survit pas au restart, ne se synchronise pas entre instances. Acceptable MVP single-region.

### I-5. Rating : upsert par (templateId, userId), 1 seule note active par user
`rateTemplate` upsert sur la contrainte unique `template_id, user_id`. Le recalcul `rating_avg`/`rating_count` est géré par le trigger SQL `marketplace_ratings_recalc` (migration 0054). Fallback applicatif présent pour les envs dev sans migration.

### I-6. Signalement : insertion simple, modération manuelle hors-scope MVP
`reportTemplate` insère dans `marketplace_reports` sans logique automatique. La modération (suppression, ban auteur) est manuelle et hors-scope v1.

### I-7. Archive = soft delete owner-only
`archiveTemplate` filtre `eq("author_user_id", authorUserId)`. Un template archivé (`is_archived: true`) n'apparaît plus dans `listTemplates` ni `getTemplate`. Pas de hard delete côté API v1.

### I-8. Fail-soft Supabase
Si Supabase est indisponible : `listTemplates` renvoie `[]`, toutes les écritures renvoient `{ ok: false }`. Aucune exception ne remonte aux callers — uniquement des `console.error`. L'UI affiche l'état vide / erreur gracieusement.

### I-9. Tags : max 5, alphanumérique + tirets, 2-24 chars par tag
Validé via `tagsSchema` (Zod) à la publication. Les tags sont normalisés en lowercase côté `PublishTemplateModal`.

### I-10. Anonymisation auteur : `authorDisplayName = null` si `anonymizeAuthor: true`
L'`authorUserId` et l'`authorTenantId` sont toujours stockés en base (traçabilité). Seul `authorDisplayName` est masqué (null). L'UI affiche "Anonyme" quand `null`.

## Notes

- Tables Supabase : `marketplace_templates`, `marketplace_ratings`, `marketplace_reports`. Schéma dans `supabase/migrations/0054_marketplace_templates.sql`.
- `isFeatured` est positionné manuellement par l'admin Hearst (pas de flag côté API publique).
- Limite browse : 60 items côté page, 100 max côté store. Pas de pagination UI v1 (infinite scroll out-of-scope).
- Différence `marketplace_reports` (table) vs `features/reports.md` (feature reports IA) : ce sont deux entités distinctes. `marketplace_reports` = signalements abuse.

## Tests

Existants : `data-testid` sur `marketplace-kind-tabs`, `kind-tab-{all|workflow|report_spec|persona}`, `marketplace-search`, `marketplace-grid`, `marketplace-card-{id}`, `detail-clone`, `rate-{1-5}`, `rate-submit`, `publish-modal`, `publish-title`, `publish-desc`, `publish-tags`, `publish-anonymize`, `publish-confirm`.

Manquants :
- Test e2e clone workflow → vérifier création mission dans /missions
- Test e2e clone report_spec → vérifier apparition dans /reports
- Test rate limit (11e appel → 429)
- Test payload invalide rejeté à la publication (workflow sans `startNodeId`)
- Test archive owner-only (autre user ne peut pas archiver)
