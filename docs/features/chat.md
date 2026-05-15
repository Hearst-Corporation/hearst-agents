# Chat & Orchestration — `chat`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `chat` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P0** — cœur du produit, régression silencieuse = expérience primaire cassée |

## Description

Cœur conversationnel et exécutif de Hearst OS. Côté frontend : ChatDock (orchestrateur SSE), ChatInput (saisie multi-fonction avec @mention, attachments, persona, génération média/code), ChatMessages (rendu blocks + tool calls inline + receipts), WorkingDocument (panneau side-by-side d'édition). Côté backend : un orchestrator unifié (`lib/engine/orchestrator/`) qui prend un message + contexte → applique un safety gate pre-LLM → route vers AI pipeline (streamText agentic, modèle Claude Sonnet 4.6) ou path déterministes (research report) → stream du résultat en SSE event-stream. Abort propagé via registry in-process et signal AbortController.

Le chat n'est pas qu'un fil de messages : il **exécute** des actions (Composio, Google, Hearst native, missions, KG, meetings, browser) avec approval flow pour les writes.

## Surface publique

### Composants UI Chat principaux
- [ChatDock.tsx](../../app/(user)/components/ChatDock.tsx) — orchestrateur SSE (POST `/api/orchestrate`, parse line-by-line, push events au runtime store)
- [ChatInput.tsx](../../app/(user)/components/ChatInput.tsx) — saisie : textarea, @mention typeahead, attachments (drag-drop assets), persona switcher, génération inline (image/audio/code/document)
- [ChatMessages.tsx](../../app/(user)/components/ChatMessages.tsx) — rendu user/assistant avec parsing `<think>`, blocks éditoriaux, ChatAssetCard pour assetRef, ConfirmActionChips, inline action cards
- [ChatToolStream.tsx](../../app/(user)/components/ChatToolStream.tsx) — live tool calls (running + completed, color-coded read/write)
- [ChatActionReceipts.tsx](../../app/(user)/components/ChatActionReceipts.tsx) — receipts persistants des writes complétées (utilise `lastRunId`, pas `currentRunId`)
- [ChatAssetCard.tsx](../../app/(user)/components/ChatAssetCard.tsx) — carte asset inline (click → setFocal + setStageMode asset)
- [ChatConnectInline.tsx](../../app/(user)/components/ChatConnectInline.tsx) — carte "Connexion requise" (POST `/api/composio/connect` → redirect)
- [ChatMissionRunInline.tsx](../../app/(user)/components/ChatMissionRunInline.tsx) — carte "Lancer mission ?" (POST `/api/v2/missions/[id]/run`)
- [ApprovalInline.tsx](../../app/(user)/components/ApprovalInline.tsx) — approval inline pour step write en attente

### Composants chat/ (éditorial)
- [chat/Block.tsx](../../app/(user)/components/chat/Block.tsx) — unité de contenu structuré + détection de type (section_heading, subsection_heading, paragraph, list, action_items, insight)
- [chat/BlockActions.tsx](../../app/(user)/components/chat/BlockActions.tsx) — barre d'actions hover (Expand, Mission, Asset, Edit, Refine)
- [chat/BlockEditor.tsx](../../app/(user)/components/chat/BlockEditor.tsx) — textarea fullbleed avec ESC/⌘Enter
- [chat/ContextChips.tsx](../../app/(user)/components/chat/ContextChips.tsx) — chips contexte au-dessus de ChatInput
- [chat/ConversationHeader.tsx](../../app/(user)/components/chat/ConversationHeader.tsx) — barre fixe titre éditable + lastActivity
- [chat/WorkingDocument.tsx](../../app/(user)/components/chat/WorkingDocument.tsx) — panneau side-by-side du chat (slide-in 200ms, max width `min(50%, 720px)`)
- [chat/chat-tool-stream-reducer.ts](../../app/(user)/components/chat/chat-tool-stream-reducer.ts) — `reduceToolEvents()` + `selectCompletedWrites()`

### Stage
- [stages/ChatStage.tsx](../../app/(user)/components/stages/ChatStage.tsx) — layout split (ChatMessages + WorkingDocument optionnel + FocalStage embed compact). Hotkey ⌘B toggle WorkingDocument. **Cf [docs/features/stage.md](stage.md) pour le routing global**.

### Endpoints API
- `POST /api/orchestrate` ([route.ts](../../app/api/orchestrate/route.ts)) — entry point chat. Auth `requireScope()`. Output : SSE ReadableStream (`text/event-stream`). Max duration **300s**.
- `POST /api/orchestrate/abort/[runId]` ([route.ts](../../app/api/orchestrate/abort/[runId]/route.ts)) — abort run. Auth `requireScope()`. Idempotent (200 OK même si runId inexistant).
- `POST /api/agents/[id]/chat` ([route.ts](../../app/api/agents/[id]/chat/route.ts)) — chat scoped agent (registry admin/agents). Distinct du chat user général.

### Stores
- [stores/runtime.ts](../../stores/runtime.ts) — events stream, currentRunId, lastRunId, coreState, abortController, currentPlan
- [stores/chat-context.ts](../../stores/chat-context.ts) — chips contexte (persisted localStorage `hearst-chat-context`)
- [stores/working-document.ts](../../stores/working-document.ts) — current working doc (volatile, pas de persist)

## Architecture interne

### Orchestrator (lib/engine/orchestrator/)

**API publique** : `orchestrate(db, input) → ReadableStream` ([index.ts](../../lib/engine/orchestrator/index.ts)).

**Pipeline** :
```
[POST /api/orchestrate]
  ↓ requireScope() → userId, tenantId, workspaceId
  ↓ orchestrate(db, input)
[create RunEventBus + SSEAdapter + LogPersister]
  ↓
[withHeartbeat (20s `: heartbeat\n\n`)]
  ↓ runPipeline async
  ├─ checkSafetyGate(message) → ok | refuse | clarify
  ├─ resolve memory (KG context, retrieval, conversation history)
  ├─ detect intent (research / write / schedule / agentic)
  ├─ route :
  │   ├─ runResearchReport(...)  ← deterministic path
  │   ├─ runPlannerWorkflow(...) ← legacy multi-step (HEARST_ENABLE_PLANNER)
  │   └─ runAiPipeline(...)      ← default streamText agentic
  └─ stream events vers SSEAdapter (controller.enqueue)
[finally] cleanup LogPersister, SSEAdapter close, eventBus destroy
```

### AI Pipeline (`ai-pipeline.ts`)

- Modèle : **`claude-sonnet-4-6`** via `createAnthropic(apiKey: process.env.ANTHROPIC_API_KEY)`
- `streamText({ model, system, messages, tools, maxSteps, abortSignal })`
- **Tools assemblés** :
  1. Composio discovered tools (filterToolsByDomain)
  2. Native Google (Gmail, Calendar, Drive)
  3. Hearst action tools
  4. Web search tools
  5. Market data tools
  6. Research tools
  7. Media tools (image/audio/video gen)
  8. KG query tools
  9. Mission tools
  10. Meeting tools
  11. **`request_connection(app, reason)`** → émet event `app_connect_required`
  12. **`create_scheduled_mission(name, schedule, description)`** → preview/confirm
- System prompt construit par `buildAgentSystemPrompt()` :
  - Persona (si personaId) + persona addon (slot constraints)
  - Connected apps context (Composio actions disponibles)
  - **Draft-first rule** pour writes
  - Editorial charter (tone FR)

### Format SSE (event-stream)

Toutes les events suivent : `data: {"type":"...", "run_id":"...", ...}\n\n`

| Event type | Payload |
|-----------|---------|
| `run_started` | `{ run_id }` |
| `text_delta` | `{ delta: string }` |
| `stage_request` | `{ stage: StagePayload }` (force change de mode UI — passe par tool override guard 10s du stage store) |
| `tool_call_started` | `{ step_id, tool, providerId?, timestamp }` |
| `tool_call_completed` | `{ step_id, tool, latencyMs?, costUSD?, providerId?, providerLabel? }` |
| `app_connect_required` | `{ app, reason }` (consommé par ChatConnectInline) |
| `mission_run_request` | `{ mission_id, mission_name, schedule_label?, match_kind }` (consommé par ChatMissionRunInline) |
| `approval_requested` | `{ stepId, preview, kind, providerId? }` (consommé par ApprovalInline) |
| `clarification_requested` | (set coreState `awaiting_clarification`) |
| `run_completed` | (set coreState `processing` puis `idle` 500ms après) |
| `run_failed` | `{ error }` |
| `: heartbeat` | comment-style, keep-alive 20s |

### Safety gate (`safety-gate.ts`)

`checkSafetyGate(message) → SafetyVerdict` appelé **avant tout LLM call**.

- 4 catégories de patterns : `VIOLENT_PATTERNS`, `HARASSMENT_PATTERNS`, `ILLEGAL_PATTERNS`, `EXFIL_PATTERNS` (prompt injection)
- Mass action caps : `>10` recipients = soft warn (`clarify`), `>50` = hard refuse
- Verdict : `{ kind: "ok" }` | `{ kind: "refuse"; reason; userMessage }` | `{ kind: "clarify"; reason; userMessage }`

### Abort registry (`abort-registry.ts`)

In-process `Map<runId, AbortController>`. Module-scope.

- `registerRun(runId, controller)` au lancement de l'orchestrator
- `abortRun(runId)` appelé par `POST /api/orchestrate/abort/[runId]` → `controller.abort()` → propage à `streamText`
- `unregisterRun(runId)` en `finally`
- Idempotent : abort sur runId inexistant retourne `false` mais ne throw pas
- **Single-instance only** : ne survit pas au load balancing multi-process

### Intents (détection rapide)

- `research-intent.ts` : `RESEARCH_PATTERNS` ("recherche", "rapport", "actualité", "tendance"…) → route vers `runResearchReport`
- `write-intent.ts` : `WRITE_VERBS_FR/EN` ("envoie", "créé", "send"…) sauf si `READ_HEDGES` ("résume", "liste"…) → influence le prompt
- `schedule-intent.ts` : `RECURRING_PATTERNS` ("tous les matins", "every week"…) sauf `ONE_SHOT_PATTERNS` ("une fois", "demain à 14h") → injecte forcing directive

### Reducer tool stream (`chat-tool-stream-reducer.ts`)

```ts
reduceToolEvents(events, runId) → ToolCallEntry[]
selectCompletedWrites(events, runId) → ToolCallEntry[]
```

- Walk events oldest-first (l'array runtime est newest-first)
- **Dedupe par `stepId`** : un seul `ToolCallEntry` par step (le `tool_call_completed` merge dans l'entry du `tool_call_started`)
- Status : `running` | `completed`
- Kind : `read` | `write`

### Runtime store (`stores/runtime.ts`)

| Champ | Détail |
|-------|--------|
| `events: StreamEvent[]` | Newest-first, **cap 50** |
| `coreState` | `idle | connecting | streaming | processing | error | awaiting_approval | awaiting_clarification` |
| `currentRunId` | Run en cours, null entre runs |
| `lastRunId` | **Persiste après run end** (utilisé par ChatActionReceipts, ChatConnectInline, ChatMissionRunInline) |
| `abortController` | AbortController du run en cours |
| `currentPlan` | PlanState multi-step (legacy planner B1, optionnel) |

Middleware : `subscribeWithSelector` pour selectors granulaires sans re-render global.

Event handlers internes :
- `run_started` → `coreState = "streaming"`, set currentRunId + lastRunId
- `run_completed` → `coreState = "processing"`, reset à `idle` après 500ms
- `run_failed` → `coreState = "error"`
- `approval_requested` → `coreState = "awaiting_approval"`
- `clarification_requested` → `coreState = "awaiting_clarification"`

### Submit flow (ChatDock)

```ts
1. controller = new AbortController(); setAbortController(controller)
2. POST /api/orchestrate, body = {
     message, surface, thread_id, conversation_id,
     history (10 derniers), attached_asset_ids?, persona_id?
   }, signal: controller.signal
3. Setup SSE reader (TextDecoder, buffer line-by-line)
4. For each line starting with "data: " → JSON.parse → addEvent(event)
   - Special handling: run_started (capture run_id), text_delta (append assistantBuffer),
     stage_request (call setModeFromTool — respecte le guard 10s du stage)
5. catch (signal.aborted | DOMException "AbortError") → silent stop
6. trackAnalytics("first_message_sent" | "run_completed" | "run_failed")
```

### Editorial blocks (`chat/Block.tsx`)

Détection de type :
1. `# ` au début → `section_heading`
2. `## ` au début → `subsection_heading`
3. `**Insight**` ou `**Recommandation**` → `insight`
4. Lignes uniquement `[x]` ou `[ ]` → `action_items`
5. Lignes uniquement `- ` ou `• ` → `list`
6. Sinon → `paragraph`

Click "Expand" sur un block émet `window.dispatchEvent(new CustomEvent("chat:expand-block", { detail: { id, title, content } }))` → `WorkingDocument.open()`.

### WorkingDocument

- Volatile : pas de persist (brouillon par session)
- Width : `min(50%, 720px)` — slide-in 200ms ease-out depuis droite
- Footer : "Sauvegarder comme asset" + "Convertir en mission" (stubs pour le moment)
- Hotkey ⌘B (global) toggle isOpen

### ChatContext store

- `chips: { id, label, kind, payload? }[]` (kinds : `topic`, `asset`, `mission`, `report`)
- **Persisted** localStorage clé `hearst-chat-context` (zustand persist middleware)
- Click sur un chip émet `window.dispatchEvent(new CustomEvent("chat-context:focus", { detail: { id, kind } }))`

### Variables d'env critiques

| Var | Required | Notes |
|-----|----------|-------|
| `ANTHROPIC_API_KEY` | ✅ | Modèle principal `claude-sonnet-4-6` |
| `COMPOSIO_API_KEY` | ✅ | Tools connectés (Gmail, Slack, etc.) |
| `OPENAI_API_KEY` | optionnel | Embeddings only |
| `HEARST_ENABLE_PLANNER` | optionnel | Active le legacy planner B1 multi-step |
| Auth vars | cf [auth.md](auth.md) | NEXTAUTH_SECRET, etc. |

## Data flow

### Submit → SSE → Render

```
[ChatInput onSubmit]
   ↓
[ChatDock.handleSubmit] AbortController + history(10) + attached_asset_ids
   ↓ POST /api/orchestrate (SSE)
[Server: orchestrate(db, input)]
   ├─ withHeartbeat (20s)
   ├─ checkSafetyGate → si refuse, émet run_failed
   ├─ runAiPipeline (streamText Claude Sonnet 4.6, tools chargés)
   └─ pour chaque event → controller.enqueue(`data: {...}\n\n`)
   ↓ stream
[ChatDock SSE reader] line buffer → addEvent(event) au runtime store
   ↓
[useRuntimeStore subscribers re-render]
   ├─ ChatMessages (text_delta accumulés dans assistantBuffer)
   ├─ ChatToolStream (reduceToolEvents)
   ├─ ChatActionReceipts (selectCompletedWrites avec lastRunId)
   ├─ ChatConnectInline / ChatMissionRunInline (lastRunId)
   └─ Stage store (stage_request → setModeFromTool guard 10s)
```

### Abort flow

```
[user click Stop]
   ↓ controller.abort()
[ChatDock fetch signal aborted] → POST /api/orchestrate/abort/[runId]
   ↓
[Server: abortRun(runId)] → registry.get(runId).abort()
   ↓
[streamText abortSignal triggers] → coupe stream Anthropic
   ↓ finally
[unregisterRun(runId)]
```

## Invariants verrouillés

Toute modification d'un point ci-dessous **exige une mise à jour de cette spec validée par Adrien**.

### I-1. Endpoint `POST /api/orchestrate`

- Auth : `requireScope()` (401 sinon)
- Output : `ReadableStream` SSE `text/event-stream`
- **`maxDuration = 300s`** (couvre research reports, browser tasks, video gen)
- Heartbeat `: heartbeat\n\n` toutes les 20s (anti-timeout proxy Cloudflare/Vercel/nginx)
- Pas de migration vers POST blocking, GraphQL, ou WebSocket sans spec

### I-2. Forme du payload entrant

```ts
{
  message: string;          // requis
  surface?: string;
  thread_id?: string;
  conversation_id?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  focal_context?: { id, objectType, title, status };
  attached_asset_ids?: string[];
  persona_id?: string;
}
```

`mission_id` **n'est pas accepté** par cet endpoint (passer par `POST /api/v2/missions/[id]/run` à la place). Tout ajout de champ = update spec.

### I-3. SSE event types figés

Liste exhaustive : `run_started`, `text_delta`, `stage_request`, `tool_call_started`, `tool_call_completed`, `app_connect_required`, `mission_run_request`, `approval_requested`, `clarification_requested`, `run_completed`, `run_failed`. Plus le commentaire `: heartbeat`.

Ajouter, renommer ou retirer un type = update spec + sync reducer + sync handlers UI.

### I-4. Safety gate pre-LLM obligatoire

`checkSafetyGate(message)` **doit** être appelé **avant tout LLM call** (planner, ai-pipeline, research). Pas d'exception.

4 catégories : `VIOLENT_PATTERNS`, `HARASSMENT_PATTERNS`, `ILLEGAL_PATTERNS`, `EXFIL_PATTERNS`. La liste de patterns peut être étendue ; retirer un pattern = update spec.

### I-5. Mass action caps

`>10` recipients → `clarify` (warn user, demande confirmation). `>50` → `refuse` (hard no).

Ces seuils sont figés. Tout assouplissement = update spec.

### I-6. Modèle par défaut `kimi-k2-5`

> **Override 2026-05-15** — switch provider de Anthropic Claude Sonnet 4.6 vers Kimi (Moonshot AI) K2.5.
> L'ancien invariant `claude-sonnet-4-6` est remplacé. Le provider est désormais configuré via
> `@ai-sdk/openai` avec `baseURL: https://api.moonshot.cn/v1`.
>
> Le prompt caching Anthropic (`cacheControl: ephemeral`) n'est pas supporté par Kimi
> et a été retiré du pipeline. Le cost tracking utilise le provider `"kimi"`.

Modèle de l'orchestrator (planner + ai-pipeline) : **`kimi-k2-5`**.

Changement de modèle = update spec. Le provider est branché via `lib/llm/pricing.ts` pour le cost tracking.

### I-7. Tools assemblés — 12 catégories

L'AI pipeline assemble **toujours** : Composio discovered + native Google + Hearst actions + web search + market data + research + media + KG + missions + meetings + 2 specials (`request_connection`, `create_scheduled_mission`).

Retirer une catégorie = update spec. Ajouter = OK si scope additionnel.

### I-8. Abort registry — pattern figé

`registerRun(runId, controller)` au début de l'orchestrate, `unregisterRun(runId)` en `finally`. Lookup via map module-scope.

`POST /api/orchestrate/abort/[runId]` reste **idempotent** (200 OK même si runId inexistant).

Si tu migres vers Redis-backed registry (multi-instance), update spec + plan de cohérence cross-instance.

### I-9. `runtime.events` cap 50, newest-first

Si tu modifies le cap ou l'ordre, tous les selectors et reducers vont casser. Le reducer `reduceToolEvents` walk **oldest-first** (inverse l'array).

### I-10. ChatActionReceipts utilise `lastRunId` (pas `currentRunId`)

Critique : les receipts doivent persister **après** la fin du run. ChatConnectInline et ChatMissionRunInline aussi.

Refactor qui basculerait vers `currentRunId` = bug silencieux : les cards disparaîtraient à la fin du run.

### I-11. `stage_request` event respecte le tool override guard

Le stage_request émis par le LLM passe par `setModeFromTool()` (cf [stage.md I-3](stage.md)). Le guard 10s anti-téléportation reste actif.

### I-12. Tool stream dedupe par stepId

Un seul `ToolCallEntry` par `step_id` dans le reducer. `tool_call_completed` merge ses metadata dans l'entry créée par `tool_call_started` du même `step_id`.

### I-13. WorkingDocument volatile, pas de persist

Brouillon par session. Pas de sauvegarde DB automatique. Les actions footer ("Sauvegarder comme asset", "Convertir en mission") sont les chemins d'export explicite.

Ajouter du persist auto = update spec (impact ergonomie + DB load).

### I-14. ChatContext chips persisted localStorage

Clé : `hearst-chat-context`. Persiste cross-session.

Migration vers Supabase = update spec + plan de migration localStorage existant.

### I-15. Editorial blocks — 6 types détectés

`section_heading`, `subsection_heading`, `paragraph`, `list`, `action_items`, `insight`. Détection par préfixe (cf section "Editorial blocks" plus haut).

Ajouter un type ou changer la détection = update spec + sync `BlockView` rendering.

### I-16. ChatDock submit history limité à 10 derniers messages

L'orchestrator reçoit au max 10 messages d'historique. Au-delà : retrieval via KG context + conversation summary (cf feature `memory-kg`).

### I-17. ChatDock injecte `attached_asset_ids` depuis `attachedAssets`

Pas d'inlining du contenu asset dans `message`. Les assets sont passés par référence pour que le backend les charge avec le bon scope tenant.

### I-18. ApprovalInline pour writes — flow obligatoire

Quand le LLM tente une action `kind === "write"` sans confirmation, le backend émet `approval_requested` avec `stepId, preview, kind, providerId?`. L'UI doit rendre `<ApprovalInline>`. Pas de bypass d'approval pour les writes.

## Évolutions autorisées sans spec

- Ajout d'un nouveau pattern dans `VIOLENT/HARASSMENT/ILLEGAL/EXFIL_PATTERNS`
- Ajout d'un tool dans une des 12 catégories existantes
- Ajout d'un nouveau champ optionnel sur un event SSE existant (rétrocompatible)
- Polish UI sur n'importe quel composant chat
- Nouveau bloc éditorial avec détection ajoutée (sans retirer les 6 existants) → update spec si ajout structurel majeur
- Nouvelle action footer dans WorkingDocument
- Refactor interne d'un composant tant que sa surface publique reste identique
- Ajout de tests
- Migration `OPENAI_API_KEY` vers nouveau provider d'embeddings
- Ajout d'une variable d'env optionnelle (feature flag)

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Heartbeat insuffisant (proxy timeout 30s+) | Stream coupé en plein run long | Heartbeat 20s, dans la fenêtre Cloudflare/Vercel/nginx |
| `maxDuration` 300s atteint | Run tué côté serveur | Acceptable pour 99% des cas ; vidéo gen / browser long → planifier mission asynchrone |
| Abort registry single-instance | Multi-instance déploiement → abort silencieux possible | À migrer vers Redis si scale-out |
| `runtime.events` cap 50 | Très long runs perdent les premiers events | Acceptable, persistance DB (LogPersister) garde tout |
| Safety gate trop conservateur | Refus légitimes false-positive | Liste patterns conservatrice, ajustable |
| Safety gate insuffisant | Hostile content passe | Patterns à enrichir progressivement, monitoring nécessaire |
| Mass action 50+ via tools individuels | Cap n'est pas appliqué par tool, seulement intent | Connector write-guard ([connections.md](connections.md) à venir) double sécurité |
| `stage_request` ignoré (guard 10s) | UX agent semble "ne pas répondre" visuellement | Acceptable, l'utilisateur a la priorité (cf [stage.md](stage.md)) |
| ChatDock perd un event SSE (race condition reader/decoder) | Tool call orphelin, action_items manquantes | `chat-tool-stream-reducer` dédupe ; LogPersister garde la trace serveur |
| WorkingDocument fermé accidentellement | Brouillon perdu | Volatile par design ; CTA "Sauvegarder comme asset" pour persist explicite |
| Anthropic API key invalide / quota | Run failed, error event | Toast + analytics ; pas de fallback automatique vers OpenAI |
| Approval bypass (UI bug) | Write exécuté sans confirmation | Connector write-guard côté backend ([auth I-3](auth.md), [connections]) double sécurité |

## Tests

### Existants
- [`__tests__/orchestrator/abort-registry.test.ts`](../../__tests__/orchestrator/abort-registry.test.ts) — register/abort/unregister, idempotency
- [`__tests__/orchestrator/consume-sse-response.test.ts`](../../__tests__/orchestrator/consume-sse-response.test.ts) — parse SSE, fail-fast on `run_failed`
- [`__tests__/orchestrator/sse-contract.test.ts`](../../__tests__/orchestrator/sse-contract.test.ts) — format SSE
- [`__tests__/orchestrator/run-planner-workflow.test.ts`](../../__tests__/orchestrator/run-planner-workflow.test.ts) — dispatcher legacy
- [`__tests__/orchestrator/run-research-report.test.ts`](../../__tests__/orchestrator/run-research-report.test.ts) — research path
- [`__tests__/orchestrator/preview-tool-receipts.test.ts`](../../__tests__/orchestrator/preview-tool-receipts.test.ts) — preview tools
- [`__tests__/orchestrator/ai-pipeline-domain-filter.test.ts`](../../__tests__/orchestrator/ai-pipeline-domain-filter.test.ts) — filterToolsByDomain
- [`__tests__/orchestrator/auth-required-recovery.test.ts`](../../__tests__/orchestrator/auth-required-recovery.test.ts) — recovery
- [`__tests__/orchestrator/domain-routing-contract.test.ts`](../../__tests__/orchestrator/domain-routing-contract.test.ts)
- [`__tests__/orchestrator/execution-mode-contract.test.ts`](../../__tests__/orchestrator/execution-mode-contract.test.ts)
- [`__tests__/orchestrator/planner-discovery-suffix.test.ts`](../../__tests__/orchestrator/planner-discovery-suffix.test.ts)
- [`__tests__/orchestrator/provider-routing.test.ts`](../../__tests__/orchestrator/provider-routing.test.ts)
- [`__tests__/orchestrator/schedule-tool.test.ts`](../../__tests__/orchestrator/schedule-tool.test.ts)
- [`__tests__/orchestrator/write-intent.test.ts`](../../__tests__/orchestrator/write-intent.test.ts)
- [`__tests__/ui/chat-tool-stream-reducer.test.ts`](../../__tests__/ui/chat-tool-stream-reducer.test.ts) — `reduceToolEvents`, `selectCompletedWrites`
- [`__tests__/stores/chat-context.test.ts`](../../__tests__/stores/chat-context.test.ts) — chips CRUD + persist
- [`__tests__/stores/working-document.test.ts`](../../__tests__/stores/working-document.test.ts) — open/close/update
- [`__tests__/stores/runtime.test.ts`](../../__tests__/stores/runtime.test.ts) — events cap 50, coreState transitions
- [`__tests__/chat/WorkingDocument.test.tsx`](../../__tests__/chat/WorkingDocument.test.tsx)
- [`__tests__/chat/BlockActions.test.tsx`](../../__tests__/chat/BlockActions.test.tsx)
- [`__tests__/chat/BlockEditor.test.tsx`](../../__tests__/chat/BlockEditor.test.tsx)
- [`__tests__/chat/ContextChips.test.tsx`](../../__tests__/chat/ContextChips.test.tsx)
- [`__tests__/chat/ChatStage.split.test.tsx`](../../__tests__/chat/ChatStage.split.test.tsx)

### Manquants (gap moyen — couverture orchestrator déjà solide)

**Safety gate** :
- Test `checkSafetyGate` sur chaque catégorie de patterns (au moins 1 cas par)
- Test mass action caps (`>10` clarify, `>50` refuse)
- Test prompt injection (EXFIL_PATTERNS) avec exemples connus

**ChatDock submit flow** :
- Test SSE reader line-buffer (lignes coupées au milieu d'un chunk)
- Test abort signal propagation (controller.abort → fetch interrupted)
- Test limite history 10 derniers (clipping)
- Test `attached_asset_ids` injection

**ChatInput** :
- Test typeahead @mention (filter, insertion, reset)
- Test drag-drop asset → `attachedAssets`
- Test persona switcher → injection `persona_id`
- Test génération inline (audio/code/image) trigger

**ChatMessages** :
- Test parsing `<think>` block
- Test detection block type (6 cas)
- Test ConfirmActionChips déclenche bonne action
- Test compact mode (focal visible)
- Test scroll auto sur new message

**ChatToolStream / ChatActionReceipts** :
- Test que receipts utilisent bien `lastRunId` (pas `currentRunId`) — anti-régression
- Test dedupe par stepId avec multiple `tool_call_started`/`completed` mêlés
- Test rendering provider chip (latency + cost)

**Approval flow** :
- Test ApprovalInline render → POST resume → `tool_call_completed` reçu
- Test "skip" → next step
- E2E flow complet (approval requested → user approves → write executed)

**WorkingDocument** :
- Test custom event `chat:expand-block` ouvre WorkingDocument avec contenu
- Test ⌘B toggle global

**Stream contract regression** :
- Snapshot test : pour chaque type d'event SSE, format JSON figé

**Cross-feature** :
- Test `stage_request` event passe bien par `setModeFromTool` (guard 10s respecté)
- Test write tool sans approval → backend émet `approval_requested` (pas exécution directe)

## Code orphelin (code-ready non câblé)

Aucun à ce jour côté chat. Les composants principaux sont tous câblés.

`request_connection` et `create_scheduled_mission` sont deux tools spéciaux assemblés mais leur usage par le LLM dépend du système prompt — fonctionnels mais déclenchés conditionnellement.

## Notes & historique

- **Phase B1** — multi-step planner (`HEARST_ENABLE_PLANNER`) avec approval flow et StepGraph dans ChatStage. Devenu legacy mais code conservé en option (feature flag).
- **2026-04-29 pivot** — ChatStage refondu (split horizontal avec WorkingDocument, FocalStage embed compact). Cf [stage.md](stage.md).
- **Phase C3** — pin-based focal lock contre les races SSE focal vs setFocal manuel.
- **Phase C4** — persona switcher dans ChatInput (`persona_id` injecté dans payload).
- **streamText agentic** — remplace l'ancien planner+executor pour la majorité des intents. Le `runPlannerWorkflow` reste actif pour les flows multi-step explicites.
- **Prompt caching Anthropic** — ephemeral 5min sur les blocs statiques (orchestrator system prompt, tool definitions). Réduction coût significative pour les conversations multi-tour.
- **Safety gate** — patterns enrichis progressivement à mesure des incidents observés. Liste actuelle conservatrice par défaut.
- **Composio SDK v0.6.11** vs v0.8.1 dispo — limitations connues sur `refresh()` (cf [auth.md](auth.md)). N'affecte pas directement le chat sauf en cas de tool call qui touche un connector expirant.
