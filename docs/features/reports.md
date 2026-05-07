# Reports — `reports`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `reports` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P1** — token de partage public HMAC : secret change = tous les liens morts + fuite potentielle si token raw persisté |

## Description

Système de rapports IA auto-générés. Une `ReportSpec` déclare les sources de données (Composio, Google, HTTP, assets) → transforms (DAG de 9 opérations) → blocs visuels (11 types V1+V2) → narration LLM (single-shot Claude Sonnet 4-6, budget 0.2 USD) → signaux business déterministes (23 règles rules-based). Caching 3-tiers Supabase (source/transform/render). Versioning append-only. Commentaires par bloc. Partage public via token HMAC-SHA256 signé (stateless + revocation DB-backed). Exports PDF (pdfkit magazine) + XLSX (exceljs) + CSV. 11 rapports catalogue prédéfinis + templates custom.

## Surface publique

### Pages
- [app/(user)/reports/page.tsx](../../app/(user)/reports/page.tsx) — discovery catalogue (status ready/partial/blocked/custom), filtres domain
- [app/(user)/reports/editor/page.tsx](../../app/(user)/reports/editor/page.tsx) — éditeur spec rapide
- [app/(user)/reports/studio/page.tsx](../../app/(user)/reports/studio/page.tsx) — studio visuel (drag-drop builder)
- [app/public/reports/[token]/page.tsx](../../app/public/reports/[token]/page.tsx) — **page publique sans auth** (noindex, no-store)

### Endpoints API

**V2 (canonical, nouvelles routes) :**

| Méthode + Route | Auth | Rôle |
|-----------------|------|------|
| `GET /api/v2/reports` | `requireScope` | List CATALOG + templates (consolidé) |
| `POST /api/v2/reports/[specId]/run` | `requireScope` | Run spec (catalogue ou UUID template) |
| `GET /api/v2/reports/specs` | `requireScope` | List templates |
| `POST /api/v2/reports/specs` | `requireScope` | Save template |
| `GET /api/v2/reports/specs/[specId]` | `requireScope` | Load template |
| `POST /api/v2/reports/specs/sample` | `requireScope` | Preview builtin sample (Studio) |

**V1 (legacy actif) :**

| Méthode + Route | Auth | Rôle |
|-----------------|------|------|
| `GET/POST /api/reports` | `requireScope` | List applicable + save asset rapport |
| `POST /api/reports/share` | `requireScope` | Generate share token HMAC |
| `GET /api/public/reports/[token]` | **AUCUNE** | Public viewer |
| `POST /api/reports/[reportId]/export` | `requireScope` | PDF/XLSX export |
| `GET /api/reports/[reportId]/versions` | `requireScope` | List versions |
| `GET /api/reports/[reportId]/versions/[n]` | `requireScope` | Detail version |
| `POST /api/reports/[reportId]/versions/diff` | `requireScope` | Compare 2 versions |
| `GET/POST /api/reports/[reportId]/comments` | `requireScope` | Comments CRUD |
| `POST/GET /api/reports/templates` | `requireScope` | Templates CRUD |

### Exports publics (`lib/reports/`)

```ts
// sharing/signed-url.ts
signToken(input: SignTokenInput): SignTokenResult | null
verifyToken(token, options?): VerifyTokenResult | VerifyTokenError
hashToken(token): string
buildShareUrl(token, baseUrl?): string
checkShareRateLimit(userId, now?): { ok, retryAfterMs? }

// engine/run-report.ts
runReport(spec, options?): Promise<RunReportResult>

// catalog/index.ts
CATALOG: CatalogEntry[]
getApplicableReports(connectedApps): ApplicableReport[]
getCatalogEntry(id): CatalogEntry | undefined

// spec/schema.ts
parseReportSpec(value): ReportSpec (throw)
safeParseReportSpec(value): { success, data | error }
```

## Architecture interne

### Partage sécurisé (signing + sharing)

#### Token HMAC (`sharing/signed-url.ts`)

Format : `<base64url(payload)>.<hmac-base64url>` (RFC 4648, sans padding)

Payload JSON : `{ sid: string, aid: string, exp: number, iat: number }` (shareId, assetId, timestamps UNIX)

Signature : `HMAC-SHA256(base64url(payload), secret)`

```ts
const HMAC_ALG = "sha256"  // constant, jamais changé
const SECRET_MIN_LENGTH = 32  // chars
const TTL_MIN_HOURS = 1
const TTL_DEFAULT_HOURS = 24
const TTL_MAX_HOURS = 168
const SHARE_RATE_LIMIT_PER_HOUR = 30
```

`signToken()` retourne `null` (fail-closed) si :
- `REPORT_SHARING_SECRET` absent ou `< 32 chars`
- Log warning unique via flag `_warned`

Token raw **jamais persisté** — seulement `hashToken(token) → SHA-256 hex` en DB.

Changement de secret → **tous les tokens existants invalides** (stateless, pas de migration). Les links en circulation deviennent morts.

Révocation : DB-backed via `revoked_at` column. `verifyToken` vérifie `revoked_at IS NULL` après DB lookup.

#### Persistance (`sharing/store.ts`, table `report_shares`)

```sql
CREATE TABLE report_shares (
  id uuid PRIMARY KEY,
  asset_id text NOT NULL,
  tenant_id text NOT NULL,
  token_hash text NOT NULL,   -- SHA-256 hex du token raw (jamais le token)
  expires_at timestamp NOT NULL,
  created_by uuid,
  view_count integer DEFAULT 0,
  revoked_at timestamp,       -- NULL = actif
  created_at timestamp DEFAULT now()
);
```

Flow GET public :
1. `verifyToken(token)` → vérif signature + expiration
2. `hashToken(token)` → lookup `WHERE token_hash = ?`
3. Check `revoked_at IS NULL`
4. Load asset
5. Best-effort `incrementShareViewCount()` (fire-and-forget)

#### Page publique `GET /api/public/reports/[token]`

- **Aucune auth requise**
- Headers obligatoires : `X-Robots-Tag: noindex, nofollow, noarchive` + `Cache-Control: no-store, max-age=0`
- Error codes : `400 malformed_token`, `403 expired|bad_signature|revoked`, `404 not_found`, `503 no_secret|storage_unavailable`

### Engine (`lib/engine/run-report.ts`)

Pipeline déterministe en 10 étapes (order figé) :

```
1. Fetch sources (concurrency 3) → cache L1
2. Apply transforms (DAG topological) → cache L2
3. renderBlocks → RenderPayload (trim 200 rows/bloc max)
4. extractSignals (23 types, déterministe, hors cache)
5. alertDispatcher opt-in (best-effort, 4h throttle)
6. Render cache check L3 (specId + version + payloadHash)
7. narrate (Sonnet 4-6, budget max 0.2 USD, single-shot)
8. L3 cache write (fire-and-forget)
9. Webhook event "report.generated" (fire-and-forget)
10. Versioning opt-in (fire-and-forget, append-only)
```

Options injectables :
- `sourceLoader` — custom adapter (default = stub vide V1)
- `noCache` — désactive les 3 tiers (tests/forçage)
- `alertDispatcher` — Supabase alerting (opt-in, best-effort)
- `versioning` — `{ enabled, assetId, tenantId, triggeredBy }`
- `maxBudgetUsd` — override (0 = narration désactivée)

`RunReportResult` :
```ts
{
  payload: RenderPayload,
  narration: string | null,
  signals: BusinessSignal[],
  severity: Severity,
  cacheHit: { render: boolean },
  cost: { inputTokens, outputTokens, usd, exceeded: boolean },
  durationMs: number
}
```

`RenderPayload` — identifiable par `__reportPayload: true` :
```ts
{
  __reportPayload: true,
  blocks: RenderedBlock[],
  scalars: Record<string, unknown>,
  sources: RenderedSource[]
}
```

### Cache 3-tiers (Supabase)

| Tier | Table | Clé | TTL default | Usage |
|------|-------|-----|-------------|-------|
| L1 (source) | `report_source_cache` | SHA-256(kind+spec+scope+bucket) | 60s | Fetch sources |
| L2 (transform) | `report_transform_cache` | SHA-256(op+params+inputHashes) | 600s | Ops DAG |
| L3 (render) | `report_render_cache` | `(specId, version, payloadHash)` UNIQUE | 3600s | Payload final + narration |

`stableStringify()` (clés triées) garantit la déterminisme du hash.

Best-effort : si Supabase indisponible → cache ops no-op (pas de throw).

### Spec `ReportSpec` (Zod)

```ts
{
  id: UUID, version: number (≥1),
  meta: { title (1-120), summary (max 280), domain, persona, cadence, confidentiality },
  scope: { tenantId, workspaceId, userId? },
  sources: SourceRef[],      // 1-8 (contrainte superRefine)
  transforms: TransformOp[], // ≤24
  blocks: BlockSpec[],       // 1-12
  narration?: NarrationSpec, // mode, target, maxTokens 60-1500, style
  refresh: { mode, cron?, cooldownHours?, invalidateOn? },
  cacheTTL: { raw, transform, render }, // all 0-86400s
  createdAt, updatedAt: number (ms epoch)
}
```

**Source kinds** : `composio`, `native_google`, `http`, `asset`

**Transform ops** : `filter`, `join`, `groupBy`, `window`, `diff`, `rank`, `derive`, `pivot`, `unionAll`

**Block types V1** : `kpi`, `sparkline`, `bar`, `table`, `funnel`
**Block types V2** : `waterfall`, `cohort_triangle`, `heatmap`, `sankey`, `bullet`
**Block types V3 reserved** : `network`, `treemap`, `geo`, `pareto`, `monte_carlo`, `gantt`, `radar`, `calendar_heatmap`, `control_chart`

Validation `superRefine()` :
- Unicité des ids dans sources + transforms + blocks
- Tous les `dataRef` des blocs existent dans sources+transforms
- Tous les `inputs` de transforms existent en amont

### Narration

- Modèle : **`claude-sonnet-4-6`**
- Budget max : **`REPORT_BUDGET_USD = 0.2`** USD
- Max tokens : `spec.narration.maxTokens` (défaut 600, cap 1500)
- Budget dépassé → skip narration + log warning (run continue sans narration)
- Prompt caching : system prompt + few-shot examples (cache write 3.75 USD/1M, cache read 0.30 USD/1M)
- 4 presets : `kpi-quick`, `kpi-action`, `kpi-board`, `kpi-frank`

### Sources HTTP — SSRF guard

`lib/reports/sources/http.ts` :
- **Bloque** : localhost, 127.0.0.1, ::1, 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 169.254.x.x
- **Timeout** : 10s
- **Size limit** : 5MB
- **Parsing** : JSON uniquement

### Versioning (`lib/reports/versions/`)

Table `report_versions` — **append-only** :
```sql
id, asset_id, tenant_id, version_number (UNIQUE per asset_id),
spec_snapshot, render_snapshot, signals_snapshot, narration_snapshot,
triggered_by ("manual"|"scheduled"|"api"), created_at
```

`createVersion()` : `MAX(version_number) + 1` par asset_id. UNIQUE constraint prévient les races.

Diff : block-level (pas word-level) — détecter blocs ajoutés/supprimés/changés. Narration comparée en texte brut.

### Signaux business (`lib/reports/signals/`)

23 types déterministes (rule-based, jamais LLM) :
- Severity **critical** : `mrr_drop`, `runway_risk`, `expense_spike`, `sla_breach`, `retention_drop`, `change_failure_high`, `incident_spike`
- Severity **warning** : les 16 restants
- Calculés post-render (pas mis en cache) — état courant du report à chaque run

### Catalogue (11 rapports prédéfinis)

`CATALOG` avec `build(scope, extra?) → ReportSpec` :
Founder Cockpit, Customer 360, Deal-to-Cash, Financial P&L, Product Analytics, Support Health, Engineering Velocity, Marketing AARRR, HR/People, Hospitality Daily Briefing, Hospitality RevPAR.

`getApplicableReports(connectedApps)` → status `ready|partial|blocked`.

### Export

| Format | Lib | Upload |
|--------|-----|--------|
| PDF | pdfkit (modules magazine : cover + sections + blocks) | via asset storage |
| XLSX | exceljs (onglets par bloc tabulaire + Meta + Charts) | via asset storage |
| CSV | plat simple | — |

Fonts PDF : Source Serif 4 + Inter (embedded).

### Variables d'env critiques

| Var | Required | Notes |
|-----|----------|-------|
| `REPORT_SHARING_SECRET` | ✅ | HMAC secret ≥ 32 chars. Absent = fail-closed (null). Change = tous tokens morts |
| `NEXT_PUBLIC_APP_URL` | recommandé | Base URL `buildShareUrl()`. Fallback `NEXTAUTH_URL` |
| `ANTHROPIC_API_KEY` | ✅ | Narration Sonnet 4-6. Absent = narration skip |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Cache 3-tiers, report_shares, report_versions |

## Data flow

### Run + Share

```
[POST /api/v2/reports/[specId]/run { threadId? }]
   ↓ requireScope + resolve spec (CATALOG ou template UUID)
[runReport(spec, { sourceLoader, versioning, maxBudgetUsd })]
   ↓ 1. fetch sources (concurrency 3, cache L1 60s)
   ↓ 2. transforms DAG (cache L2 600s)
   ↓ 3. renderBlocks → RenderPayload (scalars + blocks, trim 200 rows/bloc)
   ↓ 4. extractSignals (déterministe, hors cache)
   ↓ 5. alertDispatcher best-effort
   ↓ 6. cache L3 check (specId + version + payloadHash)
   ├─ HIT → skip narrate, retour immédiat cost=0
   ↓ 7. narrate(scalars, spec) via Sonnet 4-6 (budget 0.2 USD)
   ↓ 8. cache L3 write (fire-and-forget)
   ↓ 9. webhook "report.generated" (fire-and-forget)
   ↓ 10. versioning (fire-and-forget, si opt-in)
[persist asset kind="report" avec payload JSON en contentRef]
[return JSON result]

[POST /api/reports/share { assetId, ttlHours }]
   ↓ requireScope + check rate limit (30/h)
   ↓ signToken() → { token, tokenHash, expiresAt, payload }
   ↓ createShareRow({ tokenHash, ... }) — token raw JAMAIS persisté
   ↓ return { shareUrl: buildShareUrl(token), expiresAt, shareId }

[GET /api/public/reports/{token}]
   ↓ verifyToken → { sid, aid, exp, iat } OU VerifyTokenError
   ↓ hashToken → SELECT report_shares WHERE token_hash = ?
   ↓ check revoked_at IS NULL
   ↓ load asset + return payload + headers noindex/no-store
```

## Invariants verrouillés

### I-1. HMAC-SHA256 + token format figé

Algo : `HMAC-SHA256`. Token format : `base64url(payload).base64url(hmac)`.

Payload schema figé : `{ sid, aid, exp, iat }`. Toute modification du schema = update spec + plan de migration (tokens existants invalides si payload change).

### I-2. `REPORT_SHARING_SECRET` ≥ 32 chars, fail-closed si absent

Sans secret ou secret < 32 chars → `signToken()` retourne `null`. La génération de share échoue proprement (503 `no_secret`).

Toute migration vers un autre mécanisme de secret (KMS, env chiffré) = update spec.

### I-3. Token raw JAMAIS persisté en DB

Seul `hashToken(token) → SHA-256 hex` est stocké dans `report_shares.token_hash`. Jamais le token brut.

Un `SELECT *` sur `report_shares` ne doit jamais permettre de reconstruire un token valide.

### I-4. Changement secret = tous tokens invalides (stateless)

Choix conscient : stateless. Pas de migration. À documenter dans runbook ops.

**Conséquence** : rotation du secret = tous les share links en circulation deviennent morts. Planifier après expiration naturelle des liens existants (max 168h).

### I-5. Révocation DB-backed via `revoked_at IS NULL`

`verifyToken()` vérifie `revoked_at` après DB lookup. Sinon retourne `VerifyTokenError { reason: "revoked" }`.

`revokeShare(shareId)` → UPDATE `revoked_at = NOW()`.

### I-6. Rate limit partage : 30 shares/h par userId (in-memory, sliding window)

`SHARE_RATE_LIMIT_PER_HOUR = 30`. Sliding window 1h.

Toute modification (seuil, backend Redis vs in-memory, window) = update spec.

### I-7. TTL range figé : 1h min / 24h default / 168h max

`TTL_MIN_HOURS = 1`, `TTL_DEFAULT_HOURS = 24`, `TTL_MAX_HOURS = 168` (7j).

Hors plage → clamping ou erreur selon l'implémentation. Modifier le max = update spec (impact sécurité).

### I-8. Page publique headers obligatoires

`GET /api/public/reports/[token]` **doit** retourner :
- `X-Robots-Tag: noindex, nofollow, noarchive`
- `Cache-Control: no-store, max-age=0`

Sans ces headers, les rapports partagés risquent d'être indexés par Google ou servis depuis le cache CDN (fuite même après revocation).

### I-9. Ordre pipeline engine figé

Les 10 étapes dans `runReport()` **doivent** s'exécuter dans cet ordre. Notamment :
- Signaux calculés post-render (jamais mis en cache avec L3)
- L3 cache check **avant** narration (pas de narration si cache hit)
- Versioning en fire-and-forget (pas blocking)
- Alerting **avant** L3 check (signals disponibles même si narration cache-hit)

### I-10. Cache 3-tiers TTL defaults figés

| Tier | Default | Max spec |
|------|---------|----------|
| L1 raw source | 60s | 86400s |
| L2 transform | 600s | 86400s |
| L3 render | 3600s | 86400s |

Best-effort : Supabase indisponible → no-op (pas de throw, run continue sans cache).

### I-11. Budget narration 0.2 USD default, max 1500 tokens

`REPORT_BUDGET_USD = 0.2` (constante). Dépassement → skip narration (log warning), run continue.

`spec.narration.maxTokens` cap à 1500 (Zod validation).

Toute augmentation du budget par défaut = update spec (impact coût).

### I-12. Modèle narration = `claude-sonnet-4-6`

Cohérent avec [chat.md I-6](chat.md) et [missions.md I-13](missions.md). Prompt caching actif.

### I-13. Concurrency sources : max 3 parallèles

`createSourceLoader()` cap à 3 sources en parallèle. Anti-rate-limit Composio/Google.

Modifier = update spec (impact perf + reliability).

### I-14. SSRF guard HTTP figé

`lib/reports/sources/http.ts` bloque : localhost, 127.0.0.1, ::1, 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 169.254.x.x + timeout 10s + size limit 5MB + JSON only.

Retirer une règle = update spec (vulnérabilité SSRF).

### I-15. `MAX_ROWS_PER_BLOCK = 200`

Trim agressif dans `renderBlocks()`. Empêche les blocs tabulaires massifs de faire exploser le payload JSON.

Augmenter = update spec (impact client-side rendu + narration token budget).

### I-16. `ReportSpec` — limites Zod figées

- `sources` : 1-8
- `transforms` : ≤24
- `blocks` : 1-12
- `narration.maxTokens` : 60-1500

Élargir = update spec (impact budget + perf + payloads).

### I-17. Versioning append-only

Table `report_versions` : jamais UPDATE ni DELETE. `version_number` auto-incrémenté par `MAX(...) + 1` avec UNIQUE constraint.

### I-18. Signaux 23 types, déterministes, calculés post-render hors cache

Jamais de LLM pour les signaux. Jamais mis en cache avec L3 (toujours recalculés au render).

Ajouter un type = OK. Modifier la sévérité d'un type existant = update spec (impact alerting 4h throttle).

## Évolutions autorisées sans spec

- Ajouter un bloc V3 au catalogue (sans retirer les V1+V2 existants) — update spec si câblage `renderBlocks` requis
- Ajouter un rapport au CATALOG (`build()` nouvelle fonction)
- Ajouter un signal business (23ème + → 24ème) si déterministe
- Ajouter un narration preset (`NARRATION_PRESETS`)
- Ajouter un slug alias dans `SLUG_ALIASES` sources Composio
- Ajouter une source kind si interface `SourceLoader` respectée
- Ajouter un cran de TTL pour un tier (dans 0-86400s)
- Polish UI reports / studio
- Ajouter un commentaire à un bloc
- Refactor interne `apply-transforms.ts` (perf, new op) si les 9 ops existantes restent
- Ajouter un onglet xlsx par bloc type
- Rotation du secret REPORT_SHARING_SECRET (avec plan migration/expiration)
- Migration fonts PDF (autres fonts open-source) si qualité maintenue

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Secret rotation sans plan migration | Tous liens partagés morts | Documentation ops obligatoire (invariant I-4) |
| `report_shares` token_hash leak DB | Impossible de reconstruire token (SHA-256 one-way) | Invariant I-3 |
| Source HTTP rate-limited | Rapport partiel (source = erreur) | Concurrency cap 3 + cache L1 60s |
| Source HTTP SSRF non bloqué | Accès aux métadonnées cloud, réseau interne | SSRF guard + timeout 10s |
| Cache L3 stale (spec version non incrémentée) | Narration obsolète | Clé L3 inclut `version` + `payloadHash` — changement de données invalide |
| Narration budget dépassé | Rapport sans narration | Skip gracieux + log warning (run continue) |
| `MAX(version_number) + 1` race condition | `UNIQUE(version_number)` violation (soft error) | Constraint DB → retry ou skip versioning |
| Bloc V2/V3 rendu sans composant React | White block silencieux | `lazy.tsx` fallback "bloc non supporté" |
| Share view_count best-effort | Compteur inexact | Acceptable |
| Alerting 4h throttle trop strict | Alertes manquées | Override possible en spec : `spec.narration.alertThrottle` |
| Cache L3 DB grande taille | Coût Supabase + perf | `pruneExpired()` cron (non planifié actuellement) |
| HTTP source size limit 5MB | Rapports nécessitant gros datasets bloqués | `MAX_BYTES` extensible via spec si cas légitime |
| Templates spec Zod invalide (ancien format) | Logged + skip (non bloquant) | Revalidation à chaque `loadTemplate()` |
| Double v1/v2 routes | Divergence logique possible | V2 canonical, V1 legacy actif — monitoring à ajouter |

## Tests

### Existants
- [`__tests__/reports/run-report.test.ts`](../../__tests__/reports/run-report.test.ts) — pipeline complet, cache hits, budget exceeded
- [`__tests__/reports/render-blocks.test.ts`](../../__tests__/reports/render-blocks.test.ts) — blocks rendu, trim 200
- [`__tests__/reports/apply-transforms.test.ts`](../../__tests__/reports/apply-transforms.test.ts) — DAG, ops, cache L2
- [`__tests__/reports/blocks.test.tsx`](../../__tests__/reports/blocks.test.tsx) — composants blocs render
- [`__tests__/reports/catalog.test.ts`](../../__tests__/reports/catalog.test.ts) — getApplicableReports, fuzzy match
- [`__tests__/reports/catalog-personas.test.ts`](../../__tests__/reports/catalog-personas.test.ts) — persona matching
- [`__tests__/reports/cost-meter.test.ts`](../../__tests__/reports/cost-meter.test.ts) — computeCostUsd, budget check
- [`__tests__/reports/llm-tool.test.ts`](../../__tests__/reports/llm-tool.test.ts) — spec tool
- [`__tests__/reports/tabular.test.ts`](../../__tests__/reports/tabular.test.ts) — Tabular helpers
- [`__tests__/reports/source-http.test.ts`](../../__tests__/reports/source-http.test.ts) — SSRF guard, timeout, JSON parse
- [`__tests__/reports/sources.test.ts`](../../__tests__/reports/sources.test.ts) — source loader
- [`__tests__/reports/export-pdf.test.ts`](../../__tests__/reports/export-pdf.test.ts) — PDF generation
- [`__tests__/reports/export-xlsx.test.ts`](../../__tests__/reports/export-xlsx.test.ts) — XLSX generation
- [`__tests__/reports/pdf-render.test.ts`](../../__tests__/reports/pdf-render.test.ts) — blocks PDF render
- [`__tests__/reports/discovery-ui.test.tsx`](../../__tests__/reports/discovery-ui.test.tsx) — UI discovery
- [`__tests__/api/reports-specs.test.ts`](../../__tests__/api/reports-specs.test.ts) — /specs CRUD
- [`__tests__/api/reports-specs-sample.test.ts`](../../__tests__/api/reports-specs-sample.test.ts) — sample preview

### Manquants (gap faible — bonne couverture orchestrator)

**Sharing (critique, peu couvert) :**
- Test `signToken` + `verifyToken` roundtrip (signature valide)
- Test `verifyToken` avec token expiré → `VerifyTokenError { reason: "expired" }`
- Test `verifyToken` secret wrong → `reason: "bad_signature"`
- Test `verifyToken` payload tronqué / malformé → `reason: "malformed_token"`
- Test `verifyToken` après revocation → `reason: "revoked"`
- Test `signToken` secret absent → `null`
- Test `signToken` secret < 32 chars → `null` + log unique
- Test `checkShareRateLimit` 30/h → 31ème retourne `{ ok: false, retryAfterMs }`
- Test `hashToken` idempotent (même hash pour même token)
- Test page publique headers : `X-Robots-Tag + Cache-Control` présents

**Versioning :**
- Test race condition `MAX(version_number)+1` avec UNIQUE constraint
- Test `listVersions` tenant isolation
- Test `diffVersions` : kpi change, block ajouté/supprimé, narration diff

**Cache :**
- Test `pruneExpired()` supprime uniquement expired
- Test `stableStringify` (ordre clés non-déterministe = différents hashes)
- Test L3 cache hit → cost = 0

**Budget :**
- Test `runReport` avec `maxBudgetUsd = 0` → narration null + `cost.exceeded = true`
- Test `computeCostUsd` avec cache tokens vs non-cache

**SSRF :**
- Test chacun des CIDR privés bloqués
- Test IPv6 loop blocked

## Code orphelin

- **Block types V3** : `network`, `treemap`, `geo`, `pareto`, `monte_carlo`, `gantt`, `radar`, `calendar_heatmap`, `control_chart` — dans le Zod schema, pas de composant React ni de `renderBlocks` handler
- **`pruneExpired()` cron** : exporté mais pas de job planifié actuellement
- **`llm-tool.ts`** — tool Vercel AI SDK pour génération de specs. Câblé mais pas largement utilisé

## Notes & historique

- **Secret HMAC vs JWT** — choix conscient : JWT (jsonwebtoken) créerait une dépendance supplémentaire + tentation d'y mettre des claims extensibles. HMAC simple + payload explicite = plus contrôlable.
- **Token raw non persisté** — décidé après audit sécurité : si `report_shares` est volé, aucun token ne peut être reconstitué.
- **Stateless + revocation DB** — meilleur of both worlds : vérification rapide sans DB (HMAC) + kill switch (revocation).
- **Cache L3 par `payloadHash`** — évite de re-nararrer si les données changent mais le résultat rendu est identique (ex: re-run à 5 min d'intervalle avec même data).
- **Budget 0.2 USD** — choisi pour reports raisonnables (quelques KPIs, narration 600 tokens) sans surprise en cas de spec pathologique (100 blocs avec 1500 tokens chacun).
- **V2 routes** — refactoring vers v2 pour consolidation. V1 reste actif pour backward compat.
- **Magazine PDF mai 2026** — refonte architecture PDF (modules, Source Serif 4 + Inter, cover + sections). Ancien format ASCII/Helvetica abandonné.
- **Signaux 23 types déterministes** — décision architecturale : les business insights critiques ne passent pas par LLM. LLM = narration (présentation), pas détection (business logic).
