# Assets — `assets`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `assets` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P1** — données utilisateur stockées hors Postgres, multi-backend, perte = irrécupérable |

## Description

Système de gestion des fichiers générés par Hearst OS (rapports PDF, documents, spreadsheets, briefs, messages, images, vidéos, audio, code, artifacts). Stockage hybride multi-backend (Cloudflare R2 prod, Supabase Storage, local FS dev) avec abstraction `StorageProvider`. Modèle de données canonique `Asset` v2 dans Supabase (table `assets`), provenance enrichie en JSONB (lineage parent-enfant, source URLs, coût LLM, latence, modèle utilisé), variants multi-format par-asset (audio TTS ElevenLabs, vidéo Runway/HeyGen, image fal.ai, code E2B sandbox) avec credits reservation atomique avant enqueue job, et cleanup scheduler daily TTL 30j.

Singletonisé 2026-04-29 : une seule source de vérité (`storeAsset` + `loadAssetById`), plus de double-write V1/V2.

## Surface publique

### Pages utilisateur
- [app/(user)/assets/page.tsx](../../app/(user)/assets/page.tsx) — liste scoped tenant/workspace, table avec glyphs par kind, click → setMode("asset")
- [app/(user)/assets/[id]/page.tsx](../../app/(user)/assets/[id]/page.tsx) — detail avec preview, metadata, lineage, variants tabs

### Composants
- [AssetPreview.tsx](../../app/(user)/components/AssetPreview.tsx) — header (kind, title, filesize) + content dispatch par kind
- [AssetLineage.tsx](../../app/(user)/components/AssetLineage.tsx) — provenance + parents mini-graph SVG + sources URLs
- [AssetVariantTabs.tsx](../../app/(user)/components/AssetVariantTabs.tsx) — tabs audio/video/image/code, polling 4s pendant pending/generating
- [VariantCarousel.tsx](../../app/(user)/components/VariantCarousel.tsx) — carousel variants pour rendu sequential
- [ImageViewer.tsx](../../app/(user)/components/ImageViewer.tsx), [PdfViewer.tsx](../../app/(user)/components/PdfViewer.tsx), [AudioPlayer.tsx](../../app/(user)/components/AudioPlayer.tsx), [VideoPlayer.tsx](../../app/(user)/components/VideoPlayer.tsx) — viewers spécialisés

### Endpoints API

| Méthode + Route | Auth | Rôle |
|-----------------|------|------|
| `GET /api/v2/assets` | `requireScope` | List scoped — `loadAssetsForScope({ tenantId, workspaceId, userId?, limit? })` |
| `POST /api/v2/assets` | `requireScope` | Create — Zod input (`type`, `name`, `run_id?`, `url?`, `threadId?`, `metadata?`) → `storeAsset()` |
| `GET /api/v2/assets/[id]` | `requireScope` + scope check | Detail — `loadAssetById(id, scope)` |
| `DELETE /api/v2/assets/[id]` | `requireScope` + scope check | Hard-delete + evict cache (storage cleanup async via worker) |
| `GET /api/v2/assets/[id]/download` | `requireScope` | Streaming download (lit `provenance.pdfFile.filePath` ou `metadata._filePath`) |
| `GET /api/v2/assets/[id]/variants` | `requireScope` | List variants |
| `POST /api/v2/assets/[id]/variants` | `requireScope` | Generate variant — credits reserve → enqueueJob (audio/video supportés v1, autres = 400 `kind_not_supported_yet`) |
| `POST /api/v2/assets/diff` | `requireScope` | Diff sémantique entre 2 assets (Anthropic ou fallback déterministe) |
| `POST /api/v2/documents/upload` | `requireScope` | Upload PDF natif → LlamaParse → markdown |
| `GET /assets/[...path]` | (public via signed URL ou tenant scope) | Servir asset binaire depuis storage |

## Architecture interne

### Modèle `Asset` v2 ([lib/assets/types.ts](../../lib/assets/types.ts))

```ts
interface Asset {
  id: string;            // UUID
  threadId: string;
  kind: AssetKind;       // 9 valeurs (cf I-2)
  title: string;
  summary?: string;
  outputTier?: string;
  provenance: AssetProvenance;  // JSONB enrichi
  contentRef?: string;   // text/markdown brut OU JSON { narration, payload }
  runId?: string;
  createdAt: string;
}

type AssetKind =
  | "report" | "brief" | "message" | "document"
  | "spreadsheet" | "task" | "event"
  | "inbox_brief" | "daily_brief" | "artifact";
```

**Persistance** : table `assets` (Supabase) + cache in-memory (`Map<threadId, Asset[]>`). `storeAsset()` écrit cache immédiat + Supabase async.

### `AssetProvenance` (B4 — 2026-04-29+)

JSONB enrichi dans `assets.provenance` :

```ts
interface AssetProvenance {
  providerId: ProviderId;
  tenantId?, workspaceId?, userId?: string;
  runId?, missionId?: string;
  specId?, specVersion?: string;
  runArtifact?: boolean;
  type?: string;                              // pdf | excel | doc | json | csv | text
  pdfFile?: { storageKind, fileName, mimeType, filePath, sizeBytes };
  reportMeta?: { signals[], severity };

  // Lineage (B4)
  derivedFrom?: string[];                     // assetIds parents (multi-parent OK)
  sourceUrls?: Array<{ url, fetchedAt?, label? }>;
  costUsd?: number;
  latencyMs?: number;
  modelUsed?: string;
  sentAt?, deliveryStatus?: string;
  channelRef?: string;
}
```

Backward-compat : un asset sans `derivedFrom`/`sourceUrls`/`costUsd` rend "Provenance incomplète" dans UI mais ne crash pas.

### `AssetVariant` ([lib/assets/variants.ts](../../lib/assets/variants.ts))

Table `asset_variants` (FK `asset_id` → `assets.id`).

```ts
interface AssetVariant {
  id, assetId: string;
  kind: "text" | "audio" | "video" | "slides" | "site" | "image" | "code";
  status: "pending" | "generating" | "ready" | "failed";
  jobId?, storageUrl?, mimeType?: string;
  sizeBytes?, durationSeconds?: number;
  generatedAt?: string;
  provider?, error?: string;
  metadata?: Record<string, unknown>;
  createdAt, updatedAt: string;
}
```

Lifecycle :
1. Client clique "Générer audio" → `POST /api/v2/assets/[id]/variants { kind, text? }`
2. Backend : check idempotence → estimate cost → `requireCreditsForJob` → `createVariant(status: "pending")` → `enqueueJob(...)`
3. Worker enqueue update `status: "generating"` puis `ready` (avec `storageUrl`) ou `failed` (avec `error`)
4. Client poll `GET /variants` toutes les 4s tant que `status ∈ {pending, generating}`

### Storage abstraction ([lib/engine/runtime/assets/storage/](../../lib/engine/runtime/assets/storage/))

**5 backends** :

| Type | Fichier | Usage |
|------|---------|-------|
| `local` | `local.ts` | Dev, FS `.runtime-assets/{tenantId?}/{key}` + sidecar `.meta.json` |
| `r2` | `r2.ts` | Prod, Cloudflare R2 (S3-compat, no egress) |
| `s3` | (stub commun) | AWS S3 (config alternative) |
| `supabase` | `supabase.ts` | Bucket Supabase Storage (RLS via prefix tenant) |
| `hybrid` | `hybrid.ts` | Hot (local LRU+TTL cache) + cold (R2 source) |

**Interface `StorageProvider`** (toutes implémentations) :
```ts
interface StorageProvider {
  type: StorageProviderType;
  upload(key, data, opts): Promise<UploadResult>;
  download(key, tenantId?): Promise<DownloadResult>;
  getSignedUrl(key, op, opts?, tenantId?): Promise<string>;
  delete(key, tenantId?): Promise<void>;
  exists(key, tenantId?): Promise<boolean>;
  list(prefix, tenantId?): Promise<StorageObject[]>;
  health(): Promise<{ ok, latencyMs, error? }>;
}
```

### Boot-time factory (`instrumentation.ts` + `storage/index.ts`)

Précédence d'init :
1. Supabase Storage si `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → `provider: "supabase"`
2. R2 si tous les `R2_*` présents → `"r2"` (prod) ou `"hybrid"` (dev)
3. Fallback local → `"local"`

Singleton `getGlobalStorage()` exposé partout. Init unique au boot via `initGlobalStorage(config)`.

### Storage key format

`{tenantId?}/{path}` après `normalizeStorageKey()` :
- **Reject** absolute paths (leading `/`)
- **Reject** path traversal (`..`)
- Normalise separators à `/`
- Auto-préfixe `tenantId/` si fourni

### Hybrid hot+cold (`storage/hybrid.ts`)

- Source de vérité : **R2** (cold)
- Cache : **local** LRU + TTL (`maxHotSizeBytes`, `maxHotFiles`, `ttlSeconds`)
- `upload()` → toujours R2, cache local si `<10% maxHotSize`
- `download()` → check local first, sinon fetch R2 + cache
- `warmCache(keys[], tenantId?)` → admin endpoint, hydrate hot manuellement
- `getCacheStats()` → `{ files, size, maxSize, hitRate }`

Config dev :
```ts
{ maxHotSizeBytes: 50MB, maxHotFiles: 500, ttlSeconds: 3600 }
```

### Cleanup scheduler ([cleanup/](../../lib/engine/runtime/assets/cleanup/))

3 niveaux :
- `boot.ts` : `ensureCleanupSchedulerStarted()` (singleton, called from `instrumentation.ts`, guard `globalThis.__hearst_cleanup_scheduler__`)
- `scheduler.ts` : `start() / stop() / runNow() / getStatus()`
- `worker.ts` : `runAssetCleanup(config)` (deletion logic)

Env vars :

| Var | Default | Purpose |
|-----|---------|---------|
| `ASSET_CLEANUP_ENABLED` | `true` | Master switch (`"false"` = disable) |
| `ASSET_CLEANUP_CRON` | `"0 2 * * *"` | Cron (parser supporte uniquement `M H * * *`) |
| `ASSET_CLEANUP_TTL_DAYS` | `30` | Retention par défaut |
| `ASSET_CLEANUP_DRY_RUN` | `false` | Log-only (pas de delete) |

Critères de suppression :
- `created_at < now - defaultTtlDays`
- Per-tenant overrides supportés (`tenantOverrides` dans config)
- `findOrphanedFiles` → unimplemented (gap)

Output `CleanupResult` : `{ assetsMarked, assetsDeleted, filesDeleted, assetsArchived, errors, durationMs, byTenant }`.

### Detail resolution (`detail.ts`)

Ordre de recherche pour `getAssetDetail({ assetId, scope })` :
1. Runs in-memory (`getAllRuns(100)`)
2. Runs persistés (Supabase `runs` table)
3. Table `assets`

Output `AssetDetail` :
```ts
{
  id, runId, scope,
  name, type,
  previewType: "text" | "json" | "document" | "report" | "unknown";
  content?, json?, metadata?,
  file?: { hasFile, fileName, mimeType, sizeBytes, downloadUrl };
  createdAt?
}
```

### Generators

- [generators/pdf.ts](../../lib/engine/runtime/assets/generators/pdf.ts) — `generatePdfArtifact({ ..., title, content })` via PDFKit (A4, margins 60/60/50/50, info `Creator: "HEARST OS"`)
- [generators/spreadsheet.ts](../../lib/engine/runtime/assets/generators/spreadsheet.ts) — ExcelJS (TBD)

Fonts PDF : résolution via `require.resolve("pdfkit/package.json")` → `js/data` (AFM files). Pas de fonts custom.

### Variables d'env critiques

| Var | Required | Notes |
|-----|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Database + Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role pour storage ops |
| `SUPABASE_STORAGE_BUCKET` | optionnel | Bucket name (default `"assets"`) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | ✅ prod | Cloudflare R2 |
| `R2_PUBLIC_URL` | recommandé | CDN URL (sinon R2.dev subdomain) |
| `ASSET_CLEANUP_*` | optionnels | Cleanup scheduler |

## Data flow

### Création d'asset (run output)

```
[Run termine]
   ↓ orchestrator extrait {title, content, kind, type}
[create-asset.ts]
   ↓ generatePdfArtifact() si type="pdf"
   ↓ saveAssetFile(...) → AssetFileInfo (filePath local)
[storeAsset(asset)]
   ├─ assetCache.set(threadId, [...assets, asset])  (immédiat)
   ├─ rawDb(sb).from("assets").upsert(asset)       (async)
   └─ webhook fire-and-forget : "asset.created"
```

### Variant generation (audio)

```
[Client click "Générer audio"]
   ↓ POST /api/v2/assets/[id]/variants { kind: "audio", text }
[Backend]
   ├─ loadAssetById(id, scope) — check ownership
   ├─ idempotence : si variant audio ready/generating → return existing
   ├─ estimateSpeechCost(text, modelId) → estimatedCostUsd
   ├─ requireCreditsForJob({ userId, jobKind: "audio-gen", estimatedCostUsd })
   │   ├─ atomic SQL fn : reserve credits
   │   └─ throw "insufficient_credits" → 402
   ├─ createVariant({ assetId, kind: "audio", status: "pending", provider: "elevenlabs" })
   └─ enqueueJob({ jobKind: "audio-gen", variantId, ... })
       └─ on enqueue failure : cleanupAfterEnqueueFailure() — refund credits + mark variant failed
   ↓ Return { variantId, jobId, status: "pending", estimatedCostUsd }

[Worker async]
   ├─ update variant status: "generating"
   ├─ ElevenLabs TTS API call → audio buffer
   ├─ upload to storage (Supabase / R2 / hybrid)
   └─ update variant { status: "ready", storageUrl, mimeType, sizeBytes, durationSeconds }

[Client poll 4s]
   ↓ GET /api/v2/assets/[id]/variants
   ↓ render AudioPlayer si status=ready
```

### Download

```
[GET /api/v2/assets/[id]/download]
   ↓ requireScope
   ↓ getAssetDetail({ assetId, scope })
   ↓ readAssetFile(detail.metadata._filePath ou provenance.pdfFile.filePath)
   ↓ Return 200 Uint8Array + Content-Type + Content-Disposition: attachment
```

### Cleanup nightly

```
[boot.ts ensureCleanupSchedulerStarted()]
   ↓ schedule next 02:00
[scheduler tick daily]
   ↓ runAssetCleanup(config)
   ↓ query assets WHERE created_at < now - ttlDays LIMIT batchSize
   ↓ if dryRun → log-only, return
   ↓ for each :
       ├─ delete storage blob (idempotent — survit si déjà supprimé)
       └─ delete DB row
   ↓ return CleanupResult
```

## Invariants verrouillés

Toute modification d'un point ci-dessous **exige une mise à jour de cette spec validée par Adrien**.

### I-1. Singleton store : `storeAsset()` + `loadAssetById()` uniques

Depuis 2026-04-29 : **un seul chemin** d'écriture (`storeAsset`) et de lecture (`loadAssetById` / `loadAssetsForScope`). Pas de double-write `createAsset` + `saveAsset` + `storeAsset` comme avant.

Tout caller doit passer par ces APIs publiques. Toute écriture directe via `rawDb(sb).from("assets")` hors de `storeAsset` = update spec.

### I-2. `AssetKind` — 9 valeurs figées

`report | brief | message | document | spreadsheet | task | event | inbox_brief | daily_brief | artifact`.

Ajouter un kind = update spec + sync `KIND_REF` dans AssetPreview + sync glyph table dans liste + vérifier les filtres `loadAssetsForScope`.

### I-3. `StorageProvider` interface figée

7 méthodes obligatoires sur tout backend : `upload`, `download`, `getSignedUrl`, `delete`, `exists`, `list`, `health`.

Toute migration vers nouvelle interface (ex: ajout `multipart`) = update spec + sync 4 implémentations (local, r2, s3, supabase) + hybrid délégateur.

### I-4. 5 storage providers reconnus

`local | r2 | s3 | hybrid | supabase`. Ajout d'un type = update spec + factory + boot-time precedence.

### I-5. Boot-time precedence

Ordre figé : `Supabase` → `R2` (prod) ou `hybrid` (dev) → `local` fallback.

Toute inversion = update spec. Le local reste en dernier (fallback dev).

### I-6. Storage key format

`{tenantId?}/{path}`. **Normalisation obligatoire** :
- Reject absolute (`^/`)
- Reject path traversal (`..`)
- Separators normalisés à `/`
- Auto-préfixe tenantId si fourni

Toute exception = update spec. Bypass de la normalisation = vulnérabilité (multi-tenant leak ou path traversal).

### I-7. Hybrid hot+cold — R2 source de vérité

R2 est **source unique de vérité** dans le mode hybrid. Le local est uniquement cache. Tout upload va à R2 d'abord ; le cache est best-effort.

Inverser (local source + R2 sync) = update spec + plan de migration des cache invalidation.

### I-8. `AssetProvenance` JSONB — pas de table dédiée pour le lineage

`derivedFrom`, `sourceUrls`, `costUsd`, `latencyMs`, `modelUsed`, etc. restent dans `assets.provenance` JSONB. Pas de migration vers tables relationnelles dédiées sans update spec.

Backward-compat : champs optionnels, asset sans = render "Provenance incomplète".

### I-9. `AssetVariant` parent-child via FK `asset_id`

Pas de table de jointure intermédiaire. Pas de variants chaînés (variant d'un variant). Un asset → N variants directs.

Status figé : `pending | generating | ready | failed`.

### I-10. Variant generation : credits reserve atomique avant enqueue

Flow obligatoire :
1. `estimateSpeechCost` / coût fixe vidéo
2. `requireCreditsForJob({ userId, jobKind, estimatedCostUsd })` — atomic SQL fn (réserve)
3. `createVariant(status: "pending")`
4. `enqueueJob(...)` — si échec : `cleanupAfterEnqueueFailure()` (refund + mark failed)

Toute migration qui inverse l'ordre (enqueue avant reserve) = double-charge possible si crash entre.

### I-11. Insufficient credits → HTTP 402

`POST /variants` retourne **402** avec `{ error: "insufficient_credits", availableUsd, estimatedCostUsd }`. Pas 403 ni 400.

### I-12. Asset deletion = hard-delete + cache evict + storage cleanup async

`DELETE /api/v2/assets/[id]` :
1. `deleteAssetById(id, scope)` — DB row deleted
2. `evictAssetById(id)` — cache in-memory removed
3. **Storage cleanup laissé au worker async** (pas synchrone)

Pas de soft-delete. Toute migration vers soft-delete = update spec + plan de filtrage.

### I-13. Cleanup scheduler — TTL 30j default + dry-run

Defaults figés : `defaultTtlDays = 30`, `archiveAfterDays = 90` (0 = no archive), `deleteArchivedAfterDays = 0` (keep forever), `batchSize = 1000`.

`ASSET_CLEANUP_DRY_RUN = "true"` = log-only, **ne supprime pas**. Doit rester implémenté.

Per-tenant overrides via `tenantOverrides` config.

### I-14. Document upload PDF only

`POST /api/v2/documents/upload` accepte **uniquement** `application/pdf`. Tout autre MIME = 400 `"Seuls les PDF sont supportés"`.

Élargir = update spec + sync parser (LlamaParse v1 = PDF only).

### I-15. Detail resolution order

Ordre figé : runs in-memory → runs persistés → assets table. Inverser = casse les fast-paths runs récents.

### I-16. Variant kinds supportés v1 : `audio` + `video`

Les autres kinds (`image`, `slides`, `site`, `code`) retournent **400 `kind_not_supported_yet`** sur `POST /variants`.

Câbler un kind v2 = update spec + tester credits + worker.

### I-17. Hard scope check sur tous les endpoints `[id]`

`GET/DELETE /api/v2/assets/[id]`, `/download`, `/variants` → `loadAssetById(id, scope)` retourne `null` si scope mismatch → 404 (pas 403).

Cela évite la fingerprinting d'IDs cross-tenant. Migrer vers 403 = update spec.

### I-18. ContentRef peut être text brut OU JSON

Format flexible : un asset stocke soit `contentRef = "markdown text..."`, soit `contentRef = JSON.stringify({ narration, payload, ... })`. Le viewer extrait `narration` si JSON parse réussit.

Migration vers schema strict = update spec + plan de migration des assets existants.

## Évolutions autorisées sans spec

- Ajout d'un nouveau backend `StorageProvider` (ex: GCS) tant que l'interface est respectée
- Ajout d'un champ optionnel à `AssetProvenance` (rétrocompatible)
- Ajout d'un viewer (ex: 3D model) avec dispatch dans `AssetVariantTabs`
- Polish UI sur n'importe quel composant
- Refactor interne `storage/hybrid.ts` (politique d'éviction, taille cache)
- Ajout de tests
- Ajout d'un per-tenant override dans `tenantOverrides`
- Migration interne de `pdfkit` vers une autre lib PDF (tant que API `generatePdfArtifact` reste)
- Ajout d'un format dans le upload (si rétrocompatible : ex `image/png` en plus de PDF, mais update spec si on touche I-14)

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| R2 down en prod (pas de fallback Supabase auto) | Upload échoue, run continue mais pas d'asset persisté | Pas de fallback automatique. Operator doit failover |
| Hybrid cache éviction pendant lecture | Re-fetch R2 → latence supplémentaire mais pas de perte | Acceptable (TTL généreux) |
| Storage key path traversal (`../`) | Multi-tenant leak | `normalizeStorageKey()` reject + tests |
| Crash entre `requireCreditsForJob` et `enqueueJob` | Crédits réservés non utilisés | `cleanupAfterEnqueueFailure()` refund explicite |
| Worker crash après update `generating` | Variant bloqué en "generating" pour toujours | Pas de TTL automatique. Gap : à ajouter (timeout 10min ?) |
| Cleanup `findOrphanedFiles` non implémenté | Fichiers orphelins (DB row deleted, blob storage non) accumulent | Acceptable v1 (R2 cheap). À implémenter |
| `ASSET_CLEANUP_DRY_RUN` mal configuré (true en prod) | Cleanup ne fait rien | Logs explicites + monitoring `getStatus()` |
| `ASSET_CLEANUP_TTL_DAYS` trop court | Suppression d'assets utiles | Per-tenant override possible. Defaults conservateurs (30j) |
| LlamaParse down (upload PDF) | Upload retourne 500 | Pas de fallback. Acceptable v1 |
| Provenance JSONB grossit indéfiniment | Row size limit Postgres (1GB pratiquement, mais perf dégrade) | `derivedFrom` array, `sourceUrls` cap raisonnable. Pas de cap dur actuel (gap) |
| Asset sans `tenantId` dans provenance (legacy) | RLS partial fallback `OR IS NULL` | Migration progressive. Pas de plan de cleanup explicite |
| Multipart upload >5MB single PUT R2 | Upload échoue ou lent | AWS SDK `Upload` fait le multipart automatiquement |
| Concurrent variant generation pour même kind | Idempotence retourne le premier, mais cost déjà facturé | Idempotence v1 OK ; cost déjà refundé en cas de fail |

## Tests

### Existants
- [`__tests__/assets/lineage.test.ts`](../../__tests__/assets/lineage.test.ts) — provenance B4 backward-compat
- [`__tests__/assets/store-validation.test.ts`](../../__tests__/assets/store-validation.test.ts) — title rejette empty/"Untitled"
- [`__tests__/runtime/assets/detail.test.ts`](../../__tests__/runtime/assets/detail.test.ts) — scope check, run resolution
- [`__tests__/api/assets-diff.test.ts`](../../__tests__/api/assets-diff.test.ts) — diff endpoint, fallback déterministe sans Anthropic key

### Manquants (gap moyen)

**Storage providers (couverture quasi nulle)** :
- Test unitaire `local.ts` : upload, download, delete, list, normalizeKey rejects
- Test unitaire `r2.ts` : signed URL expiry, multipart upload chunking, error mapping S3
- Test unitaire `supabase.ts` : tenant prefix, bucket inexistant
- Test unitaire `hybrid.ts` : LRU eviction, TTL expiry, hot miss → cold fetch + cache, getCacheStats
- Test factory `index.ts` : precedence Supabase > R2 > local

**Cleanup scheduler** :
- Test cron parser (M H * * *)
- Test dry-run mode (no actual delete)
- Test per-tenant override
- Test daily trigger msUntilFirstRun
- Test batch size respect (1000)

**Variant generation** :
- Test idempotence (variant ready déjà → return existing, no duplicate enqueue)
- Test 402 insufficient credits
- Test cleanupAfterEnqueueFailure refund
- Test polling 4s côté UI
- Test status transitions pending → generating → ready

**Generators** :
- Test PDF generation (output non vide, valide PDF, fonts AFM)
- Test spreadsheet (à câbler quand impl)

**Storage key normalization** :
- Test reject absolute, path traversal, multiple separators, tenant prefix

**Document upload** :
- Test reject non-PDF MIME
- Test parse markdown extraction
- Test page count

**Detail resolution** :
- Test ordre runs in-mem → persisted → assets table
- Test scope mismatch → null

**Cross-feature** :
- Test provenance lineage avec parents multi-tenant (rejet)
- Test webhook `asset.created` fire-and-forget

## Code orphelin (code-ready non câblé)

- **`findOrphanedFiles`** dans `cleanup/worker.ts` — retourne `[]` (TODO)
- **`spreadsheet.ts` generator** — file existe, implémentation TBD
- **`code` variant kind** — type dans union, pas câblé (retourne 400 `kind_not_supported_yet`)
- **`slides` / `site` variant kinds** — idem

## Notes & historique

- **Migration 0011/0012** — table `assets` initiale + colonnes provenance v1
- **Migration 0026** — UUID cleanup (cf [auth.md](auth.md))
- **B4 (2026-04-29)** — provenance enrichie : `derivedFrom`, `sourceUrls`, `costUsd`, `latencyMs`, `modelUsed`. Backward-compat avec assets pré-B4
- **2026-04-29 singletonisation** — `storeAsset` + `loadAssetById` uniques. Suppression de `createAsset` + `saveAsset` legacy
- **Hybrid storage** — vague "asset locality" : cache local (fast path) + R2 (source). LRU + TTL. R2 reste source de vérité (cohérence vs perf)
- **Cleanup scheduler** — vague 9 (B1) : daily 2am, TTL 30j, dry-run capable, per-tenant override
- **Variants v1** — audio (ElevenLabs) + video (Runway/HeyGen). Image (fal.ai) et code (E2B) prévus v2
- **Document upload natif** — PDF only via LlamaParse. Phase B noté : "remplacer upload URL par upload natif → R2" (gap actuel : encore via URL pour les autres formats)
- **Mock data hospitality** — cf [cockpit.md](cockpit.md) (`lib/verticals/hospitality/mock-data.ts`)
- **Detail resolution multi-source** — assets peuvent venir de runs in-memory, runs Supabase, ou table `assets`. Cohérent avec la durée de vie variable des runs
