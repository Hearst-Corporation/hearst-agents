# Audit 2 — Duplications dans Hearst OS

**Date** : 2026-05-16
**Scope** : `lib/**` (sauf `lib/spatial-safe/`), `app/api/**/route.ts`, `app/(user)/components/**`, `components/**` (sauf spatial-safe), `hooks/**` (sauf spatial-safe)
**Exclus** : spatial-safe, lab/cli-os, Apple-Vision-Pro-UI-Kit, docs/spatial/_BACKUP_*
**Verrou ADD** : déverrouillé
**Mode** : READ-ONLY (aucun Edit/Write hors rapport)

---

## Stats

| Catégorie | Count |
|-----------|-------|
| Duplications EXACT (copier-coller) | 8 |
| Duplications NEAR (90 % identique) | 7 |
| Patterns à factoriser (PATTERN, structure répétée) | 11 |
| Helpers de test extractibles | 3 |
| **Total findings** | **29** |
| **LOC économisables (estimé)** | **~1 100** |

Le pattern le plus impactant (DUP12 — circuit-breaker Kimi guard + try/chat/record) tue à lui seul ~600 LOC répartis sur 14 sites d'appel.

---

## Section 1 — Fonctions dupliquées

| ID | Files | Type | Fonction | LOC | Fix proposé |
|----|-------|------|----------|-----|-------------|
| DUP1 | `lib/missions/approvals.ts:393-400` + `lib/reports/blocks/format.ts:62-69` + `app/(user)/components/marketplace/MarketplaceTemplateCard.tsx:32-34` | EXACT (2 versions) + NEAR (1 version partielle) | `escapeHtml(s: string): string` | 8×3 = 24 | Extraire vers `lib/utils/escape-html.ts:escapeHtml()` — supprimer la version partielle marketplace qui n'échappe que `&<>` (3 chars vs 5, bug latent). |
| DUP2 | `lib/ui/format-time.ts:28-50` + `app/(user)/components/NotificationBell.tsx:52-61` + `app/(user)/components/right-panel/GeneralDashboard.tsx:34-41` + `app/(user)/components/stages/SignalBoardStage.tsx:72-85` + `lib/spatial/utils.ts:62` | NEAR (5 implémentations divergentes) | `relativeTime` / `formatRelative` (temps relatif FR) | ~12×5 = 60 | **Source de vérité existante** : `formatRelative` dans `lib/ui/format-time.ts`. Migrer les 4 réimplémentations vers `import { formatRelative } from "@/lib/ui/format-time"`. Bug latent : SignalBoardStage prend `nowMs` en arg (déterministe SSR), formatRelative utilise `Date.now()` direct → ajouter overload `formatRelative(input, { nowMs })`. |
| DUP3 | `lib/spatial/utils.ts:40-42` + (référence : `lib/spatial-safe/utils.ts:36-38` exclu) | EXACT | `clamp(value, min, max)` | 3 | Déjà OK dans `lib/spatial/utils.ts`. Mais `clamp` est aussi réinventé en inline (`Math.min(Math.max(...))`) dans `lib/cockpit/drift-detection.ts:314`, `lib/reports/sources/google.ts:109`, `lib/embeddings/store.ts:50`, etc. → factoriser dans `lib/utils/math.ts:clamp()` et migrer 5+ sites. |
| DUP4 | `lib/llm/kimi.ts:69` + `lib/llm/openai.ts:49` + `lib/engine/runtime/delegate/api.ts:401` + `lib/engine/runtime/delegate/api.ts:417` | EXACT (pattern d'accès) | Extraction `res.choices[0]?.message?.content ?? ""` (réponse OpenAI-like) | 1×4 = 4 | Trivial : `lib/llm/utils.ts:extractOpenAIContent(res)`. ROI faible LOC mais cohérence et test centralisé en cas de SDK update. |
| DUP5 | `lib/memory/kg.ts:153` + `lib/workflows/handlers/ai-classify-priority.ts:91` + `lib/daily-brief/generate.ts:166` + `lib/jobs/workers/simulation.ts:94` + `lib/inbox/inbox-brief.ts:239` + `lib/capabilities/providers/deepgram.ts:65` + `lib/workflows/handlers/ai-draft-welcome-notes.ts:108` + `lib/browser/stagehand-executor.ts:518` + `lib/browser/agent-loop.ts:404` | PATTERN | Regex extraction JSON de réponse LLM : `text.match(/\{[\s\S]*\}/)` ou `/\[[\s\S]*\]/` | 1-3 lignes × 9 sites | Helper : `lib/llm/parse-json-response.ts:extractFirstJson<T>(text, shape?: "object" \| "array" \| "any"): T \| null`. Gère aussi `try { JSON.parse }` qui suit systématiquement. |
| DUP6 | `lib/llm/kimi.ts:158` + `lib/llm/openai.ts:142` + `lib/capabilities/providers/llamaparse.ts:63,124` + `lib/jobs/workers/meeting-bot.ts:37` + `lib/jobs/workers/video-gen.ts:34,44` | EXACT | `new Promise(resolve => setTimeout(resolve, ms))` (sleep inline) | 1×7 = 7 | `lib/utils/sleep.ts:sleep(ms)`. ROI faible LOC mais haute cohérence. |
| DUP7 | `lib/capabilities/providers/heygen.ts:34-66` + `lib/capabilities/providers/heygen.ts:76-...` + `lib/capabilities/providers/runway.ts:19-...` + `lib/capabilities/providers/runway.ts:63-...` + `lib/capabilities/providers/fal.ts:29-...` + `lib/capabilities/providers/deepseek.ts:15-...` + `lib/tools/native/market-data.ts:24-...` + `lib/capabilities/providers/perplexity.ts:59-...` | PATTERN (15 sites) | AbortController + setTimeout(abort, ms) + try/fetch/finally clearTimeout | ~10 lignes × 15 = ~150 | **Helper existe déjà** : `fetchWithTimeout()` dans `lib/platform/fetch-timeout.ts` (signal-merge inclus). Migrer les 15 sites qui réinventent AbortController → ROI fort, suppression de bugs (oublis de `clearTimeout`). |
| DUP8 | `lib/connectors/unified/reconcile.ts:31` + `lib/connectors/control-plane/store.ts:17` + `lib/llm/usage-tracker.ts:35` + `lib/llm/persist-run.ts:50` + `lib/memory/store.ts:57` + `lib/missions/approvals.ts:159` + `lib/platform/auth/tokens.ts:14-18` + `lib/admin/health.ts:454,468` + `lib/engine/runtime/state/adapter.ts:8` + `lib/engine/runtime/missions/budget.ts:13` + `lib/engine/runtime/missions/leader-lease.ts:14` + `lib/engine/runtime/missions/cleanup-leases.ts:8` + `lib/engine/runtime/missions/distributed-lease.ts:13` + `lib/engine/runtime/timeline/persist.ts:13` + `lib/engine/runtime/assets/adapter.ts:7` + `lib/engine/runtime/assets/storage/supabase.ts:12,36` + `lib/engine/runtime/jobs/check-oauth-tokens.ts:15` | NEAR (18 sites) | `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false }})` | 6-10 lignes × 18 = ~140 | **Helper existe déjà** : `getServerSupabase()` / `requireServerSupabase()` dans `lib/platform/db/supabase.ts`. 18 fichiers le réinventent. ROI très fort, sécurité (centralisation des env checks). |

---

## Section 2 — Types / interfaces dupliqués

| ID | Files | Type dupliqué | LOC | Fix proposé |
|----|-------|---------------|-----|-------------|
| DUP9 | `lib/core/types/common.ts:25-29` + `lib/multi-tenant/types.ts` (via `TenantScope`) | EXACT (`TenantScope`) | 5×2 = 10 | Un seul `TenantScope` dans `lib/core/types/common.ts` est ré-exporté via `lib/core/types/index.ts`. Mais 7 fichiers importent depuis `@/lib/multi-tenant/types`. Choisir une source unique (recommandé : `@/lib/core/types`) et supprimer l'autre, garder un re-export pendant la transition. |
| DUP10 | `lib/engine/runtime/lifecycle.ts:10` + `lib/domain/types.ts:47` | EXACT (`RunStatus = "pending" \| "running" \| ...`) | 1×2 = 2 | Garder `lib/domain/types.ts` (source canonique business). Faire de `lib/engine/runtime/lifecycle.ts` un `export { RunStatus } from "@/lib/domain/types"`. |
| DUP11 | `lib/core/types/common.ts:7-11` + `lib/domain/types.ts:70-74` | EXACT (`ApiResponse<T>`) | 5×2 = 10 | Idem DUP9 — choisir un seul, re-export depuis l'autre. |

---

## Section 3 — Constantes / magic numbers dupliqués

| ID | Files | Constante | Fix proposé |
|----|-------|-----------|-------------|
| DUP3a | `lib/tools/native/kg-query.ts:38` + `lib/inbox/inbox-brief.ts:89` + `lib/capabilities/providers/video-prompt-enricher.ts:34` + `lib/capabilities/providers/deepgram.ts:51` + `lib/memory/mission-context.ts:408` + `lib/memory/briefing.ts:83` + `lib/memory/conversation-summary.ts:62` + `lib/memory/kg.ts:81` + `lib/admin/seed.ts:38,53,68,83` + `lib/workflows/handlers/ai-classify-priority.ts:64-65` + `lib/workflows/handlers/ai-draft-welcome-notes.ts:98` + `lib/daily-brief/generate.ts:219` + `lib/cockpit/drift-detection.ts:142` + `lib/cockpit/pre-meeting-intel.ts:315` + `lib/browser/stagehand-executor.ts:507` + `lib/meetings/debrief.ts:109` + `lib/engine/runtime/delegate/api.ts:391,409` + `lib/engine/orchestrator/system-prompt.ts:19` | Litéral `"kimi-k2.5"` dispersé sur **22 sites** | Exposer une constante unique `KIMI_MODELS.HAIKU = "kimi-k2.5"` dans `lib/llm/models.ts` (à côté de `pricing.ts`). Migrer les 22 sites. Bénéfice : 1 seul endroit à update quand on passera à `kimi-k2.6`. |
| DUP3b | `lib/tools/native/hearst-actions.ts:145,230` + `lib/tools/native/extras-media.ts:188,226,279,313,398,437,520,554` + `lib/voice/tools.ts:126` | Coûts `estimatedCostUsd: 0.005 / 0.01 / 0.05 / 0.5` hardcodés à 11 sites | Créer `lib/llm/cost-estimates.ts:TOOL_COST_ESTIMATES = { meeting_bot: 0.05, image_gen: 0.5, audio_tts: 0.005, ... }`. ROI long terme : tarification cohérente, ajustement centralisé. |
| DUP3c | `lib/inbox/inbox-brief.ts:222` (1500) + `lib/capabilities/providers/video-prompt-enricher.ts:84` (200) + `lib/memory/mission-context.ts:409` (600) + `lib/capabilities/providers/deepgram.ts:52` (1024) + `lib/memory/conversation-summary.ts:63` (250) + `lib/memory/briefing.ts:84` (500) + `lib/workflows/handlers/ai-classify-priority.ts:82` (200) + `lib/workflows/handlers/ai-draft-welcome-notes.ts:99` (1500) + `lib/daily-brief/generate.ts:220` (1200) + `lib/cockpit/drift-detection.ts:179` (120) + `lib/cockpit/pre-meeting-intel.ts:359` (200) + `lib/browser/stagehand-executor.ts:508` (2000) + `lib/meetings/debrief.ts:110` (1500) + `lib/engine/runtime/delegate/api.ts:392,410` (4096×2) + `lib/engine/orchestrator/run-research-report.ts:329` (4096) + `lib/engine/orchestrator/planner.ts:123` (4096) | `max_tokens` litéral éparpillé. ~18 sites, valeurs incohérentes (200 vs 250 pour des tâches courtes ; 1500 vs 1200 pour des briefs). | Pas une dup pure mais un magic number étalé. Créer `lib/llm/limits.ts:MAX_TOKENS = { TINY: 200, COMPACT: 500, BRIEF: 1500, EXTRACTION: 2048, FULL: 4096 }`. Aide la cohérence éditoriale. |
| DUP3d | `lib/connectors/composio/apps.ts:68` + `lib/connectors/composio/cache.ts:13` + `lib/connectors/composio/discovery.ts:177` + `lib/platform/settings/cache.ts` + `lib/cockpit/agenda-live.ts` + `lib/cockpit/monthly-card.ts` + `lib/voice/tool-definitions.ts:30` + `lib/tools/hitl/confirmation-token.ts:27` | TTL de cache local en mémoire (`TTL_MS`, `CACHE_TTL_MS`) défini 8 fois | Pas critique (chaque module a sa propre durée). Mais **le pattern de in-mem cache (`Map<K, { value, expiresAt }>` + check `expiresAt > Date.now()`)** est ré-implémenté à chaque fois. Helper : `lib/utils/lru-ttl.ts:createTtlCache<K, V>(ttlMs)` → 1 ligne d'init au lieu de 15. |

---

## Section 4 — Patterns à factoriser (le BIG ONE)

### DUP12 — **Pattern Vague 3 : circuit-breaker Kimi + try/chat/record** (le plus gros gain)

**Fichiers concernés** (au moins 14 sites identiques au pattern de 20-30 lignes) :

1. `lib/memory/conversation-summary.ts:53-88` (~36 lignes)
2. `lib/memory/briefing.ts:74-117` (~44 lignes)
3. `lib/memory/kg.ts:124-152` (~29 lignes)
4. `lib/memory/mission-context.ts:379-426` (~48 lignes)
5. `lib/inbox/inbox-brief.ts:208-265` (~58 lignes)
6. `lib/capabilities/providers/video-prompt-enricher.ts:76-116` (~41 lignes)
7. `lib/capabilities/providers/deepgram.ts:46-86` (~41 lignes)
8. `lib/workflows/handlers/ai-classify-priority.ts:88-105` (~18 lignes)
9. `lib/workflows/handlers/ai-draft-welcome-notes.ts:105-132` (~28 lignes)
10. `lib/daily-brief/generate.ts:227-237` (~11 lignes, partiel)
11. `lib/cockpit/drift-detection.ts:201-214` (~14 lignes, partiel)
12. `lib/cockpit/pre-meeting-intel.ts:365-368` (~4 lignes, partiel)
13. `lib/meetings/debrief.ts:116-120` (~5 lignes, partiel)
14. `lib/tools/native/kg-query.ts:147-150` (~4 lignes, partiel)
15. `lib/engine/orchestrator/run-research-report.ts:338-347` (~10 lignes, partiel)
16. `lib/engine/orchestrator/planner.ts:126-137` (~12 lignes, partiel)
17. `lib/engine/orchestrator/ai-pipeline.ts:1297-1302` (~6 lignes, partiel)
18. `lib/browser/stagehand-executor.ts:515-528` (~14 lignes, partiel)
19. `app/api/v2/personas/ab-test/route.ts:144-152` (~9 lignes, partiel)
20. `app/api/v2/assets/diff/route.ts:113-117` (~5 lignes, partiel)

**Structure répétée** (exemple `lib/memory/conversation-summary.ts`) :

```ts
if (defaultCircuitBreaker.isOpen("kimi", tenantId)) {
  console.warn("[memory/summary] circuit breaker kimi open — compression skip");
  return conversationText;
}
const provider = getProvider("kimi");
try {
  const res = await provider.chat({
    model: "kimi-k2.5",
    max_tokens: 250,
    messages: [...],
  });
  defaultCircuitBreaker.recordSuccess("kimi", tenantId);
  return res.content ?? fallback;
} catch (err) {
  defaultCircuitBreaker.recordFailure(
    "kimi",
    err instanceof Error ? err : new Error(String(err)),
    tenantId,
  );
  console.warn("[memory/summary] compression LLM échouée:", err);
  return fallback;
}
```

**Helper proposé** (signature complète) :

```ts
// lib/llm/safe-chat.ts
export interface SafeChatOptions<T> {
  provider?: string;            // default "kimi"
  tenantId?: string;
  chatRequest: ChatRequest;
  /** Logger label : "[memory/summary]" — utilisé en console.warn. */
  context: string;
  /** Valeur de fallback retournée si circuit ouvert ou erreur. */
  fallback: T;
  /** Mapper de la réponse LLM (typiquement res => res.content ?? fallback). */
  parse: (res: ChatResponse) => T;
}

export async function chatWithCircuitBreaker<T>(opts: SafeChatOptions<T>): Promise<T> {
  const provider = opts.provider ?? "kimi";
  if (defaultCircuitBreaker.isOpen(provider, opts.tenantId)) {
    logger.warn({ provider, ctx: opts.context }, "circuit breaker open — skip");
    return opts.fallback;
  }
  try {
    const llm = getProvider(provider);
    const res = await llm.chat(opts.chatRequest);
    defaultCircuitBreaker.recordSuccess(provider, opts.tenantId);
    return opts.parse(res);
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    defaultCircuitBreaker.recordFailure(provider, errObj, opts.tenantId);
    logger.warn({ err: errObj, ctx: opts.context }, "LLM call échouée — fallback");
    return opts.fallback;
  }
}
```

**Impact LOC** :
- Avant : ~400 lignes répétées sur 20 sites
- Après : ~50 lignes (helper) + 5 lignes × 20 sites = ~150 lignes
- **Économie : ~250 LOC + cohérence logger/observabilité totale**

**Bénéfices side** :
- Bug `console.warn` vs `logger.warn` corrigé (4 sites font `console.warn`, le reste fait `logger.warn`, mélange incohérent)
- Tests : 1 seul mock à écrire pour `chatWithCircuitBreaker` (au lieu de 14 fois `vi.mock("@/lib/llm/circuit-breaker")` + 14 fois `vi.mock("@/lib/llm/router")`)
- Migration vers métrique granulaire (latency, tokens, cost) en 1 endroit

---

### DUP13 — **Pattern API route : `req.json().catch + safeParse + 400`**

**Fichiers concernés** (au moins 30 routes API) :

- `app/api/admin/settings/route.ts:63-67`
- `app/api/v2/settings/preferences/route.ts:55-59`
- `app/api/v2/settings/flags/route.ts:42-46`
- `app/api/v2/missions/route.ts:54-60,191-197`
- `app/api/v2/missions/[id]/route.ts:75-81`
- `app/api/v2/missions/[id]/pause/route.ts:38-43`
- `app/api/v2/missions/[id]/resume/route.ts:35-40`
- `app/api/v2/missions/[id]/approve-step/route.ts:36-40`
- `app/api/v2/missions/[id]/run/route.ts:45-50`
- `app/api/v2/missions/[id]/messages/route.ts:90-94`
- `app/api/v2/marketplace/templates/route.ts:97-103`
- `app/api/v2/marketplace/templates/[id]/rate/route.ts:50`
- `app/api/v2/marketplace/templates/[id]/report/route.ts:49`
- `app/api/v2/workflows/[runId]/approve-node/route.ts:50-54`
- `app/api/v2/workflows/preview/route.ts:59-63`
- `app/api/v2/daily-brief/history/route.ts:74`
- `app/api/v2/daily-brief/generate/route.ts:50`
- `app/api/v2/hearst-card/[yearMonth]/route.ts:272`
- `app/api/v2/browser/start/route.ts:52`
- `app/api/v2/browser/[id]/extract/route.ts:63`
- `app/api/v2/voice/transcripts/append/route.ts:56`
- `app/api/v2/voice/transcripts/[sessionId]/route.ts:68`
- `app/api/v2/voice/tool-call/route.ts:61`
- `app/api/v2/kg/ingest/route.ts:37`
- `app/api/v2/meetings/start/route.ts:62`
- `app/api/v2/assets/[id]/variants/route.ts:64`
- `app/api/v2/reports/[specId]/run/route.ts:49`
- `app/api/v2/search/route.ts:135`
- `app/api/settings/alerting/route.ts:40-46`
- `app/api/settings/alerting/test/route.ts:39-45`
- `app/api/user/theme/route.ts:50-52`
- `app/api/realtime/session/route.ts:70`

**Structure répétée** :

```ts
const rawBody = await req.json().catch(() => null);
const parsed = mySchema.safeParse(rawBody);
if (!parsed.success) {
  return NextResponse.json(
    { error: "invalid_body", details: parsed.error.flatten() },
    { status: 400 },
  );
}
```

**Incohérences détectées** (terrain pour bug latent) :
- `error: "invalid_body"` (10 fichiers) vs `"invalid_payload"` (8 fichiers) vs `"invalid_input"` (4 fichiers) vs `"invalid_json"` (3 fichiers) vs `"validation_error"` (1 fichier) → **5 codes d'erreur différents pour la même chose**
- `details: parsed.error.flatten()` vs `issues: parsed.error.issues` vs `issues: parsed.error.flatten()` vs `details: parsed.error.format()` → **4 shapes différents**

**Helper proposé** :

```ts
// lib/platform/http/parse-body.ts
export async function parseJsonBody<T>(
  req: Request | NextRequest,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

// Usage : 3 lignes au lieu de 7
const result = await parseJsonBody(req, missionSchema);
if (!result.ok) return result.response;
const body = result.data;
```

**Impact LOC** : ~3 lignes × 31 sites = 93 lignes économisées + uniformisation des codes d'erreur.

---

### DUP14 — **Pattern `requireScope` + `if (error || !scope)` + tenantId extract**

**Fichiers concernés** : 90+ routes API (count : 165 routes, 163 sites de `scope.tenantId`).

**Structure répétée** :

```ts
export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({ context: "POST /api/foo" });
  if (scopeError || !scope) return scopeError;
  const tenantId = scope.tenantId;
  // ... business
}
```

**Helper proposé** : un HOF wrapping pattern.

```ts
// lib/platform/http/route-handler.ts
export function withScope<T>(
  context: string,
  handler: (req: NextRequest, scope: CanonicalScope) => Promise<T>,
): (req: NextRequest) => Promise<NextResponse | T> {
  return async (req) => {
    const { scope, error } = await requireScope({ context });
    if (error || !scope) return error;
    return handler(req, scope);
  };
}

// Usage
export const POST = withScope("POST /api/foo", async (req, scope) => {
  // ... business avec scope.tenantId garanti
});
```

**Impact LOC** : ~3 lignes × 100 sites = 300 lignes. + Cohérence sur les codes d'erreur 401/403.

---

### DUP15 — Pattern hash SHA256 query

| Files | Pattern |
|-------|---------|
| `lib/tools/handlers/web-search.ts:72-74` | `createHash("sha256").update(normalized).digest("hex").slice(0, 16)` |
| `lib/embeddings/embed.ts:34-36` | `crypto.createHash("sha256").update(text, "utf8").digest("hex")` |
| `lib/memory/retrieval-context.ts:40` | `hashMessage(s: string)` |
| `lib/hom/fs-utils.ts` | `sha256(html)` |
| `lib/tools/hitl/confirmation-token.ts:54,86,120` | `createHmac("sha256", secret).update(json).digest("base64url")` |

**Fix** : `lib/utils/crypto.ts:sha256(input, opts?)` + `hmacSha256(input, secret, encoding)`. ROI ~30 LOC.

---

### DUP16 — Pattern keydown listener (ESC/CTRL+K)

**Fichiers** : `Commandeur.tsx:152`, `OnboardingTour.tsx:101`, `NotificationBell.tsx:128`, `ReportActions.tsx:441`, `BuilderToolbar.tsx:182`, `MissionStage.tsx:208`, `StageActionBar.tsx:193`, `ExtractSchemaModal.tsx:29`, `ReportEditor.tsx:77`.

**Pattern** :

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [onClose]);
```

**Fix** : `hooks/useKeyboard.ts:useEscapeKey(handler)`, `useHotkey(combo, handler)`. ROI ~50 LOC + accessibilité.

---

### DUP17 — Pattern `formatDate` / `formatCurrency` / `formatBytes`

| File | Helper |
|------|--------|
| `lib/connectors/composio/preview-formatters/shared.ts:35` | `formatDateFR` |
| `lib/memory/briefing.ts:27` | `formatDate` (private) |
| `lib/workflows/templates/weekly-slack-digest.ts:132` | `formatCurrency` |
| `lib/cockpit/monthly-card-view.tsx:37` | `formatNumber` |
| `app/(user)/components/AudioPlayer.tsx:17` | `formatBytes` |
| `app/(user)/components/reports/ResearchReportArticle.tsx:94` | `formatDate` |
| `app/(user)/components/chat/ConversationHeader.tsx:205` | `formatRelativeDate` |

**Fix** : centraliser dans `lib/ui/format-time.ts` (déjà partiellement présent — étendre avec `formatDateFR`, `formatBytes`, `formatCurrency`). ROI ~40 LOC + cohérence i18n FR.

---

## Section 5 — Composants React dupliqués

| ID | Files | Pattern | LOC | Fix |
|----|-------|---------|-----|-----|
| DUP18 | `app/(user)/components/stages/CockpitStage.tsx:122` + `app/(user)/components/stages/SignalBoardStage.tsx:468` + `app/(user)/components/reports/ReportCard.tsx:365` | NEAR | Skeletons inline (`<div className="ghost-skeleton-bar" />`) au lieu de `<RowSkeleton>` / `<CardSkeleton>` (qui existent dans `app/(user)/components/ui/Skeleton.tsx`) | ~15×3 = 45 | Migrer 3 sites vers les primitives existantes. RowSkeleton/CardSkeleton couvrent les 3 cas (CockpitSkeleton, SignalSkeleton, ReportCardSkeleton). |
| DUP19 | `app/(user)/components/asset-variant-tabs/VariantEmptyState.tsx` + 4 autres sites avec empty inline | NEAR | EmptyState réinventé localement au lieu d'utiliser `<EmptyState>` de `app/(user)/components/ui/EmptyState.tsx` | Variable | Audit visuel + migration. |
| DUP20 | `MarketplaceTemplateCard.tsx:32-34` | EXACT (pour escapeHtml) | 3 | Voir DUP1. |
| DUP21 | `app/(user)/components/LeftPanelShell.tsx:28` + `app/(user)/components/RightPanel.tsx:22` | NEAR | `useEffect(() => { window.addEventListener("resize", ...); })` pour `checkMobile` | ~10×2 = 20 | Hook : `hooks/useMediaQuery.ts:useIsMobile()` (déjà commun pattern). |

---

## Section 6 — Helpers de tests à extraire

| ID | Files | Pattern dupliqué | Fix |
|----|-------|------------------|-----|
| DUP22 | 13 tests (`__tests__/inbox/inbox-brief.test.ts:27`, `__tests__/daily-brief/generate.test.ts:11`, `__tests__/cockpit/pre-meeting-intel.test.ts:33`, `__tests__/cockpit/drift-detection.test.ts:113`, `__tests__/api/assets-diff.test.ts:37`, `__tests__/api/personas-ab-test.test.ts:42`, `__tests__/meetings/debrief.test.ts:10`, `__tests__/orchestrator/*.test.ts` ×3) | `vi.mock("@/lib/llm/router", () => ({ getProvider: vi.fn(...) }))` + `vi.mock("@/lib/llm/circuit-breaker", () => ({ defaultCircuitBreaker: { isOpen: ..., recordSuccess: ..., recordFailure: ... } }))` ~15 lignes × 13 sites | Créer `__tests__/_helpers/llm-mocks.ts:mockLlmRouter(opts?)` + `mockCircuitBreaker()`. ROI ~150 LOC + maintenabilité (1 mise à jour quand router/circuit-breaker évolue). Voir aussi DUP12 — si `chatWithCircuitBreaker` est extrait, on n'a plus qu'**un seul** mock à écrire (`vi.mock("@/lib/llm/safe-chat")`). |
| DUP23 | 35 fichiers (`__tests__/security/*.test.ts`) | `vi.mock("@/lib/platform/auth/scope", () => ({ requireScope: vi.fn() }))` ~3-5 lignes × 35 sites | Créer `__tests__/_helpers/auth-mocks.ts:mockRequireScope(scope?)`. ROI ~50 LOC. |
| DUP24 | 10 tests (`__tests__/memory/*.test.ts`, `__tests__/missions/budget.test.ts`, `__tests__/missions/approvals.test.ts`, `__tests__/embeddings/store.test.ts`) | `vi.mock("@/lib/platform/db/supabase", () => ...)` + parfois `createMockSupabase()` (déjà dans `__tests__/runtime/mock-supabase.ts:104`) mais pas utilisé partout | Promouvoir l'usage de `createMockSupabase()` existant et créer le mock par défaut dans `__tests__/_helpers/supabase-mocks.ts:mockSupabaseClient(opts)`. ROI ~100 LOC. |

---

## Recommandations — Top 10 fixes prioritaires (ROI/effort)

| Rang | Fix | LOC économisés | Effort | Risque |
|------|-----|----------------|--------|--------|
| 1 | **DUP12** : Extraire `chatWithCircuitBreaker(opts)` dans `lib/llm/safe-chat.ts` + migrer 20 sites | ~250 | 4-6h | Bas (refacto bien contraint) |
| 2 | **DUP8** : Migrer 18 fichiers vers `getServerSupabase()` (existe déjà dans `lib/platform/db/supabase.ts`) | ~140 | 2-3h | Bas |
| 3 | **DUP7** : Migrer 15 sites de `new AbortController() + setTimeout` vers `fetchWithTimeout()` (existe déjà) | ~150 | 3-4h | Moyen (chaque provider a son edge case d'AbortError) |
| 4 | **DUP14** : HOF `withScope(context, handler)` + migrer 100 routes | ~300 | 5-7h | Moyen (impact testing) |
| 5 | **DUP13** : `parseJsonBody(req, schema)` + migrer 31 routes + uniformiser les codes d'erreur | ~93 + cohérence | 3-4h | Bas |
| 6 | **DUP2** : Supprimer 4 réimplémentations de `relativeTime` → centraliser sur `formatRelative` (existe déjà) | ~60 | 1-2h | Bas |
| 7 | **DUP3a** : Constante `KIMI_HAIKU_MODEL` + migrer 22 sites | ~22 | 30min | Trivial |
| 8 | **DUP22** : Helpers de tests `__tests__/_helpers/llm-mocks.ts` (après DUP12 idéalement) | ~150 | 2h | Bas |
| 9 | **DUP1** : `lib/utils/escape-html.ts` + supprimer 3 versions (dont 1 buggée) | ~24 | 30min | Bas |
| 10 | **DUP18** : Migrer 3 skeletons inline vers `<RowSkeleton>` / `<CardSkeleton>` | ~45 | 1h | Bas |

**Effort total estimé** : 22-30h pour ~1 234 LOC économisés + cohérence majeure (codes d'erreur API uniformes, observabilité LLM uniforme, sécurité Supabase centralisée).

**Quick wins (< 1h chacun)** : DUP3a, DUP1, DUP18, DUP4, DUP6, DUP10, DUP11.

---

## Annexes — Patterns identifiés non chiffrés (à creuser)

- **Magic numbers `max_tokens`** (DUP3c) : 18 sites avec valeurs incohérentes (200 vs 250, 1500 vs 1200) — pas un dup pur mais signal d'absence de hiérarchie de tailles.
- **API key checks** (`if (!process.env.X_API_KEY) throw new Error("X non configuré")`) : 15 sites, légère variation entre `"non configuré"` / `"manquant"` / `"is not set"` — gain cosmétique.
- **Cache TTL in-memory pattern** (`Map<K, { value, expiresAt }>`) : 8 sites, helper `createTtlCache(ttlMs)` recommandé mais ROI modéré.
- **`stripMarkdown`** : implémenté à 1 seul endroit (`lib/memory/briefing.ts:12`) mais probablement nécessaire ailleurs (audio scripts ont besoin du strip markdown).
- **Voice tool defs** : `lib/voice/tool-defs.ts`, `lib/voice/tools.ts`, `lib/voice/tool-definitions.ts` — pas une dup mais 3 fichiers très liés avec re-exports croisés. À consolider en 2 fichiers (client-safe + server-only) après audit.

---

## Méthodo

- Grep ciblé sur 595 fichiers du scope (lib + app/api + app/(user)/components + components + hooks, hors spatial-safe).
- Cross-référencement avec les helpers existants (`lib/platform/db/supabase.ts`, `lib/platform/fetch-timeout.ts`, `lib/ui/format-time.ts`, `app/(user)/components/ui/Skeleton.tsx`) pour distinguer "à factoriser" vs "à migrer vers existant".
- Comptage LOC : approximé par bloc copié × nombre de sites, sans pondération pour les imports.
- Aucune zone `spatial-safe`, `lab/cli-os`, `Apple-Vision-Pro-UI-Kit`, ou `docs/spatial/_BACKUP_*` n'a été touchée ni examinée pour fix.
