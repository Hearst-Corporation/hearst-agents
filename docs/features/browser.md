# Browser — `browser`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `browser` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

Co-browsing temps réel (Signature 3 — B5). L'utilisateur décrit une tâche, un agent LLM-driven (Claude Sonnet 4.6 via Anthropic tool_use) navigue dans un browser Browserbase et transmet chaque action en live via SSE. `BrowserStage` affiche un iframe debug viewer Browserbase (~70%) et un `ActionLog` (~30%). L'utilisateur peut reprendre la main via Take Over. Architecture à 3 couches : **Browserbase** (browser managé cloud), **Playwright-core** (CDP overlay), **Agent Loop** (Sonnet + 6 tools : navigate/click/fill/wait/extract/done).

## Surface publique

**Endpoints API**
- `POST /api/v2/browser/start` — crée une session Browserbase + lance Stagehand en fire-and-forget, retourne `{ sessionId, connectUrl, debugViewerUrl, taskId }`
- `GET /api/v2/browser/[id]` — statut session (status, debugViewerUrl, connectUrl)
- `DELETE /api/v2/browser/[id]` — stoppe la session Browserbase
- `POST /api/v2/browser/[id]/capture` — screenshot PNG → asset persisté, retourne `{ assetId, url, sizeBytes }`
- `POST /api/v2/browser/[id]/extract` — extraction structurée Haiku → asset JSON `kind=extract`, retourne `{ assetId, data }`
- `POST /api/v2/browser/[id]/take-over` — abort AbortController de la tâche en cours + marque session user-controlled, émet event SSE `browser_take_over`

**Composants**
- `app/(user)/components/stages/BrowserStage.tsx` — stage principale, polling debugViewerUrl (2s, max 30 tentatives), SSE bus global
- `app/(user)/components/browser/ExtractSchemaModal.tsx` — modal instruction + schema JSON pour extraction

**Libs**
- `lib/browser/stagehand-executor.ts` — `runBrowserTask`, `requestTakeOver`, `markUserControlled`, `activeRuns` Map
- `lib/browser/agent-loop.ts` — `runAgentLoop` (Sonnet 4.6, max 15 steps, 6 tools)
- `lib/browser/playwright-bridge.ts` — `getBrowserContext` CDP via playwright-core (require dynamique)
- `lib/browser/screenshot.ts` — `captureScreenshot`, `persistExtraction`, `persistSessionReport`

## Types clés

```ts
// lib/browser/stagehand-executor.ts
interface RunBrowserTaskOptions {
  sessionId: string;
  task: string;
  extractInstruction?: string;
  extractSchema?: Record<string, unknown>;
  runId?: string;
  maxActions?: number;          // défaut 30, max 100
  abortSignal?: AbortSignal;
  testActions?: Array<Omit<BrowserAction, "id" | "timestamp">>;
}

interface BrowserTaskResult {
  sessionId: string;
  summary: string;
  totalActions: number;
  totalDurationMs: number;
  extractData?: unknown;
  aborted: boolean;
}

// lib/browser/agent-loop.ts
type AgentToolName = "navigate" | "click" | "fill" | "wait" | "extract" | "done";

interface AgentLoopOptions {
  task: string;
  page: PlaywrightPage;
  maxSteps?: number;            // défaut 15, max 30
  model?: string;               // défaut "claude-sonnet-4-6"
  abortSignal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
}

interface AgentLoopResult {
  steps: AgentStep[];
  summary: string;
  success: boolean;
  extractedData: unknown;
  aborted: boolean;
}
```

## Invariants verrouillés

### I-1. Flow atomique : start = create session + fire-and-forget Stagehand
`POST /api/v2/browser/start` crée la session Browserbase **et** lance `runBrowserTask` en fire-and-forget dans le même handler. Il ne doit pas y avoir de route `/[id]/execute` séparée (bug historique Phase B3 : 2 round-trips, fragilité). Le client reçoit le sessionId immédiatement et observe via SSE.

### I-2. Take Over passe par requestTakeOver + markUserControlled
`requestTakeOver(sessionId)` abort l'AbortController dans `activeRuns`, émet l'event SSE `browser_take_over`. `markUserControlled(sessionId)` marque la session en Set dédié. Les deux doivent être appelés dans cet ordre depuis `POST /[id]/take-over`. L'UI `BrowserStage` passe `isControlled=true` à la réception de l'event SSE.

### I-3. Agent loop : cap 15 steps max, abort sur 5 échecs consécutifs
`runAgentLoop` applique `maxSteps = min(opts.maxSteps ?? 15, 30)`. Si 5 actions consécutives échouent (`NO_PROGRESS_LIMIT = 5`), la boucle s'abort avec `aborted=true`. Le tool `done` est le seul terminal normal. Ne jamais lever le cap au-delà de 30 sans validation spec.

### I-4. Playwright-core est une dépendance optionnelle (fallback stub-light)
`getBrowserContext` tente un dynamic import de `playwright-core`. Si indisponible (env serverless minimal), retourne `null`. Le stagehand-executor bascule en mode stub-light : émet juste un event `navigate` déterministe pour que l'UI ActionLog ne soit pas vide. Ne pas rendre playwright-core obligatoire.

### I-5. capture = nouvel asset à chaque appel, pas d'idempotence
Chaque `POST /[id]/capture` crée un nouvel `assetId` (UUID) et un nouveau storageKey timestampé. Ce comportement est intentionnel — plusieurs captures d'une même session sont des snapshots distincts. Ne pas dédupliquer par sessionId.

### I-6. extract = maxActions 5, jamais illimité
`POST /[id]/extract` appelle `runBrowserTask` avec `maxActions: 5`. L'extraction est one-shot, pas un full agent loop. Ce cap évite les extractions qui dégénèrent en navigation indéfinie.

### I-7. debugViewerUrl polling : 2s interval, max 30 tentatives
`BrowserStage` poll `GET /[id]` toutes les `STATUS_POLL_INTERVAL_MS = 2000ms` avec un plafond `STATUS_POLL_MAX_ATTEMPTS = 30` (soit 60s max). Passé ce plafond, l'iframe reste vide (pas d'erreur bloquante affichée).

### I-8. SSE events bus global — filtrage par sessionId côté client
`BrowserStage` consomme les events `browser_action / browser_task_completed / browser_task_failed / browser_take_over` depuis `/api/admin/events-stream` (bus global). Filtrage : `msg.sessionId !== sessionId` → skip. Ne jamais envoyer les actions d'une session vers un autre sessionId.

### I-9. Extraction structurée : Claude Haiku, HTML capé à 30k chars
`extractStructured` utilise `claude-haiku-4-5-20251001` avec `max_tokens: 2000`. L'HTML est nettoyé (strip scripts/styles/comments) et tronqué à 30 000 chars. Ne pas swapper vers Sonnet sans revalider les coûts.

### I-10. BROWSERBASE_API_KEY absent → 503 propre sur capture et extract
Les routes `/capture` et `/extract` vérifient `process.env.BROWSERBASE_API_KEY` avant d'agir et retournent `{ error: "browserbase_unavailable" }` avec status 503. Cette gate ne doit pas être retirée.

## Tests

Existants :
- Tests Vitest sur `stagehand-executor.ts` (mode `testActions` replay scripté)
- Tests `playwright-bridge.ts` avec `createFakePage`
- Tests agent-loop avec anthropicClient mock (tool_use + terminal done)

Manquants :
- Test `requestTakeOver` — vérifie abort + event SSE browser_take_over
- Test `POST /start` fire-and-forget (sessionId retourné immédiatement sans attendre la tâche)
- Test fallback stub-light (playwright-core indisponible → event navigate déterministe)
- Test extract maxActions=5 respecté
- Test `captureScreenshot` avec `bufferOverride` (pas de fetch Browserbase réel)
