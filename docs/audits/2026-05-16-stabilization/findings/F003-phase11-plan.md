# F003 — Plan Phase 11 deferred + angles morts post-go-live

**Date** : 2026-05-16
**Severity** : meta-planning (priorisation P0/P1/P2 par batch)
**Phase rattachée** : Battle Plan 2026-05-10-security, Phase 11 (deferred) + hors-plan
**Status** : OPEN — recommandations à arbitrer par Adrien
**Source** : audit A10 (planner) — read-only

---

## TL;DR

La Phase 11 du Battle Plan groupe 8 batches « post-go-live hardening » (effort cumulé ~5-7 semaines solo). Aucun n'est techniquement bloquant pour la beta privée fermée actuelle, mais **3 batches deviennent P1 dès l'ouverture multi-user** (B11.1 perf shell, B11.5 wallclock LLM, B11.4 SSE auth + idempotency). Le reste reste P2 honnête.

**Angle mort majeur identifié** : aucune persistance par-run des appels LLM router. La table `runs` existe (migration 0003) mais n'est alimentée **que par l'engine** (`lib/engine/runtime/engine/index.ts`, `lib/engine/runtime/tracer.ts`). Les appels via `lib/llm/router.ts` (chat direct, mode commandeur, tool runners hors engine) **ne créent aucune ligne `runs`**. Seul `tenant_usage_daily` est mis à jour, et uniquement depuis le path engine via `cost-tracker.ts:95`. **Résultat : impossible de faire un audit per-call, debug d'erreur LLM par run-id, ou cost cap enforced par tenant**.

---

## Synthèse priorisation (solo dev, beta privée < 20 users)

| Batch | Title | Effort | Priorité | Blocking-go-public | Dépend de |
|-------|-------|--------|----------|---------------------|-----------|
| B11.1 | Layout `(user)` use client → RSC + Server Actions + cache Next.js | **5-8h + 8-15h + 8h ≈ 3-4j** (F-062/063/064/066/089) | **P1** | non (beta privée), oui (>50 users / SEO) | rien |
| B11.2 | Refactor `ai-pipeline.ts` (1282 lignes) + `console.* → logger` (648 occ.) | **1-2j + 1 sem ≈ 8-10j** | **P2** | non | rien |
| B11.3 | Perf KG (trigram `searchNodes` + BFS `findPath` + LRU `getKgContextForUser`) | **2h+2h+1h ≈ 0.5j** | **P2** | non (KG petit en beta) | rien |
| B11.4 | Gaps post-adv (SSE auth re-validation + OAuth scope check + Idempotency-Key + WORM audit + TOCTOU refresh) | **2h+3h+3h+1j+3h+1h ≈ 2-3j** | **P1** (split : SSE auth + idempotency = P1, WORM + TOCTOU = P2) | partiellement | rien |
| B11.5 | LLM hardening (wallclock agent-loop F-087 + 12 constants externalisées F-088) | **30min + 2h ≈ 0.5j** | **P1** | **oui** (un runaway = $/incident) | rien |
| B11.6 | Misc P2 (10 findings : Sentry tunnel, Langfuse trace `runAiPipeline`, `conversationHistory` cap, pdfkit OOM, .claude supply-chain, etc.) | **~1 sem cumulée**, mais granulaire | **P1 pour F-039 + F-042**, P2 pour le reste | F-042 oui (token explosion = $/user) | rien |
| B11.7 | NextAuth v4→v5 + Hearst Card revoke + slowloris stream | **2 sem** (v5 surtout) | **P2** (v4 LTS jusqu'à 2026) sauf revoke = **P1** | revoke = oui, v5 = non | rien |
| B11.8 | Payload schema versioning Inngest + Composio webhook receiver | **3j** | **P2** | non (1 deploy à la fois, pas de scheduled rolling) | rien |

**Conclusion priorisation** :
- **P1 strict (à faire avant ouverture > 20 users)** : B11.5 (1 jour), B11.4 partiel (SSE auth + Idempotency-Key + scope = 1j), B11.6 partiel (F-039 Langfuse trace runAiPipeline 1h + F-042 conversationHistory cap 5 min + F-112 Hearst Card revoke 3h) = **~2 jours total**
- **P1 dès ouverture SaaS (~50+ users)** : B11.1 perf shell (3-4j)
- **P2 confort/dette** : tout le reste (~3 semaines cumulées si on tout fait)

---

## Recommandation ordre d'exécution

1. **B11.5** (½j) — wallclock agent-loop + constants externalisées. Rapport coût/effort imbattable, débloque sécurité runtime.
2. **F-042** (5 min) — cap `conversationHistory` côté API. Une ligne. Coupe le risque token explosion par user malveillant.
3. **F-112** (3h) — revoke table Hearst Card token. URL interne 7j exposée = leak supply-chain.
4. **F-039** (1h) — Langfuse trace sur `runAiPipeline`. Chemin chaud aveugle = debug impossible en prod.
5. **B11.4 split P1** (1j) — SSE auth re-validation (F-081) + Idempotency-Key Resend/Composio (F-083) + OAuth scope re-check (F-082).
6. **Persistance LLM metrics** (voir angle mort 1, ½-1j) — créer table + hook async.
7. **B11.1 perf shell** (3-4j) — Décliner en sous-batches : (a) extraire shell server component, (b) Server Actions pour mutations critiques (chat, mission create), (c) `force-dynamic` retiré sur 24 pages admin lecture-seule.
8. **B11.6 reste + B11.3 + B11.8** — par opportunité, en interleave.
9. **B11.2** (refacto godfiles) — à faire dès qu'un agent tape sur `ai-pipeline.ts` ; sinon, friction = signe de dette.
10. **B11.7** (NextAuth v5) — repousser à 2026 Q3, sauf revoke Hearst Card déjà extrait étape 3.

---

## Angle mort 1 : Persistance LLM metrics (HORS Battle Plan — P1)

### Constat

`lib/llm/metrics.ts:170` (`LLMMetricsAggregator`) est **100 % in-memory** : rolling window 100 latencies, totaux process-local, reset à chaque reload Vercel. La doc le déclare explicitement (l.7-12, l.26 de metrics.ts).

`lib/llm/router.ts:191` et `:409` appellent `defaultMetrics.recordCall()` à chaque succès provider, mais **n'écrit jamais en DB** :
- Pas d'insert `runs` (la table `public.runs` ligne 41 de `0003_runtime_observability.sql` existe mais n'est alimentée que par `lib/engine/runtime/engine/index.ts` et `tracer.ts` côté engine).
- Pas d'appel `incrementTenantUsage()` non plus depuis le router (`incrementTenantUsage` n'est appelé QUE depuis `cost-tracker.ts:95`, qui est partie de l'engine).

**Conséquence** :
- Chat direct via `/api/v2/chat` (qui passe par `chatWithProfile` du router) → 0 trace DB.
- Mode commandeur, classifier, tool runners hors engine → 0 trace DB.
- Vercel cold start = perte totale des compteurs (process-local).
- En multi-instance Vercel, les snapshots sont par-lambda donc incohérents.
- Pas de cost cap enforceable par tenant : `tenant_usage_daily` n'a la donnée que du path engine.

### Schéma table proposé : `llm_runs`

```sql
CREATE TABLE IF NOT EXISTS public.llm_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL,
  user_id               uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id       uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  run_id                uuid REFERENCES public.runs(id) ON DELETE SET NULL, -- lien si chemin engine
  parent_trace_id       uuid,                                                -- lien si streaming chunk d'un parent
  provider              text NOT NULL,         -- 'anthropic' | 'openai' | 'gemini' | 'composer' | 'kimi'
  model                 text NOT NULL,
  profile_used          text,                  -- 'anthropic/claude-opus-4-7' (router output)
  call_kind             text NOT NULL,         -- 'chat' | 'stream' | 'tool_select' | 'classify' | 'embedding'
  input_tokens          int NOT NULL DEFAULT 0,
  output_tokens         int NOT NULL DEFAULT 0,
  cache_read_tokens     int NOT NULL DEFAULT 0,
  cache_creation_tokens int NOT NULL DEFAULT 0,
  cost_usd              numeric(10,6) NOT NULL DEFAULT 0,
  latency_ms            int,
  status                text NOT NULL,         -- 'success' | 'error' | 'cost_blocked' | 'rate_limited' | 'circuit_open'
  error_code            text,                  -- 'RATE_LIMIT_EXCEEDED' | 'LLM_TIMEOUT' | 'UNKNOWN' | ...
  error_message         text,                  -- nullable, redacted (PII strip)
  fallback_chain        text[] NOT NULL DEFAULT '{}', -- ['anthropic','openai'] si fallback déclenché
  request_id            text,                  -- correlation header (Vercel x-vercel-id ou OTel trace_id)
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_runs_tenant_created ON public.llm_runs(tenant_id, created_at DESC);
CREATE INDEX idx_llm_runs_user_created   ON public.llm_runs(user_id, created_at DESC);
CREATE INDEX idx_llm_runs_status         ON public.llm_runs(status) WHERE status != 'success';
CREATE INDEX idx_llm_runs_conversation   ON public.llm_runs(conversation_id);
CREATE INDEX idx_llm_runs_provider_date  ON public.llm_runs(provider, created_at DESC);

ALTER TABLE public.llm_runs ENABLE ROW LEVEL SECURITY;
-- Lecture user : son tenant uniquement. Écriture : service_role uniquement.
```

### Hook integration (non-bloquant)

Pattern identique à `cost-tracker.ts:94` (dynamic import + `void Promise.then().catch(() => {})`).

Lieux à patcher (read-only audit, je ne touche pas) :
- `lib/llm/router.ts:191` — succès `chatWithProfile`
- `lib/llm/router.ts:409` — succès `chatWithFallback`
- `lib/llm/router.ts:216, 300, 439, 537` — chaque branche d'erreur
- Streaming : ajouter un `finalize()` à la fin de `streamChatWithProfile` et `streamChatWithFallback` (sinon on perd le run au disconnect — voir angle mort 3).

Schéma d'appel :
```ts
void persistLlmRun({
  tenant_id, user_id, conversation_id,
  provider: profile.provider, model: profile.model,
  call_kind: 'chat',
  input_tokens: response.tokens_in,
  output_tokens: response.tokens_out,
  cache_read_tokens: response.cache_read_tokens ?? 0,
  cost_usd: response.cost_usd,
  latency_ms: response.latency_ms,
  status: 'success',
  fallback_chain: attemptedProviders, // array tracé pendant la boucle
}).catch(() => {});
```

### Effort

- Migration SQL : **30 min**
- `lib/llm/persist-run.ts` (~80 lignes, miroir de `usage-tracker.ts`) : **1h**
- Branchement router (8 sites recordCall/recordError) : **1h**
- Tests Vitest : **1h**
- Doc RUNBOOK-LLM section "Audit per-call" : **30 min**
- **Total : ½ journée à 1 jour**

### Justification P1 pour beta privée

1. **Cost governance** : sans persistance per-run par user, impossible de détecter un abus avant la fin de la journée (rollup quotidien). Un user qui pousse 100k tokens en 5 min reste invisible jusqu'au lendemain matin via `tenant_usage_daily`. À 20 users, c'est tolérable. À 50, c'est un incident facture.
2. **Debug prod** : un user dit « ça a échoué hier à 14h », tu n'as **rien** en DB pour reconstruire. Aujourd'hui Langfuse mitige partiellement, mais seulement pour le chemin engine (F-039 confirme que `runAiPipeline` est aveugle).
3. **Eval qualité** : impossible de constituer un dataset rejouable sans persistance per-call (sample input/output, latence, modèle).
4. **Multi-instance Vercel** : la metrics in-memory est par-lambda. Le dashboard `/api/admin/llm-metrics` montre les chiffres d'**une seule** lambda. Trompeur en prod.
5. **Cap cost per-tenant enforced (angle mort 4)** : impossible sans cette table.

---

## Angle mort 2 : Test panne fallback chain complète (4 providers down)

### Constat

Le router (`lib/llm/router.ts:215-225`) loop sur la fallback chain et throw `All providers in fallback chain failed` si tous claquent. Le RUNBOOK-LLM §6 documente le scénario mais aucun test e2e ne valide :
- Que l'UI chat affiche un message propre (pas crash, pas spinner infini).
- Que le run est marqué `cost_blocked` / `circuit_open` côté UI (badge rouge timeline).
- Que Sentry capture **une seule** alerte (et pas 4 — bruit).
- Que le user n'est pas billé pour la tentative qui a claqué.

### Recommandation

Test Playwright : `tests/e2e/llm-all-providers-down.spec.ts`
- Mock toutes les API LLM via MSW pour répondre 503.
- Tape un message dans le chat, vérifie le rendu d'erreur + l'absence de double-claim cost.
- **Effort : 3h**
- **Priorité** : P2 — pas bloquant beta, mais doit exister avant ouverture (test régression).

---

## Angle mort 3 : Streaming client disconnect → run cancellation

### Constat

`lib/llm/router.ts:227+` (`streamChatWithProfile`) — F-084 (P1) note déjà que `req.signal` n'est pas propagé à `streamText`. Mais le **vrai trou** est ailleurs : si le client ferme l'onglet à la moitié d'un stream :
- Le `defaultMetrics.recordCall()` peut ne jamais être appelé (selon où on est dans le generator).
- Aucun upstream abort vers Anthropic → on paye les tokens output complets côté provider.
- Le `runs.status` reste `running` éternellement côté engine.

### Recommandation

1. AbortController côté server propagé jusqu'à `provider.stream(..., { signal })`.
2. `finally {}` dans le generator : si interrompu, `recordCall({ status: 'aborted' })` + `persistLlmRun({ status: 'aborted', completed_at: now })`.
3. Côté UI, ajouter un endpoint POST `/api/v2/chat/[runId]/cancel` qui set status `cancelled`.
- **Effort** : 4h
- **Priorité** : **P1 dès qu'il y a du long-running** (genre génération artefact > 30s). En beta avec chat court, **P2**.

---

## Angle mort 4 : Cost cap per tenant/day **enforced** (pas juste tracking)

### Constat

`tenant_usage_daily` enregistre, mais **rien ne bloque**. `lib/llm/router.ts` connaît `profile.max_cost_per_run` (l.178) — un cap PAR RUN, pas par tenant/jour. Donc un tenant peut faire 10 000 runs à $0.01 et brûler $100/jour sans déclenchement.

### Recommandation

1. Avant `runProvider`, dans le router : `const usage = await getTenantUsage(tenantId, 1); if (usage.total_cost_usd >= cap) throw new TenantBudgetExceededError(...)`.
2. Cap configurable : `tenant_settings.daily_budget_usd_cap` (table existe déjà via migration 0057).
3. UI : badge cap atteint + email admin tenant à 80 %.
- **Effort** : 1 jour
- **Priorité** : **P1 dès ouverture > 20 users**, P2 beta fermée actuelle (Adrien voit la facture Vercel/Anthropic à la fin du mois).
- **Dépendance** : angle mort 1 (persistance per-run) recommandée d'abord pour granularité.

---

## Angle mort 5 : Eval qualité LLM (golden set + scoring)

### Constat

Aucun mécanisme d'éval qualité dans le repo. `lib/llm/__tests__/` couvre **comportement infra** (rate limit, circuit, metrics), pas **qualité output**. Quand on change Opus 4.6 → 4.7 (ce qui vient d'arriver, cf. memory pivot Kimi), aucune mesure objective de régression de qualité.

### Recommandation

1. `tests/llm-eval/golden/` : 30-50 inputs représentatifs avec expected behavior (pas expected output verbatim — heuristiques : doit contenir tel mot-clé, doit appeler tel tool, latence < 5s).
2. Runner Vitest qui rejoue le golden set sur les 3 modèles principaux, sortie rapport markdown.
3. CI nightly seulement (coût ~$5/run).
- **Effort** : 2 jours (setup + 30 cas)
- **Priorité** : **P2** beta, **P1** dès qu'on a un client payant qui dépend d'un comportement précis.

### Tracing distribué OTel (mentionné RUNBOOK §1 « brancher OTel/Datadog »)

Pas implémenté. `@vercel/otel` exists côté Sentry mais pas de spans LLM custom. Angle mort connu, déjà documenté. **P2**.

---

## Roadmap proposée

### Sprint 1 (1-3 jours) — Quick wins sécurité runtime
- B11.5 (½j) — wallclock + constants
- F-042 (5 min) — cap conversationHistory
- F-112 (3h) — revoke Hearst Card
- F-039 (1h) — Langfuse trace runAiPipeline
- **Persistance LLM metrics (½-1j)** — table `llm_runs` + hook router
- F-083 + F-081 (½j) — Idempotency-Key + SSE auth re-validation

### Sprint 2 (3-5 jours) — Hardening multi-user
- B11.4 reste (F-082, F-085 WORM, F-086 TOCTOU) — 1-2j
- **Cost cap per tenant enforced (angle mort 4)** — 1j
- **Streaming abort + cancellation (angle mort 3)** — ½j
- B11.6 reste (Sentry tunnel, pdfkit OOM, .claude supply-chain, active-space cookie unsigned) — 2j
- B11.3 perf KG — ½j

### Sprint 3 (5-10 jours) — Dette + perf
- **B11.1** — refacto layout `(user)` + Server Actions + cache Next.js (3-4j)
- B11.2 — refacto `ai-pipeline.ts` 1282 lignes + logger structuré (2-3j)
- **Eval qualité LLM (angle mort 5)** — 2j
- B11.8 — payload schema versioning + Composio webhook receiver (3j)

### Reporté Q3 2026
- B11.7 — NextAuth v5 migration (sauf revoke déjà sorti Sprint 1).
- Tracing OTel distribué (P2).
- Test panne fallback chain (angle mort 2, à inclure dans test:e2e nightly).

---

## Annexe : sources lues (read-only)

- `docs/audits/2026-05-10-security/BATTLE-PLAN.json` (Phase P11, 8 batches)
- `docs/audits/2026-05-10-security/findings.json` (35 findings rattachés)
- `lib/llm/metrics.ts` (in-memory confirmé l.7-12)
- `lib/llm/router.ts:191, 409` (recordCall callsites — pas de persistance DB)
- `lib/llm/usage-tracker.ts` (aggregation tenant_usage_daily, appelé uniquement depuis engine)
- `lib/engine/runtime/engine/cost-tracker.ts:74-115` (path engine vers usage-tracker)
- `app/api/admin/llm-metrics/route.ts` (lit snapshot in-memory)
- `supabase/migrations/0003_runtime_observability.sql:41-69` (table `runs`)
- `supabase/migrations/0060_tenant_usage_daily.sql` (table + RPC UPSERT)
- `docs/RUNBOOK-LLM.md` §1 §6
- `docs/GO-LIVE-MONITORING.md`
- `lib/engine/orchestrator/ai-pipeline.ts` (1282 lignes — confirme F-090 godfile)
