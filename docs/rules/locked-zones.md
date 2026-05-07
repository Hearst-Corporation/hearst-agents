# Zones verrouillées — Hearst OS

## But

Index des features et chemins du repo soumis à des **invariants verrouillés**. Toute modification d'un invariant ci-dessous exige une mise à jour de la spec correspondante (validée par Adrien) **avant** d'écrire du code.

Hors invariants, le travail reste libre selon le mode autonomie défini dans [CLAUDE.md](../../CLAUDE.md).

## Légende

| Niveau | Sens |
|--------|------|
| **P0** | Régression = app cassée pour tous les utilisateurs (auth, routing central, pipeline IA) |
| **P1** | Régression = feature majeure cassée silencieusement (data loss, race condition, sécurité) |
| **P2** | Régression = dégradation visible mais réparable (UX, perf, edge cases) |

## Procédure pour modifier un invariant

1. Ouvrir le fichier `docs/features/<id>.md` correspondant
2. Section "Invariants verrouillés" : lire l'invariant concerné
3. Si le changement le contredit → proposer un update spec à Adrien **avant** de coder
4. Si Adrien valide → mettre à jour la spec (incrémenter `version spec`, mettre à jour `dernière revue`)
5. Coder
6. PR référence la spec mise à jour

## Index des features verrouillées

### Auth & Session — `auth` · P0

Spec : [docs/features/auth.md](../features/auth.md)

**Invariants** (résumé — détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | Email comme identifiant interdit (UUID strict post-migration `0026`) | `lib/platform/auth/get-user-id.ts`, `user-resolver.ts` |
| I-2 | Dev bypass guard prod obligatoire (403 si flag absent) + UUID `36914162-…` figé | `app/api/auth/dev-login/route.ts`, `lib/platform/auth/options.ts` |
| I-3 | Tokens chiffrés AES-256-GCM, format `iv:tag:cipher`, KeyProvider abstraction | `lib/platform/auth/tokens.ts` |
| I-4 | Auto-revoke à 5 échecs (`MAX_AUTH_FAILURES`) | `lib/platform/auth/tokens.ts` |
| I-5 | Forme `requireScope()` figée : `{scope, error: null}` ou `{scope: null, error: {status: 401}}` | `lib/platform/auth/scope.ts` |
| I-6 | Schéma `user_tokens` (uuid `user_id`, UNIQUE `(user_id, provider)`, RLS service_role only) | `supabase/migrations/`, `lib/platform/auth/tokens.ts` |
| I-7 | Slack OAuth PKCE S256 obligatoire, state `{v,u,t,w}` figé | `app/api/auth/slack/route.ts`, `app/api/auth/callback/slack/route.ts` |
| I-8 | NextAuth strategy = `jwt` (stateless) | `lib/platform/auth/options.ts` |
| I-9 | Env vars critiques mandatoires en prod : `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, au moins un provider OAuth | env config |
| I-10 | `registerProviderUsage()` appelé au signIn jwt callback | `lib/platform/auth/options.ts` |

---

### Reports — `reports` · P1

Spec : [docs/features/reports.md](../features/reports.md)

**Invariants** (résumé — 18, détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | HMAC-SHA256 + token format figé `base64url(payload).base64url(hmac)` | `lib/reports/sharing/signed-url.ts` |
| I-2 | `REPORT_SHARING_SECRET` ≥ 32 chars, fail-closed si absent | `lib/reports/sharing/signed-url.ts` |
| I-3 | Token raw **jamais persisté** en DB (seulement SHA-256 hash) | `lib/reports/sharing/store.ts` |
| I-4 | Changement secret = tous tokens invalides (stateless, pas de migration auto) | `lib/reports/sharing/signed-url.ts` |
| I-5 | Révocation DB-backed via `revoked_at IS NULL` | `lib/reports/sharing/store.ts` |
| I-6 | Rate limit 30 shares/h par userId (sliding window in-memory) | `lib/reports/sharing/signed-url.ts` |
| I-7 | TTL range 1h min / 24h default / 168h max | `lib/reports/sharing/signed-url.ts` |
| I-8 | Page publique : `X-Robots-Tag: noindex` + `Cache-Control: no-store` obligatoires | `app/api/public/reports/[token]/route.ts` |
| I-9 | Pipeline engine 10 étapes dans l'ordre figé | `lib/reports/engine/run-report.ts` |
| I-10 | Cache 3-tiers TTL defaults (L1 60s, L2 600s, L3 3600s), best-effort Supabase | `lib/reports/engine/cache.ts` |
| I-11 | Budget narration 0.2 USD default, max 1500 tokens | `lib/reports/engine/run-report.ts`, `cost-meter.ts` |
| I-12 | Modèle narration = `claude-sonnet-4-6` + prompt caching | `lib/reports/engine/narrate.ts` |
| I-13 | Concurrency sources max 3 parallèles | `lib/reports/sources/index.ts` |
| I-14 | SSRF guard HTTP (private CIDRs + 10s timeout + 5MB) | `lib/reports/sources/http.ts` |
| I-15 | `MAX_ROWS_PER_BLOCK = 200` (trim dans renderBlocks) | `lib/reports/engine/render-blocks.ts` |
| I-16 | `ReportSpec` limites Zod (1-8 sources, ≤24 transforms, 1-12 blocks, tokens 60-1500) | `lib/reports/spec/schema.ts` |
| I-17 | Versioning append-only (jamais UPDATE/DELETE) | `lib/reports/versions/store.ts` |
| I-18 | Signaux 23 types déterministes, calculés post-render hors cache | `lib/reports/signals/extract.ts` |

---

### Connections — `connections` · P1

Spec : [docs/features/connections.md](../features/connections.md)

**Invariants** (résumé — 18, détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | **Write-guard pattern two-step** `_preview: true` default → confirm → `_preview: false` | `lib/connectors/composio/write-guard.ts`, `to-ai-tools.ts` |
| I-2 | `WRITE_SEGMENTS` (19) + `WRITE_PREFIXES` (6) figés | `lib/connectors/composio/write-guard.ts` |
| I-3 | **Aucune whitelist auto-approbation** | `lib/connectors/composio/write-guard.ts`, `to-ai-tools.ts` |
| I-4 | `executeComposioAction` never throws (envelope `{ok, data?, error?, errorCode?}`) | `lib/connectors/composio/client.ts` |
| I-5 | SDK Composio lazy dynamic import (peer dep) | `lib/connectors/composio/client.ts` |
| I-6 | `isComposioConfigured()` = présence `COMPOSIO_API_KEY` | `lib/connectors/composio/client.ts` |
| I-7 | Slug aliases LLM hallucinations (extensible, log warn) | `lib/connectors/composio/client.ts` |
| I-8 | Discovery cache 60s, **don't cache empty** | `lib/connectors/composio/discovery.ts` |
| I-9 | Discovery limit 25 tools/toolkit | `lib/connectors/composio/discovery.ts` |
| I-10 | Domain allowlist + cap 40 tools | `lib/connectors/composio/write-guard.ts` |
| I-11 | `ConnectorConnection` 5 statuts figés (connected\|disconnected\|degraded\|error\|pending_auth) | `lib/connectors/control-plane/types.ts` |
| I-12 | Unified reconciliation : auth truth > control-plane (auto-heal CP) | `lib/connectors/unified/reconcile.ts` |
| I-13 | Preview formatters interface synchrone `(args) => string` | `lib/connectors/composio/preview-formatters/index.ts` |
| I-14 | Footer "Réponds **confirmer**" obligatoire (matching ConfirmActionChips) | `lib/connectors/composio/preview-formatters/shared.ts` |
| I-15 | Integrations Phase 1 = read-only strict (throw `TOOL_RISK_NOT_ACCEPTED` si write) | `lib/integrations/executor.ts` |
| I-16 | Native vs Composio dedup : Composio wins UI | `app/(user)/components/ConnectionsHub.tsx` |
| I-17 | OAuth `window.open()` IMMÉDIAT au click (anti popup-blocker) | `app/(user)/components/ConnectionsHub.tsx`, `lib/oauth/popup.ts` |
| I-18 | `invalidateUserDiscovery` après initiateConnection + disconnectAccount | `lib/connectors/composio/connections.ts` |

---

### Assets — `assets` · P1

Spec : [docs/features/assets.md](../features/assets.md)

**Invariants** (résumé — 18, détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | Singleton store `storeAsset()` + `loadAssetById()` (pas de double-write) | `lib/assets/types.ts` |
| I-2 | `AssetKind` 9 valeurs figées | `lib/assets/types.ts` |
| I-3 | `StorageProvider` interface 7 méthodes obligatoires | `lib/engine/runtime/assets/storage/types.ts` |
| I-4 | 5 storage providers reconnus (local, r2, s3, hybrid, supabase) | `storage/index.ts` |
| I-5 | Boot-time precedence Supabase → R2/hybrid → local | `instrumentation.ts`, `storage/index.ts` |
| I-6 | Storage key format `{tenantId?}/{path}` + normalization stricte | `storage/types.ts` |
| I-7 | Hybrid : R2 source de vérité, local = cache | `storage/hybrid.ts` |
| I-8 | `AssetProvenance` JSONB (pas de table dédiée lineage) | `lib/assets/types.ts` |
| I-9 | `AssetVariant` parent-child via FK `asset_id`, status pending\|generating\|ready\|failed | `lib/assets/variants.ts` |
| I-10 | Variant gen : credits reserve atomique avant enqueue | `app/api/v2/assets/[id]/variants/route.ts` |
| I-11 | Insufficient credits → HTTP 402 | `app/api/v2/assets/[id]/variants/route.ts` |
| I-12 | Hard-delete + cache evict + storage cleanup async | `app/api/v2/assets/[id]/route.ts` |
| I-13 | Cleanup scheduler TTL 30j default + dry-run mode | `lib/engine/runtime/assets/cleanup/` |
| I-14 | Document upload PDF only (`application/pdf`) | `app/api/v2/documents/upload/route.ts` |
| I-15 | Detail resolution order : runs in-mem → runs persisted → assets table | `lib/engine/runtime/assets/detail.ts` |
| I-16 | Variant kinds v1 : audio + video uniquement | `app/api/v2/assets/[id]/variants/route.ts` |
| I-17 | Hard scope check sur endpoints `[id]` → 404 (pas 403) | `app/api/v2/assets/[id]/*` |
| I-18 | `contentRef` flexible : text brut OU JSON `{narration, payload}` | `lib/assets/types.ts`, viewers |

---

### Missions — `missions` · P1

Spec : [docs/features/missions.md](../features/missions.md)

**Invariants** (résumé — 18, détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | Schéma `scheduler_leases` figé (key PK, instance_id, expires_at) | `supabase/migrations/0016`, `lib/engine/runtime/missions/distributed-lease.ts` |
| I-2 | 2 types de clés : `scheduler_leader` + `mission_run:<id>:<minute>` | `lib/engine/runtime/missions/distributed-lease.ts`, `leader-lease.ts` |
| I-3 | TTL leader 90s (heartbeat 30s) + TTL mission 300s | `lib/engine/runtime/missions/leader-lease.ts`, `distributed-lease.ts` |
| I-4 | 4 guards anti-double-exécution dans l'ordre | `lib/engine/runtime/missions/scheduler.ts` |
| I-5 | Fail-open lease sur erreur DB (mieux risquer 1× double-exec que se bloquer) | `lib/engine/runtime/missions/distributed-lease.ts` |
| I-6 | Cron parser minimal `min h d m dow` (pas `*/N`) | `lib/engine/runtime/missions/scheduler.ts` |
| I-7 | Scheduler tick = 60s | `lib/engine/runtime/missions/scheduler.ts` |
| I-8 | `mission_messages` append-only (pas UPDATE/DELETE) | `supabase/migrations/0056`, `lib/memory/mission-context.ts` |
| I-9 | `DELETE /missions/[id]` hard-delete cascade | `app/api/v2/missions/[id]/route.ts` |
| I-10 | `POST /run` `maxDuration = 120s` | `app/api/v2/missions/[id]/run/route.ts` |
| I-11 | Status normalization `success | failed | blocked` (3 valeurs) | `lib/engine/runtime/missions/normalize-result.ts` |
| I-12 | Mission context = summary + 10 messages + retrieval + KG (fail-soft) | `lib/memory/mission-context.ts` |
| I-13 | `updateMissionContextSummary` via Claude Haiku, 4 sections 250 mots | `lib/memory/mission-context.ts` |
| I-14 | Auto-export Zod, format `pdf | excel`, email best-effort | `lib/engine/runtime/missions/export-job.ts` |
| I-15 | Webhooks `mission.completed | mission.failed` fire-and-forget | `lib/engine/runtime/missions/scheduler.ts` |
| I-16 | `/run` branch dual : workflowGraph C3 vs orchestrate legacy | `app/api/v2/missions/[id]/run/route.ts` |
| I-17 | Ownership check sur routes par-`[id]` | toutes les routes `/missions/[id]/*` |
| I-18 | Mission ID = UUID v4 (`randomUUID()`) | `lib/engine/runtime/missions/create-mission.ts` |

---

### Chat & Orchestration — `chat` · P0

Spec : [docs/features/chat.md](../features/chat.md)

**Invariants** (résumé — 18, détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | Endpoint `/api/orchestrate` SSE 300s + heartbeat 20s | `app/api/orchestrate/route.ts` |
| I-2 | Forme du payload entrant figée (mission_id refusé) | `app/api/orchestrate/route.ts` |
| I-3 | 11 SSE event types figés + heartbeat | `lib/engine/orchestrator/`, `app/(user)/components/ChatDock.tsx` |
| I-4 | Safety gate pre-LLM **obligatoire** sur tout LLM call | `lib/engine/orchestrator/safety-gate.ts` |
| I-5 | Mass action caps : >10 clarify, >50 refuse | `lib/engine/orchestrator/safety-gate.ts` |
| I-6 | Modèle par défaut `claude-sonnet-4-6` + prompt caching ephemeral 5min | `lib/engine/orchestrator/system-prompt.ts`, `ai-pipeline.ts` |
| I-7 | 12 catégories de tools assemblés | `lib/engine/orchestrator/ai-pipeline.ts` |
| I-8 | Abort registry pattern figé + idempotence | `lib/engine/orchestrator/abort-registry.ts`, `app/api/orchestrate/abort/[runId]/route.ts` |
| I-9 | `runtime.events` cap 50 newest-first | `stores/runtime.ts` |
| I-10 | ChatActionReceipts utilise `lastRunId` (pas `currentRunId`) | `app/(user)/components/ChatActionReceipts.tsx`, `ChatConnectInline.tsx`, `ChatMissionRunInline.tsx` |
| I-11 | `stage_request` event passe par `setModeFromTool` (guard 10s) | `app/(user)/components/ChatDock.tsx` |
| I-12 | Tool stream dedupe par `stepId` | `app/(user)/components/chat/chat-tool-stream-reducer.ts` |
| I-13 | WorkingDocument volatile (pas de persist) | `stores/working-document.ts` |
| I-14 | ChatContext chips persisted localStorage `hearst-chat-context` | `stores/chat-context.ts` |
| I-15 | Editorial blocks 6 types détectés | `app/(user)/components/chat/Block.tsx` |
| I-16 | ChatDock submit history limité 10 derniers | `app/(user)/components/ChatDock.tsx` |
| I-17 | `attached_asset_ids` par référence (pas inlined) | `app/(user)/components/ChatDock.tsx`, `ChatInput.tsx` |
| I-18 | ApprovalInline obligatoire pour writes (pas de bypass UI) | `app/(user)/components/ApprovalInline.tsx`, backend write tools |

---

### Stage System — `stage` · P0

Spec : [docs/features/stage.md](../features/stage.md)

**Invariants** (résumé — détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | `StageMode` discriminated union, 11 modes figés | `stores/stage.ts`, `app/(user)/components/Stage.tsx` |
| I-2 | `Stage.tsx` est l'unique router (pas de fork V2), default = `null` | `app/(user)/components/Stage.tsx` |
| I-3 | Tool override guard 10s (`TOOL_OVERRIDE_GUARD_MS`) | `stores/stage.ts` |
| I-4 | History stack cap 20 FIFO | `stores/stage.ts` |
| I-5 | Pas de persistance — chaque mount = `cockpit` | `stores/stage.ts` |
| I-6 | `lastAssetId` / `lastMissionId` mis à jour automatiquement par `setMode` | `stores/stage.ts` |
| I-7 | Pin-based focal lock (`pinnedFocalKey`) | `stores/focal.ts` |
| I-8 | `isValidContent()` filtre patterns d'erreur | `stores/focal.ts` |
| I-9 | Stage-data mirror pattern : sous-Stages écrivent leur snapshot | `stores/stage-data.ts`, sous-Stages |
| I-10 | `STAGE_HOTKEYS` ⌘0..9 figé | `stores/stage.ts`, `app/hooks/use-global-hotkeys.ts`, `components/MobileBottomNav.tsx` |
| I-11 | `mapFocalObject()` validateur unique pour focals API | `lib/core/types/focal.ts` |
| I-12 | `FocalObject` : 10 types + 8 statuts figés | `lib/core/types/focal.ts` |
| I-13 | Bundle statique des 11 sous-Stages (no React.lazy) | `app/(user)/components/Stage.tsx` |
| I-14 | Pas d'animation wrappers sur changement de mode | `app/(user)/components/Stage.tsx` |
| I-15 | Cytoscape `ssr: false` (seule exception au bundle statique) | `app/(user)/components/stages/KnowledgeStage.tsx` |

---

### Cockpit — `cockpit` · P1

Spec : [docs/features/cockpit.md](../features/cockpit.md)

**Invariants** (résumé — détails dans la spec) :

| # | Invariant | Chemins surveillés |
|---|-----------|---------------------|
| I-1 | Contrat endpoint `GET /api/v2/cockpit/today` (auth, runtime, output) | `app/api/v2/cockpit/today/route.ts` |
| I-2 | Philosophie fail-soft : toute source via `safe<T>()` | `lib/cockpit/today.ts` |
| I-3 | Honest empty state (pas de mock fallback Phase B3) | `lib/cockpit/agenda-live.ts`, `lib/cockpit/watchlist-live.ts` |
| I-4 | Cache 5min `(userId, tenantId)` sur live providers | `lib/cockpit/agenda-live.ts`, `lib/cockpit/watchlist-live.ts` |
| I-5 | Stage routing via `useStageStore.current.mode === "cockpit"` | `app/(user)/components/stages/CockpitStage.tsx`, `stores/stage.ts` |
| I-6 | Spline scene URL + `SplineErrorBoundary` obligatoire | `app/(user)/components/cockpit/HaloAgentCore.tsx` |
| I-7 | Mapping agents → routes (pilot, scribe, delve, pulse, warden, cortex) | `app/(user)/components/cockpit/HaloAgentCore.tsx` |
| I-8 | RSC prefetch + client refetch au mount | `app/(user)/page.tsx`, `app/(user)/components/stages/CockpitStage.tsx` |

**Composants orphelins** (non verrouillés tant que non câblés, mais câblage = update spec) :
- `HaloAgentCore.tsx`
- `QuickActionsGrid.tsx`
- `AgentsConstellation.tsx`
- `CockpitHero.tsx`

---

## Features non encore verrouillées

Les 30 autres features de l'inventaire restent en mode autonomie standard tant que leur spec n'est pas écrite. Ordre de priorité de verrouillage proposé :

1. ~~`auth` (P0)~~ — verrouillé v1.0
2. ~~`stage` (P0)~~ — verrouillé v1.0
3. ~~`chat` (P0)~~ — verrouillé v1.0
4. ~~`missions` (P1)~~ — verrouillé v1.0
5. ~~`assets` (P1)~~ — verrouillé v1.0
6. ~~`connections` (P1)~~ — verrouillé v1.0
7. ~~`reports` (P1)~~ — verrouillé v1.0
8. `memory-kg` (P1) — backfill destructif possible
9. `notifications` (P2) — throttle flood
10. (… reste à arbitrer)

## Chemins infrastructurels P0/P1 à surveiller (transversaux)

Ces chemins ne sont rattachés à aucune feature unique mais sont critiques. Listés ici pour mémoire — chaque feature concernée les référence dans sa spec.

| Chemin | Niveau | Pourquoi |
|--------|--------|----------|
| `lib/engine/orchestrator/` | P0 | Pipeline IA central, planner, safety gate |
| `lib/llm/router.ts` + `circuit-breaker.ts` + `rate-limiter.ts` | P0 | Routing toutes requêtes LLM |
| `lib/platform/auth/` | P0 | NextAuth, session, tokens, scope |
| `supabase/migrations/` | P0 | Irréversible en prod |
| `stores/stage.ts`, `stores/focal.ts`, `stores/runtime.ts` | P0 | État global UI |
| `lib/engine/runtime/missions/distributed-lease.ts` | P1 | Redis distributed lock — race conditions |
| `lib/connectors/composio/write-guard.ts` | P1 | Seule protection contre actions destructives IA |
| `lib/security/arcjet.ts` | P1 | Middleware global rate-limit / bot |
| `lib/engine/runtime/assets/storage/hybrid.ts` | P1 | Logique fallback R2 / Supabase / local |
| `lib/credits/middleware.ts` | P1 | Compteur consommation — faux positifs = UX brisée |
| `lib/reports/sharing/signed-url.ts` | P2 | Token public — sécurité |
| `lib/notifications/throttle.ts` | P2 | Flood possible si bypass |
