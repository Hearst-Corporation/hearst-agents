# Audit 3 — Magic numbers, code commenté, TODO, imports inutilisés

**Date** : 2026-05-16
**Auditeur** : Claude (Opus 4.7, READ-ONLY)
**Scope** : `lib/**`, `app/**`, `components/**`, `hooks/**`, `stores/**` (sauf spatial-safe, lab/cli-os, Apple-Vision-Pro-UI-Kit)
**Méthode** : `biome check` + grep ciblés + inspection manuelle

---

## Stats

| Catégorie | Count |
|---|---|
| Blocs code commenté à supprimer | **0** (aucun bloc de code mort commenté détecté — tous les `//` sont en prose explicative) |
| Imports inutilisés (in-scope) | **12** (18 au total dont 6 hors-scope `__tests__`/`lab`) |
| TODO/FIXME/XXX/HACK (in-scope) | **8** |
| Magic numbers candidates | **~40** (max_tokens, timeouts, limits, TTL) |
| console.log/info/debug oubliés (in-scope) | **~104** (dont 1 flagrant : `console.log("hello hearst")`) |
| Tests skipped | **64** (5 dans `__tests__` arcjet, 59 dans `e2e` — majoritairement env-gated, légitimes) |
| `@ts-ignore`/`@ts-expect-error` in-scope | **0** ✅ — Toutes occurrences sont dans `__tests__/` et justifiées par commentaire |
| Tables Supabase hardcodées (occurrences) | **248** distribuées sur ~30 tables (top : `runs`=20, `assets`=19, `user_tokens`=10) |

---

## Section 1 — Code commenté à supprimer

### Verdict : aucun bloc de code mort trouvé dans le scope.

L'inspection des patterns `// const X = `, `// function X(`, `// import X`, `// return X`, `// await X`, etc. ne ramène que des **commentaires en prose** (JSDoc, explications de design, références croisées).

Exemples (tous légitimes, **ne pas toucher**) :

| file:line | Nature |
|-----------|--------|
| `lib/env.server.ts:79-80` | Commentaire expliquant pourquoi un marker export est nécessaire (isolatedModules) |
| `lib/tools/native/missions.ts:481-482` | Commentaire de section décrivant `export_asset_pdf` |
| `lib/voice/tools.ts:95-96` | Note critique sur le `await` (FK contrainte) |
| `lib/assets/types.ts:179-181` | Justification de la validation au lieu du filtering |
| `app/hooks/use-global-hotkeys.ts:46-48` | Note sur la prio des hotkeys |
| `lib/notifications/channels.ts:207` | Bout de phrase au début "interface claire et un stub..." (commentaire JSDoc multiligne, RAS) |

**Recommandation** : **rien à faire** dans cette section. Le repo est propre côté code mort commenté.

---

## Section 2 — Imports/variables inutilisés (in-scope)

Biome détecte **12** findings dans le scope d'audit. Tous **FIXABLE** automatiquement via `biome check --write`.

### Imports inutilisés (8)

| ID | file:line | Symbole | Recommandation |
|----|-----------|---------|----------------|
| U1 | `lib/assets/types.ts:148` | `SupabaseClient` (type-only) | Supprimer — pas référencé après refactor |
| U2 | `lib/assets/variants.ts:10` | `SupabaseClient` | Supprimer |
| U3 | `lib/credits/client.ts:11` | `SupabaseClient` | Supprimer |
| U4 | `lib/daily-brief/store.ts:10` | `SupabaseClient` | Supprimer |
| U5 | `lib/engine/runtime/assets/dedup.ts:2` | `SupabaseClient` | Supprimer |
| U6 | `lib/inbox/store.ts:12` | `SupabaseClient` | Supprimer |
| U7 | `lib/platform/auth/user-resolver.ts:21` | `SupabaseClient` | Supprimer |
| U8 | `lib/engine/orchestrator/planner.ts:25-27` | `PLAN_TOOL`, `REQUEST_CONNECTION_TOOL`, `RESPOND_TOOL` | Supprimer (refactor post-orchestrator) |

**Pattern** : 7/8 imports inutilisés sont du `type { SupabaseClient }` resté après refactor où le type a été retiré des signatures. Cleanup mécanique.

### Variables inutilisées (4)

| ID | file:line | Symbole | Recommandation |
|----|-----------|---------|----------------|
| V1 | `app/(user)/_stages/BrowserStage.tsx:431` | `setSteps` (state setter) | Le state `steps` est utilisé, mais `setSteps` jamais. **Soit retirer le state entier** (si dead), **soit le brancher** sur l'observation BrowserStep réelle |
| V2 | `app/(user)/cockpit-x/CockpitXClient.tsx:57` | `chatRunState` | Sélecteur store déclaré mais jamais lu. Supprimer la ligne |
| V3 | `lib/credits/client.ts:50` | `reserveCredits` (function entière non exportée) | Fonction privée jamais appelée. Vérifier si appelée via tests ou planning futur, sinon supprimer |
| V4 | `lib/engine/orchestrator/ai-pipeline.ts:126` | `openaiWithReasoning` (helper) | Helper LM jamais utilisé. Idem : dead code ou featureflag pending ? |

**Hors scope mais détecté** (à laisser aux owners tests/lab) :
- `__tests__/llm/circuit-breaker-redis.test.ts:93` — `breaker2`
- `__tests__/llm/kimi.test.ts:14` — `makeHeadersMock`
- `__tests__/observability/health.test.ts:8` — `vi`
- `__tests__/security/arcjet.test.ts:130` — `ip`
- `__tests__/security/budget-race.test.ts:2` — `guardAndReserveCredits, settleCredits`
- `lab/cli-os/src/scenes/ChartsScene.tsx:1` — `AnimatePresence, useMotionValue, useSpring`

**Action recommandée** : `npm run lint:fix` (préfixe `_` pour vars, supprime imports). Pour V1/V3/V4, **revue manuelle** avant — c'est peut-être du WIP non terminé.

---

## Section 3 — TODO/FIXME (échantillon complet — 8 occurrences)

| ID | file:line | Marqueur | Note | Statut probable |
|----|-----------|----------|------|-----------------|
| T1 | `lib/admin/health.ts:17` | TODO | "Hume reste TODO" (Stream D PDL gardé, Hume pas branché) | **actif** — décision pending Hume |
| T2 | `lib/admin/health.ts:758` | TODO | Doublon de T1 (commentaire de section) | actif (corollaire T1) |
| T3 | `lib/engine/runtime/missions/export-job.ts:140` | TODO | "brancher sur lib/engine/runtime/assets/ quand le store assets" | **actif** — dépend du flag "store assets" maturity |
| T4 | `lib/engine/runtime/delegate/api.ts:397` | TODO | "web_search tool format Anthropic non compatible OpenAI/Kimi" | **actif** — post-migration Anthropic deprecated (cf commit `feb6e442`), à revisiter |
| T5 | `app/admin/health/page.tsx:29` | TODO (ref) | Référence cross-fichier vers T1/T2 | informatif |
| T6 | `app/(user)/_stages/BrowserStage.tsx:10` | TODO (ref) | "voir TODO" — référence interne vers branchement futur | informatif |
| T7 | `app/(user)/_stages/MissionStage.tsx:349` | TODO(P5) | "scroll-to-steps ou drawer de relai étape par étape" | **P5 = lointain**, OK garder |
| T8 | `stores/focus-mode.ts:17` | TODO bonus | "Mission context (TODO bonus) : si une mission est active" | bonus, OK garder |

**Recommandation** :
- Aucun TODO/FIXME orphelin obsolète détecté
- 4 sont actifs (T1, T3, T4, T7) — laissés en l'état
- 4 sont des références informatives ou documentaires (T2, T5, T6, T8)
- **Pas de cleanup nécessaire** sur cette section. Volume très sain.

---

## Section 4 — Magic numbers à extraire en constantes

### 4.1 `max_tokens` LLM (25 occurrences hardcodées)

Toutes les valeurs `max_tokens` sont passées en clair aux providers. **Aucune constante centrale.**

| Valeur | Occurrences | Exemples |
|--------|-------------|----------|
| `4096` | 6 | `lib/engine/runtime/delegate/api.ts:392,410`, `lib/engine/orchestrator/run-research-report.ts:329`, `lib/engine/orchestrator/planner.ts:123`, `lib/admin/seed.ts:42`, `app/admin/agents/new/page.tsx:28` |
| `2048` | 1 | `lib/admin/seed.ts:57` |
| `8192` | 1 | `lib/admin/seed.ts:72` |
| `2000` | 2 | `lib/browser/agent-loop.ts:398`, `lib/browser/stagehand-executor.ts:508` |
| `1500` | 3 | `lib/inbox/inbox-brief.ts:222`, `lib/workflows/handlers/ai-draft-welcome-notes.ts:99`, `lib/meetings/debrief.ts:110` |
| `1200` | 1 | `lib/daily-brief/generate.ts:220` |
| `1024` | 4 | `lib/capabilities/providers/deepgram.ts:52`, `lib/admin/seed.ts:87`, `lib/browser/agent-loop.ts:464`, `app/api/v2/assets/diff/route.ts:162` |
| `600` | 1 | `lib/memory/mission-context.ts:409` |
| `500` | 1 | `lib/memory/briefing.ts:84` |
| `250` | 1 | `lib/memory/conversation-summary.ts:63` |
| `200` | 3 | `lib/capabilities/providers/video-prompt-enricher.ts:84`, `lib/workflows/handlers/ai-classify-priority.ts:82`, `lib/cockpit/pre-meeting-intel.ts:359` |
| `120` | 1 | `lib/cockpit/drift-detection.ts:179` |

**Recommandation** : créer `lib/llm/limits.ts` avec :
```ts
export const MAX_TOKENS = {
  ORCHESTRATOR: 4096,
  REPORT_LONG: 4096,
  BRIEF: 1500,
  CLASSIFICATION: 200,
  SUMMARY: 600,
  // ...
} as const;
```

### 4.2 Timeouts (multiplications de 30_000, 5_000, 60_000)

| Valeur | Occurrences | Type |
|--------|-------------|------|
| `30_000` (30s) | ~12 | Timeout HTTP externe — déjà `DEFAULT_FETCH_TIMEOUT_MS` à `lib/platform/fetch-timeout.ts:15` mais peu utilisé |
| `60_000` (1min) | ~14 | Cache TTL, rate window, intervals — chaque fichier redéfinit son constant local |
| `5_000` (5s) | ~10 | HTTP rapide (webhooks, moderation, integrations) — `CHANNEL_HTTP_TIMEOUT_MS`, `HTTP_TIMEOUT_MS`, `MODERATION_TIMEOUT_MS` chacun défini séparément |
| `5 * 60_000` (5min) | 2 | TTL cache moyens (`agenda-live`, `composio/discovery`) |
| `30 * 60_000` (30min) | 1 | `composio/apps:68` CATALOG_TTL |
| `60 * 60_000` (1h) | 3 | `monthly-card`, `today INBOX_STALE`, `drift NARRATION_TTL` |

**Recommandation** : créer `lib/platform/durations.ts` :
```ts
export const MS = {
  SECOND: 1_000,
  FIVE_SECONDS: 5_000,
  THIRTY_SECONDS: 30_000,
  MINUTE: 60_000,
  FIVE_MINUTES: 5 * 60_000,
  HOUR: 60 * 60_000,
} as const;
```
Bénéfice : grep `MS.HOUR` plus parlant que `3_600_000` ou `60 * 60_000`.

### 4.3 Coûts USD hardcodés (7 occurrences)

| file:line | Valeur | Contexte |
|-----------|--------|----------|
| `lib/decisions/model-selector.ts:45` | `0.2` | `cost: 0.2` |
| `lib/voice/tools.ts:143` | `0.05` | `costUsd: 0.05` (TTS estimate) |
| `lib/engine/runtime/tracer.ts:95` | `0.8` | warning_threshold 80% du budget |
| `lib/engine/orchestrator/run-planner-workflow.ts:119,121` | `0.01`, `0.005` | Increments estimates |
| `lib/analytics/tool-ranking.ts:22` | `0.15` | cost weight |
| `lib/analytics/tool-ranking.ts:30` | `0.1` | high_avg_cost_usd threshold |

**Recommandation** : les coûts réels devraient venir de `lib/llm/usage-tracker.ts` ou `model_profiles` (DB). Les valeurs estimatives `0.2`, `0.05`, `0.01` méritent un fichier `lib/llm/cost-estimates.ts` documenté.

### 4.4 Query `.limit(N)` Supabase (~20 occurrences)

Limites de pagination hardcodées : `.limit(1)` (~10), `.limit(3/5/8/10/20/40/50/100/200/500/1000)` etc.

| Valeur | Sens probable | Recommandation |
|--------|---------------|----------------|
| `.limit(1)` | "fetch single most recent" | OK, idiome standard |
| `.limit(500)` x2 | `pre-meeting-intel:64`, `inbox-cron:54` | Pagination users actifs — devrait être `MAX_USERS_PER_TICK` |
| `.limit(1000)` | `assets/cleanup/scheduler.ts:120` | `batchSize: 1000` — devrait référencer une constante |

**Recommandation** : laisser `.limit(1)` partout, mais extraire les `500`+ en `MAX_USERS_PER_BATCH`, `MAX_CLEANUP_BATCH` dans chaque store concerné.

### 4.5 URLs hardcodées (111 occurrences, dont ~30 vraies bases d'API)

Pattern dominant : chaque provider externe a sa base URL déclarée localement.

Exemples :
| Provider | Définition | OK ? |
|----------|------------|------|
| `kimi.ts:36` | `"https://api.hypercli.com/v1"` (default) | ⚠️ — déjà fallback via `KIMI_BASE_URL` env, OK |
| `runway.ts:1` | `"https://api.runwayml.com/v1"` | OK, constante locale |
| `fal.ts:1` | `"https://fal.run"` | OK |
| `browserbase.ts:1` | `"https://www.browserbase.com/v1"` | OK |
| `heygen.ts:1` | `"https://api.heygen.com/v2"` | OK |
| `tavily.ts:46` | `"https://api.tavily.com/search"` | OK |
| `exa.ts:42` | `"https://api.exa.ai/search"` | OK |
| `apollo.ts:15` | `process.env.APOLLO_API_BASE ?? "https://api.apollo.io/api/v1"` | OK (env-overridable) |
| `pdl.ts:15` | idem | OK |
| `composer.ts:58,123` | `"https://api.cursor.com/v1"` (2 fois) | ⚠️ duplicat — extraire en constante module |
| `kimi.ts:28,36` | `"https://api.hypercli.com/v1"` (2 fois) | ⚠️ duplicat — idem |
| `admin/seed.ts:99,108,117,126,135,144,153,162` | URLs Composio `endpoint_url` répétées | OK (data de seed, par essence répétitive) |

**Recommandation** :
- Composer et Kimi : extraire chaque base en `const DEFAULT_BASE = ...` en haut du module (déjà fait dans `gemini.ts:20` `DEFAULT_GEMINI_HOST`).
- Pas de besoin de fichier central — chaque provider doit posséder sa propre constante.

### 4.6 Status strings (~150 occurrences)

Les valeurs `"success"`, `"failed"`, `"in_progress"`, `"pending"`, `"completed"`, `"running"`, `"idle"` apparaissent partout sans typage central.

**Hot spots** :
- `lib/voice/tools.ts` — 7+ usages
- `lib/llm/router.ts:216,245,461,495`
- `lib/tools/handlers/send-message.ts` — 6+ usages
- `lib/jobs/inngest/functions/*` — usages multiples
- `lib/cockpit/today.ts:41` — union type local

**Recommandation** : créer `lib/core/types/status.ts` avec union exporté + const map :
```ts
export const RunStatus = {
  IDLE: "idle",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  // ...
} as const;
export type RunStatusValue = typeof RunStatus[keyof typeof RunStatus];
```
Bénéfice énorme : refactor sécurisé, autocomplete, single source of truth.

### 4.7 Tables Supabase (248 occurrences hardcodées)

Top 10 tables par fréquence d'usage :
| Table | Occurrences |
|-------|-------------|
| `runs` | 20 |
| `assets` | 19 |
| `user_tokens` | 10 |
| `kg_edges` | 10 |
| `run_steps` | 9 |
| `kg_nodes` | 9 |
| `scheduler_leases` | 8 |
| `mission_approvals` | 8 |
| `integration_connections` | 8 |
| `agent_memory` | 8 |

**Recommandation** : créer `lib/platform/db/tables.ts` :
```ts
export const TABLE = {
  RUNS: "runs",
  ASSETS: "assets",
  USER_TOKENS: "user_tokens",
  KG_EDGES: "kg_edges",
  // ...
} as const;
```
Bénéfice : refactor rename mécanique, type-safety via `Database['public']['Tables']`.

⚠️ Note : la prioritisation dépend du risque. Renommer une table = migration SQL ; mais avoir une constante évite les typos qui passent en review.

---

## Section 5 — console.log à remplacer par logger (~105 occurrences)

Le repo a `lib/observability/logger.ts` (logger structuré officiel), mais **104 `console.{log,info,debug}`** persistent dans les surfaces de prod.

### 🚨 Findings critiques

| ID | file:line | Note |
|----|-----------|------|
| C1 | `app/(user)/components/stages/ArtifactStage.tsx:38` | **`console.log("hello hearst")` — oubli évident, à supprimer immédiatement** |
| C2 | `lib/env.server.ts:54,60` | `console.log("[ENV] ...")` — startup diagnostics, OK en l'état mais migrer logger pour consistency |

### Hot spots (par module)

| Module | Count | Recommandation |
|--------|-------|----------------|
| `lib/engine/runtime/missions/scheduler*.ts` | 16 | Logger structuré — c'est de l'observabilité production |
| `lib/jobs/**` (workers, inngest, scheduled) | ~30 | Idem — migrer vers `logger.info({ module: "jobs", ... })` |
| `lib/engine/runtime/assets/cleanup/*` | 8 | Idem |
| `app/api/v2/**` (routes API) | ~20 | Logger structuré pour traçabilité requêtes |
| `lib/engine/orchestrator/*` | 6 | Idem |
| `lib/connectors/composio/*` | 4 | Logger info |
| `lib/observability/langfuse.ts` | 2 | Auto-référent (init du tracer), OK |
| `lib/runtime/hmr-cleanup.ts` | 1 | Dev-only, OK |

### Cas où console.* est OK

| file:line | Justification |
|-----------|---------------|
| `hooks/spatial/useSplineApp.ts:69,81` | `console.debug` no-op visuel pour debug Spline, OK |
| `lib/env.server.ts:54,60` | Boot diagnostic — apparaît une fois |
| `lib/runtime/hmr-cleanup.ts:40` | Dev HMR — pas en prod |

**Recommandation** :
1. **Supprimer immédiatement** : `app/(user)/components/stages/ArtifactStage.tsx:38` (`hello hearst`)
2. **Migrer batch** : ~95 console restants → `logger.info/warn/error` avec contexte structuré
3. **Garder en l'état** : ~5 cas dev-only ou boot-only

---

## Section 6 — Tests skipped (64 occurrences)

### Par fichier

| Fichier | Skipped | Pattern |
|---------|---------|---------|
| `__tests__/security/arcjet.test.ts` | **5** | `it.skip(...)` — tests rate-limit prod-only (env-gated) |
| `e2e/reports/share.spec.ts` | 11 | `test.skip(true, "Bouton Partager absent")` — feature pas branchée au layout |
| `e2e/reports/export.spec.ts` | 11 | `test.skip(true, "Bouton Exporter absent")` — idem |
| `e2e/reports/discovery.spec.ts` | 6 | `test.skip(true, "Auth requise")` — env-gated |
| `e2e/reports/editor.spec.ts` | 6 | `test.skip(true, "Bouton Éditer absent")` — feature pas branchée |
| `e2e/run-mission.spec.ts` | 4 | `test.skip(...)` — `HEARST_E2E_MISSION_NAME` env requis |
| `e2e/auth/uuid-cleanup.spec.ts` | 2 | `test.skip(!process.env.HEARST_E2E_RUN_AUTH)` |
| Autres e2e (api-auth, daily-brief, happy-path, etc.) | ~19 | Mix env-gates + features absentes |

### Statut

| Catégorie | Count | Action |
|-----------|-------|--------|
| **Skips légitimes env-gated** (auth requis, env var requis, prod-only) | ~30 | OK garder |
| **Skips "feature absente"** (bouton non branché, asset non passé) | ~25 | ⚠️ — soit la feature est désormais branchée → réactiver, soit la spec est obsolète → supprimer |
| `__tests__/security/arcjet.test.ts` x5 | 5 | Tests rate-limit — ces 5 `it.skip` ont commentaire explicite "nécessite runtime Arcjet réel" → OK garder |

**Recommandation** :
- Revue ciblée du fichier `e2e/reports/share.spec.ts` et `export.spec.ts` (22 skips combinés) — vérifier si "Bouton Partager/Exporter absent" est encore vrai depuis le shell visionOS 12 stages (cf memory `project_shell_visionos_12stages_databound`)
- Pour les e2e env-gated : OK en l'état, c'est le pattern standard

---

## Section 7 — @ts-ignore / @ts-expect-error

### Verdict : **0 occurrence in-scope** ✅

Toutes les directives TS-ignore sont localisées dans `__tests__/` (10 occurrences total) et sont **justifiées par commentaire explicite** :

| file:line | Justification |
|-----------|---------------|
| `__tests__/providers/fal-prompt-enricher.test.ts:74` | "test runtime fallback" |
| `__tests__/api/meetings-webhook.test.ts:42,50,67,92,107` | "NODE_ENV est readonly côté NodeJS.ProcessEnv" |
| `__tests__/reports/spec-schema.test.ts:249` | "on teste qu'un fn invalide est rejeté à runtime" |
| `__tests__/reports/export/xlsx.test.ts:72,89,108` | "exceljs attend l'ancien Buffer non-générique, Node 22 retourne Buffer<ArrayBuffer>" |

**Recommandation** : **rien à faire**. Le respect des interdictions V1/V2/V3/V4 est complet sur les zones in-scope.

---

## Synthèse priorisée

### P0 — Quick wins immédiats (< 1h)
1. **Supprimer `console.log("hello hearst")`** à `app/(user)/components/stages/ArtifactStage.tsx:38`
2. **Lancer `npm run lint`** pour fixer les 12 imports/vars inutilisés in-scope (auto-fix sûr pour les imports type-only)
3. **Revue V1 (BrowserStage `setSteps`)** : determiner si dead state ou si à brancher

### P1 — Cleanup structurel (1-3 j)
4. **Migration `console.* → logger`** sur les 3 hot spots `lib/engine/runtime/missions/scheduler*`, `lib/jobs/**`, `app/api/v2/**` (~70 calls)
5. **Extraire `lib/llm/limits.ts`** pour les `max_tokens` (~25 occurrences)
6. **Extraire `lib/platform/durations.ts`** pour les timeouts (~40 occurrences répétitives)
7. **Extraire `lib/core/types/status.ts`** pour les status strings (~150 occurrences)

### P2 — Hygiène code (effort variable)
8. **Tables Supabase** : créer `lib/platform/db/tables.ts` — gros refactor (248 call sites) mais haute valeur typage
9. **Revue tests skipped** sur `e2e/reports/share.spec.ts` + `export.spec.ts` (22 skips combinés liés à features potentiellement branchées depuis)
10. **TODO T1/T4** : décider si on supprime Hume / migre `web_search` Anthropic (commit `feb6e442` a marqué Anthropic deprecated)

---

## Fichiers consultés (audit READ-ONLY)
- `lib/**` — 248 from() + 25 max_tokens + 40 timeouts + 104 console
- `app/**` — 21 console + 4 unused
- `components/**` — 0 finding direct
- `hooks/**` — 2 console.debug (justifiés)
- `stores/**` — 1 console.log (`stores/runtime.ts:121`)
- `__tests__/**`, `e2e/**` — analyse contextuelle (hors scope d'écriture mais infos rapportées)

**Aucun fichier modifié. Aucune zone `spatial-safe` touchée.**
