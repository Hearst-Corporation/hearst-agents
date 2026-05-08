---
title: Cœur agentique Hearst OS — état réel
date: 2026-05-08
revisions:
  - 2026-05-08 — v1 audit initial
  - 2026-05-08 — v2 nuances Adrien : vision vs specs vs runtime, P0 sécu/fiabilité promus
type: audit read-only, factuel
modifications: aucune
---

# Cœur agentique — comment ça marche, ce qui marche, ce qui ne marche pas

> Document factuel. Chaque affirmation est sourcée par un chemin:ligne. Je ne propose rien, je décris l'état du moteur tel qu'il tourne aujourd'hui.

---

## Verdict global (v2)

**Bonne base technique, écart fort entre vision, specs verrouillées et runtime réel.**

Trois lectures à tenir simultanément :

1. **Cœur agentique = réel.** `orchestrate → runPipeline → runAiPipeline`, SSE, write-guard Composio principal, KG/retrieval, scheduler missions, browser loop — tout ça tourne.
2. **Vision produit = pas encore réalisée.** Ce qu'on raconte ("5 agents hospitality", système agentique premium multi-stage avec orchestration intelligente) est en grande partie une persona/vision. Le runtime hospitality contient 3 reports catalogue, 1 config vertical, 2 templates workflow — pas 5 agents runtime spécialisés.
3. **Vrais P0 = sécurité/fiabilité, pas UX.** Planner peut retourner `completed` sans avoir tout exécuté, des writes contournent le write-guard, `/api/orchestrate` n'a quasi pas de tests, specs verrouillées et README ne reflètent plus le runtime. Le bug "report JSON brut" est réel mais P1 user-visible — pas le plus dangereux.

Le **TL;DR par domaine** ci-dessous décrit l'état technique pur. La section **"P0 sécurité / fiabilité"** plus bas pose les vraies priorités.

---

## TL;DR — statut par domaine

| Domaine | Statut | Détail |
|---|---|---|
| Chat / SSE | **Marche** | Heartbeat 20s, abort signal, cache prompt 5min |
| Orchestrator (routing) | **Marche** | Capability-first, research intent → workflow auto |
| Meta-tools (4) | **Marche** | request_connection, create_scheduled_mission, create_artifact, propose_report_spec |
| Safety gate | **Marche** | Hostile/illegal/injection filtrés, mass-action capé 10/50 |
| Reports catalogue (`propose_report_spec`) | **Marche** | Rendu via `ReportLayout` grid 4-col |
| **Reports recherche libre** ("rapport sur X") | **CASSÉ (P1 UX)** | JSON brut affiché à l'écran — symptôme de l'écart spec/runtime (P0-D) |
| Scheduler missions | **Marche** | Tick 60s, leader lease, dedup UTC minute, distributed lease |
| Missions manual `/run` | **Marche** | Branch dual workflowGraph vs orchestrate, mission memory injectée |
| Workflows (BFS executor) | **Marche partiellement** | Approval gates émettent mais ne persistent pas l'état → resume manuel-only. **Cap 50 nodes silent** (cf. P0-A). |
| Assets (storage hybride) | **Marche** | R2/Supabase/local hot+cold, provenance complète |
| KG ingest | **Marche** | Throttle 5min/user, embed auto, fail-soft |
| Browser (Stagehand) | **Marche** | Playwright + agent loop, tests e2e présents |
| Meeting | **Partiel** | Webhook Calendly + debrief LLM OK, transcription temps-réel = stub |
| Voice | **Stub** | UI placeholder, backend non câblé |
| Artifact (`create_artifact`) | **Marche** | HTML iframe / markdown / code rendus correctement |
| Planner (B1 in-memory) | **Ambigu** | Gated par `HEARST_ENABLE_PLANNER` — defaut `false` en prod |

**Verdict technique** : le cœur tourne. La régression user-visible critique = reports recherche libre rendus en JSON brut. **Mais** ce n'est pas le risque le plus dangereux — voir section P0 ci-dessous.

---

## P0 — Sécurité / fiabilité (vrais risques)

> Promus au-dessus du bug "report JSON". Ces 4 points peuvent corrompre des données, masquer des échecs, ou exposer la prod.

### P0-A — Planner peut simuler des succès

**Symptôme** : un workflow peut retourner `status: "completed"` sans avoir réellement exécuté tous ses nodes.

**Source** : [`lib/workflows/executor.ts:85`](lib/workflows/executor.ts#L85)
```ts
while (queue.length > 0 && visitedCount < maxNodes) {  // cap 50 par défaut
  // ...
}
// Si on sort par `visitedCount >= maxNodes`, pas d'événement workflow_failed.
callbacks.emitEvent({ type: "workflow_completed", ... });  // ligne 178-181
return { status: "completed", outputs, visitedCount };
```

Documenté explicitement comme intentionnel dans [`workflows.md` invariant I-3](docs/features/workflows.md) :
> *"Au-delà, l'executor s'arrête sans émettre `workflow_failed` — il retourne `completed` avec les outputs collectés. Ce cap évite les boucles infinies sur les graphes mal formés."*

**Risque réel** : un graphe complexe ou mal-formé qui touche le cap 50 nodes est rapporté comme succès. Auto-export PDF/Excel post-run se déclenche sur ce "succès". Les webhooks `mission.completed` sont émis. **Aucune trace user-visible que le run a été tronqué.**

**Aussi à considérer** :
- `onError: "skip"` ([executor.ts:136-141](lib/workflows/executor.ts#L136-L141)) émet `step_skipped` puis continue — un node critique skippé n'arrête pas le workflow.
- `executeWorkflowTool()` retourne `{ success: false, error: "tool_not_implemented" }` quand le handler manque ([workflows.md I-8](docs/features/workflows.md)) — bonne pratique, **mais** rien ne garantit que le caller du workflow inspecte ces `success: false` au lieu de regarder seulement le statut global.

---

### P0-B — Writes hors write-guard

**Le write-guard Composio** ([`lib/connectors/composio/write-guard.ts:26`](lib/connectors/composio/write-guard.ts#L26) `isWriteAction()`) couvre :
- ✅ Tools Composio wrappés via `to-ai-tools.ts` ([to-ai-tools.ts:50](lib/connectors/composio/to-ai-tools.ts#L50))
- ✅ Hint preview dans ai-pipeline ([ai-pipeline.ts:798](lib/engine/orchestrator/ai-pipeline.ts#L798))
- ✅ Reports cross-app via Composio ([reports/sources/composio.ts:35](lib/reports/sources/composio.ts#L35))
- ✅ Règle système prompt draft-first ([planner.ts:289](lib/engine/orchestrator/planner.ts#L289))

**Ne le couvrent pas** :

- ❌ **Workflow handlers** ont leur propre flag `_preview` indépendant ([slack-send-message.ts:30](lib/workflows/handlers/slack-send-message.ts#L30) : `const preview = args._preview === true || ctx.preview === true`). Si le caller (mission scheduler, manual `/run`, executor) ne passe pas `_preview: true`, **le slack message part directement** sans halo de safety. Idem pour [`pms-update-request-status.ts`](lib/workflows/handlers/pms-update-request-status.ts).
- ❌ **Meta-tools** (`create_artifact`, `create_scheduled_mission`, `propose_report_spec`, `request_connection`) — aucun check write-guard. La création de mission scheduled (donc d'effets récurrents) passe sans confirmation system-level (juste le system-prompt qui demande au LLM de drafter).
- ❌ **Hearst actions** (`buildHearstActionsTools`) — pas vu de check write-guard sur l'enveloppe. À auditer.
- ❌ **Native Google tools** (Gmail send, Calendar create) — wrapping écrit côté ai-pipeline mais pas vu passer par `isWriteAction`.

**Risque réel** : un mission scheduler qui exécute un workflow contenant un `slack_send_message` enverra le message en prod sans preview, sans approval cross-tenant, juste sur le contrat in-graph. Si la mission est créée par LLM via `create_scheduled_mission` (lui-même hors write-guard), la chaîne entière n'a aucun garde-fou system-level.

---

### P0-C — `/api/orchestrate` quasi pas de tests

**Source** : grep `__tests__/**/*.test.ts*` qui mentionne "orchestrate" → **1 seul fichier** : [`__tests__/chat/chat-regression.test.ts`](__tests__/chat/chat-regression.test.ts) (regression tests sur le chat).

**Aucun test direct** de [`app/api/orchestrate/route.ts`](app/api/orchestrate/route.ts) :
- Pas de test de validation du body (cap 50k, UUID asset_ids, scope)
- Pas de test du wrap heartbeat SSE
- Pas de test du dispatch vers `orchestrate(db, input)`
- Pas de test du chemin abort

**Et c'est l'entrée principale du système.** Toutes les missions, tous les chats user, tout le pipeline LLM passe par cette route. La couverture statique du fichier `ai-pipeline.ts` (1062 lignes) repose presque entièrement sur des tests indirects via fixtures.

**Conséquence pratique** : un changement sur le routing capability-first, le safety gate, le rate limit Arcjet, ou la signature des events SSE peut casser silencieusement le runtime sans qu'aucun test rouge ne s'allume. Le manifest indique 2260 cases de test mais ils sont concentrés sur engine/missions/assets — la frontière HTTP est sous-couverte.

---

### P0-D — Spec et README ne reflètent plus le runtime

**Trois écarts observés** (non exhaustif) :

1. **Specs verrouillées vs realité runtime sur Reports** : [`docs/features/reports.md`](docs/features/reports.md) décrit le format `__reportPayload: true` comme canonique, mais [`run-research-report.ts:209-220`](lib/engine/orchestrator/run-research-report.ts#L209-L220) produit un format alternatif sans marqueur. La spec est verrouillée v1.0 — donc **le runtime contredit la spec verrouillée** sans que personne ne l'ait flaggé.

2. **`AGENT-DRIVEN-DEV.md` ligne 200** : *"32/32 features verrouillées en 5 agents parallèles. 358 invariants."* — la phrase peut être lue comme "5 agents runtime hospitality". En réalité c'est *"5 agents Claude Code parallèles ont écrit la doc ADD"*. Distinction non explicite — induit en erreur.

3. **Tests doc vs tests disque** : manifest ([`docs/features/_manifest.json`](docs/features/_manifest.json)) annonce `testsManquants: 191` et `testsExistants: 1630` doc-side. Mais `actualTests.cases: 2260` sur disque. L'écart (~600 tests) suggère que la doc-side track imparfaitement le réel — soit beaucoup de tests existent hors invariants, soit le mapping est partiel.

**Risque** : un dev (humain ou agent) qui lit la spec verrouillée pour décider d'un comportement va décider sur la base d'un contrat fictif. C'est exactement ce qui s'est passé avec le bug reports : la spec dit "format `__reportPayload`", `tryParseReportPayload` applique cette spec strictement, mais le producteur runtime a divergé sans mise à jour de spec.

---

## Vision vs runtime — 5 agents hospitality

**Récit** : "Hearst OS est un système agentique premium multi-stage avec 5 agents hospitality spécialisés."

**Runtime hospitality réel** :
- ✅ 3 reports catalogue : [`hospitality-guest-satisfaction.ts`](lib/reports/catalog/hospitality-guest-satisfaction.ts), [`hospitality-revpar.ts`](lib/reports/catalog/hospitality-revpar.ts), [`hospitality-daily-brief.ts`](lib/reports/catalog/hospitality-daily-brief.ts)
- ✅ 1 vertical config : [`lib/verticals/hospitality/`](lib/verticals/hospitality/) (mock-data + index)
- ✅ 2 workflow templates : [`guest-arrival-prep.ts`](lib/workflows/templates/hospitality/guest-arrival-prep.ts), [`service-request-dispatch.ts`](lib/workflows/templates/hospitality/service-request-dispatch.ts)
- ⚠️ Pas d'agents runtime spécialisés (concierge, housekeeping, revenue, experience, front-desk, etc.)
- ⚠️ [`lib/agents/registry.ts`](lib/agents/registry.ts) + [`agent-selector.ts`](lib/agents/agent-selector.ts) sont des couches **génériques** de selection, pas un casting hospitality-specific.

**Ce que l'utilisateur voit dans `SystemGraph` (hexagone 3D)** : 6 agents génériques affichés. Pas de mapping clair vers une équipe hospitality identifiable.

**Conséquence** : le pitch "5 agents hospitality" n'a pas de contrepartie code. Pour le construire, il faudrait soit :
- Créer 5 agents spécialisés (instructions persona + tooling filtré + memory scoped) dans `lib/agents/`
- Ou clarifier que ce sont 5 *workflows hospitality* déclenchés par 1 agent généraliste — auquel cas il en manque 3 (on a 2 templates).

Tant que cet écart n'est pas adressé, **toute communication produit qui s'appuie sur "5 agents" promet quelque chose qui n'existe pas**.

---

## 1. Chat — `/api/orchestrate` → SSE → ChatDock

### Comment ça marche

1. `ChatDock.handleSubmit()` ([ChatDock.tsx:104-223](app/(user)/components/chat/ChatDock.tsx#L104-L223)) crée le thread si besoin, POST `/api/orchestrate` avec `{ message, surface, thread_id, conversation_id, history }`.
2. Route ([orchestrate/route.ts:72-150](app/api/orchestrate/route.ts#L72-L150)) valide scope, parse body (msg ≤50k chars, ≤5 asset_ids UUID), wrap stream avec heartbeat SSE (`: heartbeat\n\n` toutes les 20s).
3. `orchestrate(db, input)` ([orchestrator/index.ts:108-655](lib/engine/orchestrator/index.ts#L108-L655)) :
   - Hydrate conversationId (186-199)
   - Détecte schedule intent pré-LLM (227)
   - Resolve capability scope + execution mode (230-245)
   - Crée RunEngine + AbortController (254-281)
   - **Safety gate** (286-306) : refuse violent/harassment/illegal/injection, soft-cap mass actions >10, hard-cap >50
   - Persiste RunRecord memory + Supabase fire-and-forget
   - Dispatch (479-643) selon mode : reasoning (DeepSeek R1) / research / planner / `handleAiPipeline` (fallthrough)
4. `handleAiPipeline()` ([ai-pipeline.ts:401-1062](lib/engine/orchestrator/ai-pipeline.ts#L401-L1062)) :
   - Parallèlise discovery (Google native + Composio + briefing + KG + retrieved memory) (412-445)
   - Construit tool map unifié (460-562) avec **4 meta-tools** (522-562)
   - Build system prompt + cache `cache_control: ephemeral` 5min (702-708)
   - **`streamText()`** (697-721) : modèle `claude-sonnet-4-6`, temp 0.3, maxTokens 8k, `stopWhen: stepCountIs(10)`, abortSignal
   - Event loop (761-941) : `text-delta` → SSE `text_delta`, `tool-call`/`tool-result` avec validation Zod, détection loops (3 calls identiques → stop)
   - Post-stream (944-1062) : persist structured turn, KG ingest fire-and-forget, LTM embed fire-and-forget
5. Client `HomePageClient.tsx` ([261-288](app/(user)/HomePageClient.tsx#L261-L288)) consomme SSE : `run_started` (capture runId), `text_delta` (accumule + update message), `stage_request` (switch Stage), tous les autres → `addEvent()` timeline.

### Ce qui marche (preuves)

- ✅ **SSE bidirectional + heartbeat** : [orchestrate/route.ts:25-66](app/api/orchestrate/route.ts#L25-L66)
- ✅ **Scope validation** strict : [orchestrate/route.ts:74](app/api/orchestrate/route.ts#L74)
- ✅ **4 meta-tools enregistrés** : [ai-pipeline.ts:522-562](lib/engine/orchestrator/ai-pipeline.ts#L522-L562) — `request_connection`, `create_scheduled_mission`, `create_artifact`, `propose_report_spec`
- ✅ **Cache prompt 5min** : 60-80% input tokens économisés sur tour 2+
- ✅ **Loop detection** : hash canonique + compteur, stop après 3 calls identiques ([ai-pipeline.ts:801-832](lib/engine/orchestrator/ai-pipeline.ts#L801-L832))
- ✅ **Abort signal** : POST `/api/orchestrate/abort/[runId]` coupe streamText serveur + ferme reader client
- ✅ **Structured message memory** : ModelMessage persiste tool-call/result pour confirmation cross-turn ([ai-pipeline.ts:995-1010](lib/engine/orchestrator/ai-pipeline.ts#L995-L1010))
- ✅ **Async fail-soft** : Google/Composio/briefing/KG/LTM tous sans blocage si timeout

### Ce qui ne marche pas

- ⚠️ **Tool result Zod schema laxiste** : ne parse que `{ ok, errorCode?, error?, data? }`. Tool retournant `{ success: true }` passe comme invalide et émet warn sans retry.
- ⚠️ **Mass-action soft-cap UX** : verdict "clarify" pour >10 destinataires émet `text_delta` demandant confirmation, **mais pas de modal** — message peut se perdre dans le chat si user ne lit pas.
- ⚠️ **Composio discovery latency** : appel séquentiel `toAiTools()` peut retarder `streamText` start de 500-1000ms sur réseau lent.

### Ambigu

- ❓ **History cap = 20 derniers messages** ([ai-pipeline.ts](lib/engine/orchestrator/ai-pipeline.ts) — `getRecentMessages(conversationId, 20)`). Si user cite explicitement le tour 5 d'une conversation de 25, le modèle ne le voit pas.

---

## 2. Orchestrateur — routing + planner + decision tree

### Comment ça marche

**Resolution mode d'exécution** ([orchestrator/index.ts:230-245](lib/engine/orchestrator/index.ts#L230-L245)) :
- `resolveCapabilityScope(message, surface)` détecte le domain (finance/crm/ops/founder/etc.) et les capabilities applicables.
- `resolveExecutionMode()` retourne un mode : `direct_answer | tool_call | workflow | custom_agent | managed_agent`.
- Override automatique : si research intent détecté, `direct_answer` est promu en `workflow` (237-242).

**Path déterministe research** (non-LLM pour la décision de routing) :
- `isResearchIntent()` regex sur keywords : "recherche, cherche, actualité, rapport, benchmark, bitcoin, crypto, veille, compare, enquête, étude, résumé, latest"
- `isReportIntent()` : "rapport, analyse, étude, benchmark, document, synthèse, résumé, brief, veille, fais-moi un, génère, rédige, prépare"
- Si research && !schedule → `runResearchReport()` ([index.ts:598-606](lib/engine/orchestrator/index.ts#L598-L606))

**Schedule directive injection** ([index.ts:227-228](lib/engine/orchestrator/index.ts#L227-L228)) :
- Regex "tous les / chaque / cron / récurrent" → `input._scheduleDirective = true`
- System prompt force le LLM à appeler `create_scheduled_mission` sans hésiter

**Planner stack B1** (gated) :
- Si `HEARST_ENABLE_PLANNER=true` ET `isComplexIntent(message)` (>80 chars + keyword "plan/orchestre/compile/board pack") → `runPlannerWorkflow()` ([index.ts:613](lib/engine/orchestrator/index.ts#L613))
- Fail-soft : tout crash retombe sur `handleAiPipeline` (629-637)
- Workflow executor BFS stateless, cap 50 nodes ([executor.ts:50-187](lib/workflows/executor.ts#L50-L187))

### Ce qui marche

- ✅ **Capability-first router** : domain detection précise pour finance/crm/ops, tooling filtré accordingly
- ✅ **Research intent override** : auto-promotion `direct_answer → workflow` sans friction user
- ✅ **Schedule directive** : force LLM à appeler `create_scheduled_mission`, mission persistée + scheduler picks up
- ✅ **Workflow BFS** : stateless, 50-node cap empêche runaway, conditions `==/!=/</>=/<=/output.X.Y/littéraux`

### Ce qui ne marche pas

- ⚠️ **Schedule detection trop agressif** : la regex "tous les" matche "je veux **tous les** détails" (non-récurrent) → force schedule prompt → modèle confus.
- ⚠️ **Planner approval persistence absente** : `runPlannerWorkflow()` retourne status/outputs mais ne persiste pas le graph. Resume manuel via `/api/v2/workflows/[runId]/approve-node` est **audit-only** (lignes 20-24 d'[executor.ts](lib/workflows/executor.ts)) → workflows à approval bloqués si redémarrage instance.

### Ambigu

- ❓ **`HEARST_ENABLE_PLANNER` default** : non documenté dans `.env.example` ; en prod sans var explicite → `false`. À confirmer si tu veux du planner en prod.

---

## 3. Reports — engine + research + viewer

> **Section critique : c'est ici que le bug user-visible vit.**

### Deux producteurs, deux formats

**Producteur A — `propose_report_spec` / `runReport()` (catalogue cross-app)** :
- Meta-tool [ai-pipeline.ts:554-559](lib/engine/orchestrator/ai-pipeline.ts#L554-L559)
- LLM compose un `ReportSpec` JSON (meta + sources + transforms + blocks + narration)
- `runReport()` exécute déterministe, output `contentRef = JSON.stringify({ __reportPayload: true, ...payload })`
- ✅ **Marche** : rendu via `ReportLayout` (grid 4-col).

**Producteur B — `runResearchReport()` (recherche libre "rapport sur X")** :
- Path déterministe non-LLM ([run-research-report.ts:65-300](lib/engine/orchestrator/run-research-report.ts#L65-L300))
- Web search → synthesize markdown via Claude Haiku → PDF artifact async → persist asset
- contentRef généré aux [lignes 209-220](lib/engine/orchestrator/run-research-report.ts#L209-L220) :
  ```json
  {
    "payload": { "blocks": [], "generatedAt": 1778203281450 },
    "narration": "<markdown du rapport>",
    "research": { "query": "...", "sourcesCount": 5, "sources": [...] }
  }
  ```
- ❌ **Aucun marqueur `__reportPayload: true`**.

### Le consommateur

`AssetStage.AssetBody()` ([AssetStage.tsx:587-613](app/(user)/components/stages/AssetStage.tsx#L587-L613)) dispatche en 3 branches :

```ts
function AssetBody({ contentRef, title }) {
  const reportPayload = tryParseReportPayload(contentRef);  // ← branch 1
  if (reportPayload) return <ReportLayout payload={reportPayload} />;

  if (isHtmlContent(contentRef)) return <iframe srcDoc={contentRef} ... />;  // ← branch 2

  return <ResearchReportArticle content={contentRef} />;  // ← branch 3 (fallback)
}
```

`tryParseReportPayload()` ([content-parser.ts:54-63](lib/assets/content-parser.ts#L54-L63)) :
```ts
const parsed = JSON.parse(content);
return isReportPayload(parsed) ? parsed : null;  // requires __reportPayload === true
```

### Le bug, étape par étape

**User flow** : "Fais un rapport sur le bitcoin mining" → ouvrir l'asset généré.

1. `runResearchReport()` produit contentRef au format `{ payload, narration, research }` **sans marqueur** ([run-research-report.ts:209](lib/engine/orchestrator/run-research-report.ts#L209)).
2. User clique sur l'asset → `AssetStage` charge → appelle `AssetBody()`.
3. `tryParseReportPayload()` parse le JSON → `isReportPayload()` cherche `__reportPayload: true` → **absent** → retourne `null`.
4. `isHtmlContent()` regex sur `<html>/<body>/<div>` → **fail** (c'est du JSON, pas du HTML).
5. **Fallback `<ResearchReportArticle content={contentRef} />`** reçoit le JSON brut comme string et l'affiche tel quel.

**Conséquence** : Sur l'écran, l'utilisateur voit
```
{"payload":{"blocks":[],"generatedAt":1778203281450},"narration":"- Minage Bitcoin...","research":{"query":"..."...
```
au lieu d'un rapport mis en forme.

**Note importante** : [`AssetPreview.tsx:34-40`](app/(user)/components/AssetPreview.tsx#L34-L40) sait déjà extraire `narration` du JSON V2 (utilisé dans le right-panel/FocalStage). Mais **`AssetStage` ne réutilise pas cette logique** — il a son propre `AssetBody` qui ignore le format `narration`.

### Producteurs et consommateurs — vue d'ensemble

| Producteur | Format `contentRef` | Marqueur | Consommateur OK |
|---|---|---|---|
| `runReport()` (catalogue) | `{ __reportPayload:true, blocks, ... }` | ✅ | `ReportLayout` ✅ |
| `runResearchReport()` (recherche libre) | `{ payload, narration, research }` | ❌ absent | **fallback texte → JSON brut affiché** ❌ |
| `create_artifact` HTML | `<html>...</html>` | (HTML détecté par regex) | iframe sandbox ✅ |
| `create_artifact` text/markdown | string brut | (fallback) | `ResearchReportArticle` ✅ |
| Daily brief | `{ __reportPayload:true, ... }` | ✅ | `ReportLayout` ✅ |

### Ce qui marche

- ✅ **Reports catalogue** : `propose_report_spec` → `runReport` → asset avec marqueur → `ReportLayout` rend la grille
- ✅ **HTML artifacts** : iframe sandbox
- ✅ **PDF generation** : `runResearchReport` génère bien le PDF async, persisté dans `provenance.pdfFile`
- ✅ **Asset persistence** : `storeAsset()` cache mémoire + upsert Supabase fire-and-forget
- ✅ **ReportLayout live updates** : subscription Supabase realtime sur le payload

### Ce qui ne marche pas

- ❌ **Reports recherche libre rendus en JSON brut** (cf. détail ci-dessus)
- ❌ **`AssetPreview` et `AssetStage` divergent** : `AssetPreview` extrait `narration`, `AssetStage` ne sait pas le faire → connaissance dupliquée et perdue selon le contexte d'ouverture.
- ⚠️ **Reports recherche non-éditables** : `narration` est markdown libre, pas une structure de blocks → `ReportEditor` ne peut pas y appliquer ses outils.

---

## 4. Missions — scheduler + lease + execution

### Comment ça marche

**Init scheduler** ([scheduler-init.ts:155-197](lib/engine/runtime/missions/scheduler-init.ts#L155-L197)) :
- Boot via `instrumentation.ts`. Guard secondaire : `/api/orchestrate/route.ts:70` appelle `ensureSchedulerStarted()`.
- Singleton via `globalThis.__hearst_scheduler_started__` (anti hot-reload double-init).
- Si DB dispo → `tryAcquireSchedulerLeadership()`. Sinon (dev local) → assume leader (`local_fallback`).
- Heartbeat 30s renouvelle leader lease + cleanup leases expirées.

**Tick 60s** ([scheduler.ts:114-245](lib/engine/runtime/missions/scheduler.ts#L114-L245)) :
- Pour chaque mission `enabled` :
  1. Parse cron `"minute hour * * weekday"` (40-47)
  2. `shouldRunNow()` UTC (49-58)
  3. Guard 1 : leader lease (sinon skip tout le tick)
  4. Guard 2 : `triggeredThisMinute` set (in-process minute dedup)
  5. Guard 3 : `isMissionRunning()` (in-process overlap)
  6. Guard 4 : `tryAcquireMissionLease()` (Redis/DB distributed)
  7. `trigger(mission)` → `orchestrate(message=mission.input)` stream drain (130-145 init)
  8. Persist `lastRunAt` + `lastRunId` + status (178-183)
  9. Webhook `mission.completed` fire-and-forget (188-197)
  10. Auto-export si `autoExport.enabled` (199-212)
  11. Catch error → persist failure + webhook `mission.failed` (216-239)
  12. Release distributed lease (242)

**Manual trigger** `POST /api/v2/missions/[id]/run` ([run/route.ts:27-274](app/api/v2/missions/[id]/run/route.ts#L27-L274)) :
- Ownership scope.userId
- Load mission : memory first → Supabase
- **Branch dual** :
  - Si `mission.workflowGraph` présent → `executeWorkflow()` synchrone (82-143), retourne `{ status, outputs, error }`
  - Sinon → `orchestrate()` SSE stream consume to completion (175-214)
- Mission Memory (vague 9) : `getMissionContext()` injecte `summary + 10 messages + retrieval pgvector + KG snippet` comme bloc XML system (150-161)
- Append `mission_messages` (user + assistant), update `context_summary` async via Haiku (240-255), KG ingest fire-and-forget (260-266)

### Ce qui marche

- ✅ **Leadership lease** : DB-backed, heartbeat 30s, non-leader skip tick
- ✅ **4 guards anti-double-exécution** : leader + minute dedup + in-memory overlap + distributed lease
- ✅ **Distributed lease** : Redis/Supabase, TTL 300s, fail-open sur DB error
- ✅ **Cron minute+hour+weekday** parsé et appliqué UTC
- ✅ **Branch dual `/run`** : workflowGraph C3 ou orchestrate legacy
- ✅ **Mission memory** : context summary + retrieval + KG injectés au prompt
- ✅ **Webhooks fire-and-forget** : `mission.completed` / `mission.failed`
- ✅ **Auto-export PDF/Excel** post-run si configuré

### Ce qui ne marche pas

- ⚠️ **Cron format limité** : `parseSchedule()` ([scheduler.ts:40-47](lib/engine/runtime/missions/scheduler.ts#L40-L47)) ne supporte que `minute hour * * weekday`. Pas de `*/N`, pas de ranges (1-5), pas de listes (1,3,5), pas de day-of-month, pas de month-of-year. Les fréquences UI mappent vers daily/weekly/monthly fixes. → Un user qui veut "le 15 de chaque mois" ne peut pas l'exprimer.
- ⚠️ **Approval workflow non-resumable post-redémarrage** : `executeWorkflow` émet `awaiting_approval` mais ne persiste pas `{graph, outputs, awaitingNodeId}`. Si l'instance redémarre avant approval, le run est perdu (cf. [executor.ts:18-24](lib/workflows/executor.ts#L18-L24) commentaire produit explicite).
- ⚠️ **Webhook delivery best-effort** : pas de retry. Si endpoint downstream lent/down → silent failure.

### Ambigu

- ❓ **Local fallback (no DB)** : `assume leader` en dev sans DB. Comportement multi-instance local non vérifié.
- ❓ **Mission rehydration** : `getScheduledMissions()` chargé au boot. Si une mission est créée après boot, est-elle picked up sans redémarrage ? À tracer.

---

## 5. Assets — storage + variants + KG

### Comment ça marche

**Store** ([assets/types.ts:186-300](lib/assets/types.ts#L186-L300)) :
- Cache mémoire `Map<threadId, Asset[]>` (153)
- Pattern dual-write : `storeAsset()` ajoute au cache **immédiatement** (210-212) + upsert Supabase **async fire-and-forget** (221-234)
- Validation pré-DB : rejette title vide/Untitled (192-195), warn si userId manquant (202-207)
- Eviction : `evictAssetById()` retire de tous les caches thread + actions (161-178)

**Storage hybride** :
- Boot precedence (cf. invariant assets I-5) : R2 → Supabase storage → local FS
- R2 = source de vérité
- Hot+cold : cache mémoire (hot, par thread), DB pour cross-thread / cross-session

**Variants** : audio/video/code/image générés via `/api/v2/assets/[id]/variants` POST. AssetStage poll toutes les 4s ([AssetStage.tsx:122](app/(user)/components/stages/AssetStage.tsx#L122)) jusqu'à ready/failed.

**KG ingest** ([kg-ingest-pipeline.ts:54-150](lib/memory/kg-ingest-pipeline.ts#L54-L150)) :
- `fireAndForgetIngestTurn()` fire-and-forget (144-150)
- Throttle : 1 ingest max/userId/5min
- Min thresholds : user msg ≥50 chars, assistant reply ≥200 chars
- Extraction Claude Haiku sur texte mergé (≤6k chars) → entities + relations
- Persist `upsertNode` + `upsertEdge` idempotent
- Auto-embed nodes via OpenAI (fail-soft si pas de clé)
- `__clearKgContextCache()` post-ingest (130)

### Ce qui marche

- ✅ **Hybrid storage** : cache hot + DB durable, R2 source de vérité
- ✅ **Provenance complète** : `derivedFrom, runId, missionId, sourceUrls, modelUsed, costUsd, latencyMs`
- ✅ **Thread-scoped + RLS** Supabase
- ✅ **KG auto-ingest** post-run, throttle 5min, fail-soft
- ✅ **KG embed auto** OpenAI optional

### Ce qui ne marche pas

- ⚠️ **Cache stale possible** : fire-and-forget upsert → si Supabase write fail, cache mémoire sert une donnée jamais persistée. `loadAssetsForThread()` hit DB directement (270) mais le right-panel client peut servir cache obsolète.
- ⚠️ **Variants polling agressif** : 4s, pas d'exponential backoff. Avec beaucoup d'assets en cours → cardinalité élevée.

---

## 6. Browser, Meeting, Voice, Artifact (résumé)

| Feature | Statut | Détail |
|---|---|---|
| **Browser** ([lib/browser/](lib/browser/)) | ✅ Marche | Playwright + Stagehand agent loop, cap 15 steps, abort sur 5 fails consécutifs. Tests e2e présents. |
| **Meeting** ([lib/meetings/](lib/meetings/)) | ⚠️ Partiel | Webhook Calendly + debrief LLM OK. Transcription temps-réel = stub. |
| **Voice** ([lib/voice/](lib/voice/)) | ❌ Stub | UI Stage placeholder. Backend STT/TTS non câblé. |
| **Artifact** (`create_artifact` tool, [ai-pipeline.ts:544-551](lib/engine/orchestrator/ai-pipeline.ts#L544-L551)) | ✅ Marche | HTML iframe, markdown, code, JSON report — tous rendus. |

---

## 7. Trace end-to-end — "Fais un rapport sur le bitcoin mining"

```
[CLIENT] ChatDock.handleSubmit(message)
  ChatDock.tsx:104-223 → POST /api/orchestrate

[SERVER] orchestrate/route.ts:72-150 → orchestrate(db, input)
  ├─ scope validation
  ├─ heartbeat SSE wrapper
  └─ orchestrator/index.ts:108-655

[SERVER] index.ts:230-245 — capability scope + execution mode
  ├─ schedule intent? non
  ├─ research intent? OUI (keyword "rapport")
  └─ promotion direct_answer → workflow (237-242)

[SERVER] index.ts:598-606 → runResearchReport()
  ├─ run-research-report.ts:67  query cleaning
  ├─ run-research-report.ts:92  web search
  ├─ run-research-report.ts:143 synthesize markdown via Haiku
  ├─ run-research-report.ts:190 PDF generation async
  └─ run-research-report.ts:209 contentRef = JSON.stringify({
       payload: { blocks: [], ... },
       narration: <markdown>,
       research: { query, sources }
     })  ← PAS DE MARQUEUR __reportPayload

[SERVER] events bus
  ├─ asset_generated
  ├─ focal_object_ready
  └─ run_complete

[CLIENT] HomePageClient.tsx:261-288 — SSE consumer
  ├─ run_started → capture runId
  ├─ text_delta → accumule narration dans message
  └─ asset_generated → store event

[CLIENT] User clic asset dans right-panel
  → AssetStage.tsx:146-189 → fetch /api/v2/assets/[id]
  → AssetBody({ contentRef })  ← AssetStage.tsx:587-613

[CLIENT] AssetBody dispatch (AssetStage.tsx:596-613)
  ├─ tryParseReportPayload() ← content-parser.ts:54-63
  │   parsed = JSON.parse(contentRef)  ✓ ok
  │   isReportPayload(parsed)?  ✗  __reportPayload absent
  │   return null
  ├─ isHtmlContent()  ✗  pas du HTML
  └─ FALLBACK: <ResearchReportArticle content={contentRef} />
       ← reçoit JSON string brut
       → render dans <pre> ou markdown
       → JSON BRUT À L'ÉCRAN  ❌
```

**Branche heureuse alternative** (si le marqueur était présent) :
```
tryParseReportPayload() → returns parsed
ReportLayout payload={parsed}
  → grid 4-col, blocks (vide ici), narration markdown rendue
  → rapport formaté ✅
```

---

## 8. Annexe — fichiers source de vérité

| Domaine | Fichiers clés |
|---|---|
| Chat / SSE | [`/app/api/orchestrate/route.ts`](app/api/orchestrate/route.ts), [`/app/(user)/HomePageClient.tsx`](app/(user)/HomePageClient.tsx), [`/app/(user)/components/chat/ChatDock.tsx`](app/(user)/components/chat/ChatDock.tsx) |
| Orchestrateur | [`/lib/engine/orchestrator/index.ts`](lib/engine/orchestrator/index.ts), [`/lib/engine/orchestrator/ai-pipeline.ts`](lib/engine/orchestrator/ai-pipeline.ts), [`/lib/engine/orchestrator/safety-gate.ts`](lib/engine/orchestrator/safety-gate.ts), [`/lib/engine/orchestrator/research-intent.ts`](lib/engine/orchestrator/research-intent.ts) |
| Reports | [`/lib/engine/orchestrator/run-research-report.ts`](lib/engine/orchestrator/run-research-report.ts), [`/lib/reports/engine/run-report.ts`](lib/reports/engine/run-report.ts), [`/lib/reports/spec/llm-tool.ts`](lib/reports/spec/llm-tool.ts), [`/lib/assets/content-parser.ts`](lib/assets/content-parser.ts), [`/app/(user)/components/ReportLayout.tsx`](app/(user)/components/ReportLayout.tsx), [`/app/(user)/components/stages/AssetStage.tsx`](app/(user)/components/stages/AssetStage.tsx), [`/app/(user)/components/AssetPreview.tsx`](app/(user)/components/AssetPreview.tsx) |
| Missions | [`/lib/engine/runtime/missions/scheduler.ts`](lib/engine/runtime/missions/scheduler.ts), [`/lib/engine/runtime/missions/scheduler-init.ts`](lib/engine/runtime/missions/scheduler-init.ts), [`/lib/engine/runtime/missions/distributed-lease.ts`](lib/engine/runtime/missions/distributed-lease.ts), [`/lib/engine/runtime/missions/leader-lease.ts`](lib/engine/runtime/missions/leader-lease.ts), [`/app/api/v2/missions/[id]/run/route.ts`](app/api/v2/missions/[id]/run/route.ts) |
| Workflows | [`/lib/workflows/executor.ts`](lib/workflows/executor.ts), [`/lib/workflows/handlers/index.ts`](lib/workflows/handlers/index.ts) |
| Assets / KG | [`/lib/assets/types.ts`](lib/assets/types.ts), [`/lib/memory/kg-ingest-pipeline.ts`](lib/memory/kg-ingest-pipeline.ts), [`/lib/memory/retrieval-context.ts`](lib/memory/retrieval-context.ts) |

---

**Fin du document. Aucune modification de code n'a été effectuée.**
