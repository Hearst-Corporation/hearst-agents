# F002 — Plan d'implémentation détaillé : Intégration Kimi dans le routeur LLM

**Date** : 2026-05-16
**Auteur** : llm-auditor (read-only — plan seulement)
**Statut** : READY — à exécuter par l'agent fixer désigné
**Effort estimé** : 8-12h (Étapes 1+2+3 = 3-4h, Étapes 4+5 = 5-8h)
**Priorité** : P0 — bloquant multi-user public

---

## Contexte

19 fichiers instancient directement `new OpenAI({ baseURL: "https://api.hypercli.com/v1" })`
en contournant `lib/llm/router.ts`. Tous les hooks Phase 4/5/6 (circuit breaker, rate limit,
metrics, retry backoff, fallback chain, PII redaction) sont donc inactifs pour Kimi.

`lib/llm/pricing.ts:27-30` : le pricing Kimi est déjà défini (`kimi-k2.5`, `kimi-k2.6`, `kimi-k2`).
`lib/admin/health.ts:416` : health check Kimi existe déjà (GET `/v1/models`).
`lib/admin/seed.ts:37-83` : 4 entrées `model_provider: "kimi"` déjà en base (à vérifier).

---

## Étape 1 — Créer `lib/llm/kimi.ts`

Pattern exact copié depuis `lib/llm/openai.ts`. Différences clés :

- `baseURL` lu depuis `KIMI_BASE_URL` (configurable) avec fallback hardcodé
- `apiKey` lu depuis `KIMI_API_KEY`
- Nom provider : `"kimi"`
- Les modèles supportés : `kimi-k2.5`, `kimi-k2.6`, `kimi-k2`
- Pas de `stream_options: { include_usage: true }` (à valider avec doc hypercli)
- La fenêtre de reasoning `<think>...</think>` n'est PAS à gérer ici : ce middleware
  appartient à `ai-pipeline.ts` (Vercel AI SDK layer), pas au provider router.

**Skeleton complet :**

```typescript
// lib/llm/kimi.ts
import OpenAI from "openai";
import { computeCostUsd } from "./pricing";
import { defaultRateLimiter } from "./rate-limiter";
import { CHAT_TIMEOUT_MS, makeAbortSignal, STREAM_TIMEOUT_MS } from "./timeout";
import type { ChatRequest, ChatResponse, LLMProvider, StreamChunk } from "./types";

const KIMI_BASE_URL =
  process.env.KIMI_BASE_URL ?? "https://api.hypercli.com/v1";

export class KimiProvider implements LLMProvider {
  readonly name = "kimi";
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      throw new Error("KIMI_API_KEY is not set — add it to .env.local");
    }
    this.client = new OpenAI({ apiKey, baseURL: KIMI_BASE_URL });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const timeoutMs = req.timeoutMs ?? CHAT_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);

    // Backoff proactif : si on connaît un budget bas / retry-after, on attend.
    await this.maybeWaitForRateLimit();

    // NOTE: .withResponse() non disponible sur toutes les versions du SDK avec
    // baseURL custom — utiliser la forme sans withResponse() si nécessaire.
    const res = await this.client.chat.completions.create(
      {
        model: req.model,
        messages: req.messages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        top_p: req.top_p,
      },
      { signal },
    );

    // Kimi via hypercli ne renvoie pas de headers rate-limit documentés.
    // Si la doc Moonshot les documente dans l'avenir, brancher recordHeaders ici.

    const tokensIn = res.usage?.prompt_tokens ?? 0;
    const tokensOut = res.usage?.completion_tokens ?? 0;

    return {
      content: res.choices[0]?.message?.content ?? "",
      model: res.model,
      provider: this.name,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: computeCostUsd("kimi", req.model, {
        input_tokens: tokensIn,
        output_tokens: tokensOut,
      }),
      latency_ms: Date.now() - start,
    };
  }

  async *streamChat(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const timeoutMs = req.timeoutMs ?? STREAM_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);

    await this.maybeWaitForRateLimit();

    const stream = await this.client.chat.completions.create(
      {
        model: req.model,
        messages: req.messages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        top_p: req.top_p,
        stream: true,
        // stream_options: { include_usage: true } — à activer si hypercli le supporte
      },
      { signal },
    );

    let tokensIn = 0;
    let tokensOut = 0;
    let pendingFinish = false;

    for await (const chunk of stream) {
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens ?? 0;
        tokensOut = chunk.usage.completion_tokens ?? 0;
      }
      const delta = chunk.choices[0]?.delta?.content ?? "";
      const finishReason = chunk.choices[0]?.finish_reason;
      if (delta) {
        yield { delta, done: false };
      }
      if (finishReason !== null && finishReason !== undefined) {
        pendingFinish = true;
      }
    }

    if (pendingFinish) {
      const cost_usd = computeCostUsd("kimi", req.model, {
        input_tokens: tokensIn,
        output_tokens: tokensOut,
      });
      yield { delta: "", done: true, cost_usd, tokens_in: tokensIn, tokens_out: tokensOut };
    }
  }

  private async maybeWaitForRateLimit(): Promise<void> {
    try {
      const delay = defaultRateLimiter.getNextDelay("kimi");
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch {
      // best-effort
    }
  }
}
```

**Vérification post-création :**

```bash
# Pas d'erreur TypeScript
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "kimi.ts"
```

---

## Étape 2 — Enregistrer Kimi dans `lib/llm/router.ts:getProvider()`

**Localisation exacte** : `lib/llm/router.ts:37-58`

**Avant :**

```typescript
// lib/llm/router.ts:12
import { OpenAIProvider } from "./openai";

// lib/llm/router.ts:37-58
export function getProvider(providerName: string): LLMProvider {
  const key = providerName.toLowerCase();
  if (!providers[key]) {
    switch (key) {
      case "openai":
        providers[key] = new OpenAIProvider();
        break;
      case "anthropic":
        providers[key] = new AnthropicProvider();
        break;
      case "composer":
        providers[key] = new ComposerProvider();
        break;
      case "gemini":
        providers[key] = new GeminiProvider();
        break;
      default:
        throw new Error(`Unknown LLM provider: ${providerName}`);
    }
  }
  return providers[key];
}
```

**Après (diff) :**

```diff
+import { KimiProvider } from "./kimi";
 import { OpenAIProvider } from "./openai";

 export function getProvider(providerName: string): LLMProvider {
   const key = providerName.toLowerCase();
   if (!providers[key]) {
     switch (key) {
       case "openai":
         providers[key] = new OpenAIProvider();
         break;
       case "anthropic":
         providers[key] = new AnthropicProvider();
         break;
       case "composer":
         providers[key] = new ComposerProvider();
         break;
       case "gemini":
         providers[key] = new GeminiProvider();
         break;
+      case "kimi":
+        providers[key] = new KimiProvider();
+        break;
       default:
         throw new Error(`Unknown LLM provider: ${providerName}`);
     }
   }
   return providers[key];
 }
```

**Exporter dans `lib/llm/index.ts` :**

```diff
+export { KimiProvider } from "./kimi";
```

---

## Étape 3 — Migrer les 5 fichiers critiques (Priorité 1 — PII)

Ces 5 fichiers traitent des données structurées utilisateur (KG, mission context, orchestrateur
principal, planner, research report). Migration via `chatWithProfile` ou via `smartChat`.

**Prérequis** : les `model_profiles` Kimi doivent exister en base. Vérifier avec :

```sql
SELECT id, name, provider, model, fallback_profile_id
FROM model_profiles
WHERE model_provider = 'kimi' OR provider = 'kimi';
```

Si absent, utiliser `lib/admin/seed.ts:37-83` comme référence ou créer via migration SQL.
`fallback_profile_id` doit pointer vers un profil Anthropic Sonnet (fallback de sécurité).

### 3.1 — `lib/engine/orchestrator/ai-pipeline.ts:114-117`

Ce fichier utilise le SDK Vercel AI (`createOpenAI`, `wrapLanguageModel`,
`extractReasoningMiddleware`) — ce n'est PAS la même abstraction que `lib/llm/router.ts`.
Il s'agit du path de streaming principal (`streamText` de `@ai-sdk/core`).

**Contrainte** : le middleware `extractReasoningMiddleware({ tagName: "think" })` est nécessaire
pour filtrer les balises `<think>...</think>` de Kimi K2.5/K2.6. Ce middleware est propre au
SDK Vercel AI et ne peut pas être branché sur `lib/llm/router.ts` (qui utilise le SDK OpenAI
natif sans couche Vercel AI).

**Stratégie de migration** : on ne peut pas remplacer `kimi = createOpenAI(...)` par
`chatWithProfile` ici sans refactor majeur du pipeline streaming. La migration correcte pour ce
fichier est :

1. Conserver `createOpenAI` mais lire depuis `KIMI_BASE_URL` et `KIMI_API_KEY` (déjà le cas).
2. Envelopper l'appel `streamText` dans un try/catch qui déclenche
   `defaultCircuitBreaker.recordFailure("kimi", err)` sur 5xx.
3. Appeler `defaultMetrics.recordCall({ provider: "kimi", ... })` après completion.
4. **Ne pas** passer par `chatWithProfile` — le streaming Vercel AI est incompatible avec
   l'interface `LLMProvider.streamChat()` actuelle.

**Avant (ai-pipeline.ts:114-117)** :

```typescript
const kimi = createOpenAI({
  apiKey: process.env.KIMI_API_KEY ?? "",
  baseURL: "https://api.hypercli.com/v1",
});
```

**Après** :

```typescript
const kimi = createOpenAI({
  apiKey: process.env.KIMI_API_KEY ?? "",
  baseURL: process.env.KIMI_BASE_URL ?? "https://api.hypercli.com/v1",
});
```

**Hooks à brancher dans la boucle `streamText` (autour de ligne 782)** :

```typescript
// Avant streamText
if (defaultCircuitBreaker.isOpen("kimi", input.tenantId)) {
  throw new Error("Kimi circuit open — pas de fallback streaming disponible");
}

// Dans le catch du streamText
defaultCircuitBreaker.recordFailure("kimi", err, input.tenantId);
defaultMetrics.recordError({ provider: "kimi", errorCode: "STREAM_ERROR" });

// Après completion (dans onFinish ou équivalent)
defaultCircuitBreaker.recordSuccess("kimi", input.tenantId);
defaultMetrics.recordCall({
  provider: "kimi",
  model: ORCHESTRATOR_MODEL,
  latencyMs: Date.now() - start,
  tokensIn: usage.promptTokens ?? 0,
  tokensOut: usage.completionTokens ?? 0,
  costUsd: computeCostUsd("kimi", ORCHESTRATOR_MODEL, { ... }),
});
```

**Import à ajouter** :

```typescript
import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";
import { defaultMetrics } from "@/lib/llm/metrics";
```

### 3.2 — `lib/engine/orchestrator/planner.ts:79-82`

Ce fichier utilise `new OpenAI(...)` directement (SDK natif OpenAI, pas Vercel AI).
Migration vers `chatWithProfile` directe possible.

**Avant (planner.ts:79-82)** :

```typescript
const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY!,
  baseURL: "https://api.hypercli.com/v1",
});
```

**Après** — remplacer tout le bloc `new OpenAI(...)` + `client.chat.completions.create(...)` :

```typescript
// Supprimer l'import OpenAI si plus utilisé
// import OpenAI from "openai";  <-- retirer

import type { SupabaseClient } from "@supabase/supabase-js";
import { chatWithProfile } from "@/lib/llm/router";

// Dans planFromIntent(), remplacer le bloc client par :
const KIMI_PLANNER_PROFILE_ID = process.env.KIMI_PLANNER_PROFILE_ID
  ?? "kimi-planner-default"; // ID à confirmer via SELECT id FROM model_profiles WHERE ...

const response = await chatWithProfile(
  sb,           // SupabaseClient — à ajouter comme paramètre de planFromIntent
  KIMI_PLANNER_PROFILE_ID,
  messages.map((m) => ({ role: m.role, content: m.content as string })),
  { max_tokens: 4096, timeoutMs: 30_000 },
  userId,       // à ajouter comme paramètre
  tenantId,     // à ajouter comme paramètre
);
const raw = response.content;
```

**Signature avant** : `planFromIntent(userMessage, conversationHistory, surface?, capabilityDomain?, discoveredActions?)`
**Signature après** : `planFromIntent(sb, userId, tenantId, userMessage, conversationHistory, opts?)`

**Tests à adapter** : `__tests__/orchestrator/planner.test.ts` — mocker `chatWithProfile` au lieu
de `OpenAI`.

### 3.3 — `lib/engine/orchestrator/run-research-report.ts:313-316`

**Avant (ligne 313-316)** :

```typescript
const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY!,
  baseURL: "https://api.hypercli.com/v1",
});
```

**Après** :

```typescript
// Dans synthesizeReport(query, search, sb, userId, tenantId)
// Ajouter sb / userId / tenantId comme paramètres optionnels

const KIMI_RESEARCH_PROFILE_ID = process.env.KIMI_RESEARCH_PROFILE_ID
  ?? "kimi-research-default";

const response = await chatWithProfile(
  sb,
  KIMI_RESEARCH_PROFILE_ID,
  [
    { role: "system", content: RESEARCH_REPORT_SYSTEM_PROMPT },
    { role: "user", content: buildResearchUserMessage(query, sourcesContext) },
  ],
  { max_tokens: 4096 },
  userId,
  tenantId,
);
return response.content;
```

**Tests à adapter** : mocker `chatWithProfile` dans `__tests__/orchestrator/research-report.test.ts`.

### 3.4 — `lib/memory/kg.ts:129`

**Avant** :

```typescript
const client = new OpenAI({ apiKey, baseURL: "https://api.hypercli.com/v1" });
```

**Note de bug existant** : `lib/memory/kg.ts:124` lit `process.env.ANTHROPIC_API_KEY` mais
l'utilise comme apiKey pour Kimi — c'est une confusion de clés. Après migration, ce bug disparaît.

**Après** :

```typescript
// Fonction extractEntitiesFromText(text, sb, userId?, tenantId?) — ajouter sb

const KIMI_KG_PROFILE_ID = process.env.KIMI_KG_PROFILE_ID ?? "kimi-kg-default";

const response = await chatWithProfile(
  sb,
  KIMI_KG_PROFILE_ID,
  [
    { role: "system", content: EXTRACTION_PROMPT },
    { role: "user", content: trimmed },
  ],
  { max_tokens: EXTRACTION_MAX_TOKENS },
  userId,
  tenantId,
);
raw = response.content;
```

**Tests à adapter** : `__tests__/memory/kg.test.ts` — mocker `chatWithProfile`.

### 3.5 — `lib/memory/mission-context.ts:404`

**Avant** :

```typescript
const client = new OpenAI({ apiKey, baseURL: "https://api.hypercli.com/v1" });
const res = await client.chat.completions.create({
  model: "kimi-k2.5",
  max_tokens: 600,
  ...
});
```

**Après** :

```typescript
const KIMI_MISSION_CONTEXT_PROFILE_ID = process.env.KIMI_MISSION_CONTEXT_PROFILE_ID
  ?? "kimi-mission-context-default";

const response = await chatWithProfile(
  sb,           // SupabaseClient — déjà disponible dans le contexte appelant
  KIMI_MISSION_CONTEXT_PROFILE_ID,
  [
    { role: "system", content: MISSION_CONTEXT_SYSTEM_PROMPT },
    { role: "user", content: userMsg },
  ],
  { max_tokens: 600 },
  userId,
  tenantId,
);
nextSummary = response.content.trim() ?? null;
```

**Tests à adapter** : `__tests__/memory/mission-context.test.ts`.

---

## Étape 4 — Migrer les 14 fichiers restants (Priorité 2)

Ordre par criticité décroissante :

| # | Fichier | Ligne | Stratégie |
|---|---------|-------|-----------|
| 1 | `lib/memory/briefing.ts` | 73 | `chatWithProfile` — PII |
| 2 | `lib/memory/conversation-summary.ts` | 29 | `chatWithProfile` — PII |
| 3 | `lib/cockpit/drift-detection.ts` | 176 | `chatWithProfile` |
| 4 | `lib/cockpit/pre-meeting-intel.ts` | 354 | `chatWithProfile` |
| 5 | `lib/inbox/inbox-brief.ts` | 214 | `chatWithProfile` — PII |
| 6 | `lib/meetings/debrief.ts` | 79 | `chatWithProfile` |
| 7 | `lib/daily-brief/generate.ts` | 215 | `chatWithProfile` (sans sb → voir note) |
| 8 | `lib/tools/native/kg-query.ts` | 120 | `chatWithProfile` |
| 9 | `lib/workflows/handlers/ai-classify-priority.ts` | 67 | `chatWithProfile` |
| 10 | `lib/workflows/handlers/ai-draft-welcome-notes.ts` | 78 | `chatWithProfile` |
| 11 | `lib/capabilities/providers/video-prompt-enricher.ts` | 72 | `chatWithProfile` |
| 12 | `lib/capabilities/providers/deepgram.ts` | 44 | Vérifier si appel réel Kimi ou erreur de copier-coller |
| 13 | `app/api/v2/assets/diff/route.ts` | 122 | `chatWithProfile` (route handler — sb via createClient) |
| 14 | `app/api/v2/personas/ab-test/route.ts` | 75 | `chatWithProfile` ×2 en parallèle (Promise.all) |

**Note `lib/daily-brief/generate.ts`** : la fonction `generateDailyBriefNarration` est appelée
depuis un cron sans SupabaseClient disponible. Deux options :
- A) Passer `sb` jusqu'à la fonction depuis le caller (recommandé — déjà fait partout ailleurs).
- B) Créer un profil Kimi resolué statiquement (contourne le fallback DB mais reste dans le router).

**Pattern pour route handlers (option `app/api/v2/...`) :**

```typescript
// Les routes Next.js ont accès au SupabaseClient via createClient(cookies())
import { createClient } from "@/lib/supabase/server";

const sb = createClient(cookies());
const response = await chatWithProfile(
  sb,
  PROFILE_ID,
  messages,
  overrides,
  scope.userId,
  scope.tenantId,
);
```

**Variable d'env PROFILE_IDs** : plutôt que de hardcoder des UUIDs, définir des constantes :

```typescript
// lib/llm/profiles.ts (nouveau fichier, ~20 lignes)
export const KIMI_PROFILE = {
  ORCHESTRATOR: process.env.KIMI_PROFILE_ORCHESTRATOR ?? "",
  PLANNER: process.env.KIMI_PROFILE_PLANNER ?? "",
  KG: process.env.KIMI_PROFILE_KG ?? "",
  MISSION_CONTEXT: process.env.KIMI_PROFILE_MISSION_CONTEXT ?? "",
  // ... etc.
} as const;
```

Alternativement : un seul `KIMI_DEFAULT_PROFILE_ID` pour tous si les paramètres sont similaires.

---

## Étape 5 — Sécurité hypercli

### 5.1 — Configurer `KIMI_BASE_URL` comme variable d'environnement

Ajouter dans `.env.example` (et documenter dans `SECURITY.md`) :

```bash
# ── Kimi (Moonshot AI via hypercli.com) ──
# ATTENTION : vérifier que hypercli.com est l'endpoint officiel Moonshot avant mise en prod.
# Moonshot officiel : https://platform.moonshot.cn/docs (non confirmé = hypercli)
# Alternative : https://api.moonshot.cn/v1
KIMI_API_KEY=
KIMI_BASE_URL=https://api.hypercli.com/v1
```

### 5.2 — Health check étendu (`lib/admin/health.ts:416`)

Le health check actuel (`GET /v1/models`) vérifie la disponibilité. Étendre pour valider :

```typescript
// Après `fromHttp("Kimi", "llm", res, ...)` :
// Ajouter validation TLS implicite (fetch Node.js vérifie le cert par défaut)
// Pas de cert pinning côté Node sans override tls.Agent — acceptable pour V1.
// Documenter dans SECURITY.md : "Kimi TLS vérifié par Node CA bundle, pas de pinning."
```

### 5.3 — TLS minimum version

Node.js 20+ force TLSv1.2 minimum par défaut. Pas de configuration supplémentaire nécessaire.
Documenter dans `SECURITY.md` section "LLM Providers" :

> Kimi endpoint : `KIMI_BASE_URL` (défaut : `https://api.hypercli.com/v1`). TLS vérifié par
> le CA bundle Node.js natif. Le domaine `hypercli.com` est supposé être un proxy officiel
> de Moonshot AI — à confirmer avec la documentation officielle avant mise en production multi-user.
> Endpoint alternatif à évaluer : `https://api.moonshot.cn/v1`.

### 5.4 — Documentation officielle Moonshot à confirmer

**Action bloquante avant go-public** : vérifier sur `platform.moonshot.cn/docs` que
`api.hypercli.com` est explicitement documenté comme endpoint officiel ou proxy first-party
de Moonshot AI. Si non confirmé, migrer vers `api.moonshot.cn/v1`.

Grep de confirmation post-migration :

```bash
# Doit retourner 0 ligne (plus aucun new OpenAI(hypercli) hors lib/llm/kimi.ts)
grep -rn "new OpenAI(" lib/ app/api/ | grep -v "lib/llm/" | grep "hypercli\|KIMI_API_KEY"

# Doit retourner 0 ligne (KIMI_BASE_URL non hardcodée hors kimi.ts)
grep -rn "api.hypercli.com" lib/ app/api/ | grep -v "lib/llm/kimi.ts"

# Confirme que kimi est dans le router
grep -n '"kimi"' lib/llm/router.ts
```

---

## Étape 6 — Tests à créer

| Test | Fichier cible | Type | Effort |
|------|---------------|------|--------|
| `KimiProvider.chat()` succès + coût | `lib/llm/__tests__/kimi.test.ts` | Vitest unit | 1h |
| `KimiProvider.streamChat()` chunks | idem | Vitest unit | 30min |
| Circuit breaker Kimi trip sur 5xx | idem | Vitest unit | 30min |
| Fallback Kimi → Anthropic sur breaker OPEN | `lib/llm/__tests__/router-kimi-fallback.test.ts` | Vitest unit | 1h |
| `getProvider("kimi")` retourne `KimiProvider` | `lib/llm/__tests__/router.test.ts` | Vitest unit | 15min |
| Metrics Kimi apparaissent post-appel | `lib/llm/__tests__/metrics-kimi.test.ts` | Vitest unit | 30min |
| `assets/diff` retourne naiveDiff si Kimi timeout | `__tests__/api/assets-diff.test.ts` | Vitest integration | 1h |
| `personas/ab-test` retry sur 429 Kimi | `__tests__/api/personas-ab-test.test.ts` | Vitest integration | 1h |

**Pattern mock kimi.test.ts :**

```typescript
import { vi } from "vitest";
import OpenAI from "openai";

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "mock response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
          model: "kimi-k2.5",
        }),
      },
    },
  })),
}));

// Note : process.env.KIMI_API_KEY = "test-key" avant l'import de KimiProvider
```

---

## Vérification finale

```bash
# 1. TypeScript clean
npx tsc --noEmit 2>&1 | grep -E "error TS"

# 2. Tests unitaires LLM passent
npx vitest run lib/llm/__tests__/

# 3. Aucun appel direct hors router
grep -rn "new OpenAI(" lib/ app/api/ | grep -v "lib/llm/" | grep "hypercli\|KIMI"
# → 0 ligne attendue

# 4. KIMI_BASE_URL non hardcodée ailleurs
grep -rn "api.hypercli.com" lib/ app/api/ | grep -v "lib/llm/kimi.ts\|\.env"
# → 0 ligne attendue (sauf .env.example)

# 5. model_profiles kimi en base
# Vérifier via Supabase dashboard ou psql
```

---

## Récapitulatif des fichiers à créer / modifier

| Action | Fichier | Lignes estimées |
|--------|---------|-----------------|
| CRÉER | `lib/llm/kimi.ts` | ~150 |
| CRÉER | `lib/llm/profiles.ts` | ~25 |
| CRÉER | `lib/llm/__tests__/kimi.test.ts` | ~80 |
| CRÉER | `lib/llm/__tests__/router-kimi-fallback.test.ts` | ~60 |
| MODIFIER | `lib/llm/router.ts` | +4 lignes (import + case) |
| MODIFIER | `lib/llm/index.ts` | +1 ligne (export) |
| MODIFIER | `lib/engine/orchestrator/ai-pipeline.ts` | hooks CB + metrics |
| MODIFIER | `lib/engine/orchestrator/planner.ts` | signature + migration |
| MODIFIER | `lib/engine/orchestrator/run-research-report.ts` | migration |
| MODIFIER | `lib/memory/kg.ts` | migration + fix bug clé |
| MODIFIER | `lib/memory/mission-context.ts` | migration |
| MODIFIER | `lib/memory/briefing.ts` | migration |
| MODIFIER | `lib/memory/conversation-summary.ts` | migration |
| MODIFIER | `lib/cockpit/drift-detection.ts` | migration |
| MODIFIER | `lib/cockpit/pre-meeting-intel.ts` | migration |
| MODIFIER | `lib/inbox/inbox-brief.ts` | migration |
| MODIFIER | `lib/meetings/debrief.ts` | migration |
| MODIFIER | `lib/daily-brief/generate.ts` | migration |
| MODIFIER | `lib/tools/native/kg-query.ts` | migration |
| MODIFIER | `lib/workflows/handlers/ai-classify-priority.ts` | migration |
| MODIFIER | `lib/workflows/handlers/ai-draft-welcome-notes.ts` | migration |
| MODIFIER | `lib/capabilities/providers/video-prompt-enricher.ts` | migration |
| MODIFIER | `lib/capabilities/providers/deepgram.ts` | vérifier / migration |
| MODIFIER | `app/api/v2/assets/diff/route.ts` | migration |
| MODIFIER | `app/api/v2/personas/ab-test/route.ts` | migration ×2 |
| MODIFIER | `.env.example` | +4 lignes |
| MODIFIER | `SECURITY.md` | section TLS Kimi |

---

## Risques identifiés spécifiques à cette migration

1. **ai-pipeline.ts incompatible avec chatWithProfile** : ce fichier utilise le SDK Vercel AI
   (`streamText`), pas le SDK OpenAI natif. La migration vers `chatWithProfile` nécessite un
   refactor profond (B11.2, effort ~1-2j). Solution court terme : brancher uniquement les hooks
   CB + metrics sans changer le client.

2. **Bug clé kg.ts:124** : `ANTHROPIC_API_KEY` utilisé comme apiKey Kimi. Post-migration
   `chatWithProfile`, la clé est gérée par `KimiProvider` — le bug disparaît automatiquement.
   Ne pas oublier de supprimer la ligne `const apiKey = process.env.ANTHROPIC_API_KEY` dans kg.ts.

3. **`daily-brief` sans SupabaseClient** : `generateDailyBriefNarration` est une fonction pure
   sans accès Supabase. Passer `sb` depuis le caller (`app/api/v2/daily-brief/generate/route.ts`)
   est la voie correcte.

4. **planner.ts** : `planFromIntent` n'a pas de paramètre `sb` actuellement. Ajouter `sb` change
   la signature — vérifier tous les callers. Grep : `grep -rn "planFromIntent" lib/ app/`.

5. **model_profiles en base** : si les profils `kimi-*` n'existent pas en DB (seed pas appliqué
   en prod), `chatWithProfile` throw `No model profile found`. Vérifier avant déploiement.
