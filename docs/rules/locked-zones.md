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
4. `missions` (P1) — distributed lease Redis critique
5. `assets` (P1) — hybrid storage
6. `connections` (P1) — write-guard Composio
7. `reports` (P1) — sharing token public
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
