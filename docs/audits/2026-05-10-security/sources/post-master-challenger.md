# Audit post-master (challenger) — Hearst OS — 2026-05-10

**Source** : 5 agents parallèles externes (~600s, ~120k tokens)
**Composition** : challenger sécurité + llm-auditor + perf agent + dx agent + route-mapper
**Scope** : challenge du master audit (60 findings) + extension non-sécurité (LLM runtime, perf, archi, DX, routes)
**Statut** : verbatim, archive (stream chat persisté à demande utilisateur)

---

## Topline

L'audit master sécurité (60 findings, 6 sub-agents Claude + Codex) couvre bien auth/IDOR/SSRF/prompt-injection/code-exec mais a 8 P0 surclassés et 10 gaps critiques. Les axes non sécurité ajoutent 75 nouveaux findings.

**Verdict global** : code mature sur SSE / streaming / scope auth, mais archi web bloquée en mode "Next 13 client SPA", runtime LLM avec 3 P0 d'observabilité/billing, et dette de typage/dead code visible.

---

## Distribution P0/P1/P2 consolidée

| Axe                           | P0      | P1      | P2      | Source                  |
| ----------------------------- | ------- | ------- | ------- | ----------------------- |
| Sécurité (post-challenge)     | 17      | 25      | 14      | master + challenger     |
| Gaps sécurité non couverts    | +10     | —       | —       | challenger              |
| Runtime LLM                   | 3       | 6       | 7       | llm-auditor             |
| Perf + archi Next.js          | 9       | 17      | 8       | perf agent              |
| DX / tests / a11y / dead code | ~3      | ~10     | ~15     | dx agent                |
| Routes API / stores           | 4       | 6       | —       | route-mapper            |
| **TOTAL**                     | **~46** | **~64** | **~44** | **154 findings actifs** |

---

## 1) NOUVEAUX P0 CRITIQUES MANQUÉS PAR LE MASTER AUDIT

Ces 20 P0 ne sont dans aucun des 60 findings existants.

### Runtime LLM (3)

1. **Fuite PII Langfuse** — `lib/llm/anthropic.ts:109,208` envoie `params.messages` en clair vers cloud.langfuse.com. RGPD direct + tokens OAuth système prompt leakable.
2. **`assertLangfuseReady()` jamais appelé** dans `instrumentation.ts` — en prod, clés manquantes = zéro trace + zéro alerte, monitoring LLM aveugle.
3. **`cost_usd: 0` hardcodé** dans `openai.ts:50`, `gemini.ts:119`, `composer.ts:107` + `cost-tracker.ts:104` → `tenant_usage_daily` corrompue, quotas mensuels fantômes, overdraft invisible.

### Perf / archi Next.js (9)

4. **Layout (user) "use client" racine** (`app/(user)/layout.tsx:1`) → tout le shell user (PulseBar, Commandeur, ChatDock, RightPanel, LeftPanel) hydraté client-side, le RSC pre-fetch de `page.tsx` ne sert à rien. LCP +300-500ms.
5. **Zéro Server Action** ("use server" = 0 fichier) → 158 routes + 30+ patterns `useState(loading)+fetch+setState` dupliqués client-side, perte de `useOptimistic`/`useFormStatus`/dédup React 19.
6. **Zéro caching Next.js** (`revalidateTag`, `unstable_cache`, `next:{revalidate}` = 0 résultat) — chaque navigation hit DB + LLM. 24 pages admin en `force-dynamic`.
7. **`tsconfig.json:42-48` exclut `app/api/orchestrator` + `app/admin/orchestrator`** du typecheck → tout HOM (12 pages + 11 routes) peut contenir n'importe quoi.
8. **14× `new Anthropic({apiKey})` non mémoïsé** dans `lib/tools/native/`, `lib/inbox/`, `lib/memory/`, `lib/cockpit/`, `lib/daily-brief/`, `lib/browser/agent-loop.ts:406` → renégociation TLS et perte du keep-alive HTTP à chaque appel.
9. **`lucide-react@^1.14.0`** (`package.json:90`) — version suspecte (lucide-react officielle est en v0.x), 0 import dans le code, possible supply chain risk.
10. **5 dépendances circulaires (madge)** : `chat/Block↔BlockActions`, `cockpit/agenda-live↔today`, `composio/connections↔discovery`, `platform/settings↔settings/system`, `providers/registry↔types`. Le #4 (settings) est dangereux : `undefined` runtime selon ordre d'init.
11. **`lib/marketplace/store.ts:147-161`** : 3 helpers `function table(): any` exposés → erreurs query silencieuses.
12. **9× `(db.from("personas" as any) as any)`** dans `lib/personas/store.ts` — cause racine : `lib/database.types.ts` Supabase pas regen depuis création de la table.

### A11y / DX (3)

13. **`eslint-plugin-jsx-a11y` installé mais désactivé** dans `eslint.config.mjs` — préventif sur tous les futurs commits, quick win 25 min.
14. **ChatDock = zéro `aria-*` / `role` / `onKeyDown`** (`app/(user)/components/ChatDock.tsx`) — zone d'input principale, screen-readers totalement aveugles.
15. **`e2e/reports/api-auth.spec.ts:29` skipped en CI** parce que "Auth bypass actif côté serveur (dev fallback)" → la vraie sécurité auth n'est jamais testée.

### Tests / facturation (2)

16. **Zéro test sur `lib/credits/*`** (252 lignes — facturation), `lib/security/arcjet.ts` (130 lignes — rate limit + bot protection), `lib/agents/*` (sauf dual-apps).

### Surface API (3)

17. **`/api/orchestrate`** : pas de Zod sur le body, SSE 300s, pas de price cap LLM par requête.
18. **`/api/v2/daily-brief/generate`** + `/api/v2/simulations/start` : pas de daily cap, pas de budget cap, multi-calls LLM amplifiables.
19. **`/api/v2/documents/upload`** : `file.type === 'application/pdf'` (trustable client uniquement), pas de MAX_BYTES, pas de magic-byte check.

### Persistence (1)

20. **`localStorage` `useNavigationStore`** stocke threads + messages en clair (clé `hearst-navigation`) — exfil triviale si XSS un jour.

---

## 2) GAPS DU MASTER AUDIT (10 axes non couverts par Claude+Codex)

1. **CSP / security headers** — Content-Security-Policy, X-Frame-Options, HSTS, Permissions-Policy absents de `next.config.ts` malgré HTML potentiellement contaminé (F-016, KG, reports).
2. **Race conditions DB sur quotas/crédits** — pattern `getBalance → check → reserveCredits` non atomique (`lib/credits/client.ts:119-148`) ; aucun `SELECT FOR UPDATE` ni `INSERT...ON CONFLICT DO UPDATE` mentionné. Confirmé par P2-6 du llm-auditor.
3. **Supply chain au-delà des CVE** — pas de `--frozen-lockfile` en CI ? `lucide-react@^1.14.0` suspect ; transitives `composio`/`inngest`/`recall-ai` jamais auditées.
4. **SSE auth long-lived** — `/api/orchestrate`, `/api/v2/jobs/*/progress`, `/api/admin/events-stream` : aucune re-validation périodique du token JWT pendant la connexion.
5. **OAuth scope creep** — scopes Google jamais re-vérifiés avant `gmail.send` côté serveur ; downgrade attacks possibles.
6. **`Idempotency-Key` absents** sur Resend / LlamaParse / Composio / Browserbase calls externes → retry = double bill.
7. **SSE backpressure** — `req.signal` pas propagé jusqu'à `streamText` sur `/api/orchestrate` ; en cas de client disconnect silencieux + serverless context maintenu = accumulation mémoire.
8. **Audit log integrity** — admin compromis peut effacer runs, aucun WORM, pas de signatures, pas de Sentry breadcrumbs structurés security events.
9. **TOCTOU OAuth refresh** — `saveTokens`/`getTokens` non transactionnel, refresh token rotated entre temps = vieux token utilisé.
10. **CSRF state-changing POST** — `/api/admin/agent-lock` POST `{locked: true}` trivialement déclenchable si admin pwn (chaîne F-001 + F-052) ; pas d'`Origin` check dans `proxy.ts`.

---

## 3) RECLASSEMENTS DU MASTER AUDIT

### Upgrades (P2→P1, P1→P0)

- F-052 CSRF P2→P1 : aucun Origin check, NextAuth SameSite=Lax mitige GET pas POST
- F-054 mass assignment agents P2→P1 : combiné F-002 = cross-tenant via champs non whitelistés
- F-056 approve-step ownership P2→P1 : tout user peut approve les plans d'autres
- F-040 cost_usd hardcodé P1→P0 (business) : confirmé par llm-auditor
- F-038 assertLangfuseReady manquante P1→P0 : confirmé par llm-auditor
- F-048 query_axiom_logs P1→P0 : exfil cross-tenant via prompt injection direct
- F-049 browser agent HTML P1→P0 : prompt injection → take-over OAuth user

### Downgrades

- F-013, F-014 RLS P0→P1 : l'app utilise service_role partout → RLS ≠ enforcement primaire (défense en profondeur seulement)
- F-016 captionHtml P0→P1 : risque conditionné à user-controlled string atteignant le composant
- F-021 service-role-key dans page server P0→P2 : server-side, jamais bundlé
- F-022 proxy.ts edge throw P0→P1 : reliability, pas vuln
- F-023 run_code blacklist P0→P1 si E2B config OK (sinon P0)
- F-019 asset cleanup P0→P1 : reliability
- F-027 timing attack P1→P2 : impraticable HTTPS Internet
- F-030 Composio webhook P1→P2 ou faux positif si triggers non configurés
- F-036 payload schema versioning P1→P2 : hardening hypothétique

### False positive

- F-059 pre-commit hook supply chain : raisonnement circulaire, drop.

---

## 4) DEAD CODE — Plan de purge

**Fichiers (33)**

- Module `components/spatial/` v1 + `hooks/spatial/` + `providers/spatial/` + `styles/spatial/` + `lib/spatial/index.ts` (12 fichiers — pivot vers `spatial-v2/`)
- 7 composants cockpit morts : `AgentWorking`, `CockpitHeader`, `CockpitHome`, `MissionBudgetBadge`, `MorningBriefing`, `TodayAgenda`, `WhenYouHave5Min`
- 3 runtime obsolètes : `lib/engine/runtime/replay.ts`, `tool-executor.ts`, `workflow-engine.ts`
- Pollution racine : `test_orb.js`, `update_css.sh`, 4 PNG QA passées
- 2 deps inutilisées : `lucide-react` (P0 supply chain), `gsap` (6.3MB pour rien — sauf si `hooks/spatial/useSpatialGSAP.ts` revit)
- 36 tokens CSS jamais référencés dans `app/globals.css`
- 66 routes API potentiellement orphelines (recoupe DX agent + route-mapper)

**Exports / types** : 193 exports + 373 types orphelins (knip), ~30% faux positifs intra-fichier — à filtrer manuellement.

---

## 5) RÉCAP CHIFFRES BRUTS

| Indicateur                    | Valeur                                         |
| ----------------------------- | ---------------------------------------------- |
| Routes API totales            | ~155-158                                       |
| Routes auth-protégées         | 90%                                            |
| Routes validées Zod           | 23% (~36)                                      |
| Routes rate-limitées          | 3% (5)                                         |
| Stores Zustand                | 17 (5 persist localStorage)                    |
| Fichiers "use client"         | 298 (217 dans app/(user)/)                     |
| Suspense boundaries           | 9 (6 réelles hors spatial)                     |
| `console.*` en code prod      | 648 (top : scheduler.ts:22, ai-pipeline.ts:20) |
| `: any` / `as any` explicites | 30-47 selon scope                              |
| `@ts-ignore`                  | 2 (justifiés peer deps)                        |
| `eslint-disable`              | 113 (~30% paresseux)                           |
| Tests fichiers                | 284 (263 unit + 21 e2e)                        |
| Tests `vi.mock`               | 275 (bonne discipline)                         |
| Tests skipped/conditionnels   | 58 (top : reports/auth)                        |
| Server Actions ("use server") | 0                                              |
| Cache Next.js usages          | 0                                              |
| Fichiers > 600 lignes (prod)  | 11                                             |
| ai-pipeline.ts                | 1114 lignes + 20 console                       |
| Magic numbers (top file)      | `lib/cockpit/monthly-card-view.tsx:54`         |
| Dépendances circulaires       | 5                                              |

---

## 6) CHIFFRES EN DUR LLM RUNTIME (extraits du tableau de 33)

| File:line                   | Constante            | Valeur                    | Risque                                            |
| --------------------------- | -------------------- | ------------------------- | ------------------------------------------------- |
| `router.ts:58`              | retry codes          | `429\|502\|503`           | Manque 500, 504                                   |
| `router.ts:73`              | jitter               | `base * 0.2`              | ±20% petit vs thundering herd                     |
| `anthropic.ts:262`          | max_tokens default   | 4096                      | Tronque silencieusement (Sonnet 8192, Opus 16384) |
| `anthropic.ts:304`          | auto-cache           | 500 chars                 | "~125 tokens" approx grossière                    |
| `circuit-breaker.ts:11`     | failureThreshold     | 5                         | Pas configurable, race serverless                 |
| `circuit-breaker.ts:12`     | resetWindowMs        | 60000                     | 1 min trop court pour Anthropic outages           |
| `rate-limiter.ts:56-58`     | proactive seuils     | 5 req / 1000 tok / 1000ms | Trivial pour appels 100k tokens                   |
| `ai-pipeline.ts:733`        | stopWhen stepCountIs | 10                        | Pas configurable par agent                        |
| `ai-pipeline.ts:738`        | maxOutputTokens      | 8000                      | Incohérent vs MAX_STREAMING_TOKENS: 10000         |
| `ai-pipeline.ts:759`        | LOOP_ABORT_THRESHOLD | 3                         | 3 calls identiques abort                          |
| `browser/agent-loop.ts:422` | maxSteps             | min(15, 30)               | Pas de wallclock → 15min runaway possible         |
| `browser/agent-loop.ts:449` | max_tokens call      | 1024                      | Tool-use complexe tronqué                         |

---

## 7) TOP 15 QUICK WINS (< 1h chacun)

1. `npm uninstall lucide-react gsap` — supply chain + 44MB node_modules
2. Activer `eslint-plugin-jsx-a11y` dans `eslint.config.mjs`
3. Ajouter `assertLangfuseReady()` + `process.on("beforeExit"/"SIGTERM")` flush dans `instrumentation.ts`
4. Patch `router.ts:58` → `\b(429|500|502|503|504)\b`
5. Helper `getAnthropicClient()` singleton + remplacer 14× `new Anthropic({apiKey})`
6. Ajouter `app/error.tsx`, `app/not-found.tsx`, `app/(user)/error.tsx`, `app/admin/error.tsx`
7. Helper `withSentryContext()` qui pose `setUser` + `setTag("tenant", …)` au début de chaque API route
8. Supprimer `test_orb.js`, `update_css.sh`, déplacer PNG racine vers `.qa-snapshots/`
9. Purger `components/spatial/` legacy (12 fichiers)
10. CSP headers minimaux dans `next.config.ts` (`headers()` avec `default-src 'self'` + Sentry/Langfuse exceptions)
11. Backoff proactif Anthropic : `defaultRateLimiter.getNextDelay("anthropic")` avant chaque call
12. Per-chunk idle timeout streaming (15s) avec setInterval watchdog dans `anthropic.ts streamChat`
13. `import "server-only"` au top de `lib/llm/*`, `lib/connectors/*/client.ts`, `lib/embeddings/*`
14. Migration `console.error` → `logger.error` (pino) sur top 10 fichiers (commencer par `scheduler.ts`, `ai-pipeline.ts`)
15. Désactiver l'auth bypass dans `e2e/reports/api-auth.spec.ts` ou cloner suite avec bypass off

---

## 8) TOP 5 CHANTIERS STRUCTURELS

### Chantier A — Démonter le layout "use client" racine (user) (5-8h)

Toute optim client (React Compiler, Suspense streaming, Server Actions) bridée tant que le shell est client component géant. Extraire `<UserShellClient>` qui n'enveloppe que ce qui a besoin (SessionProvider + hotkeys + voice mount). Bénéfice : LCP -300/-500ms, hydration FID lourdement réduite.

### Chantier B — Cache Next.js + Server Actions sur les mutations (8-15h)

0 revalidation, 0 cache, 158 routes API. Convertir 10-15 mutations fréquentes (mission CRUD, chat send, persona CRUD, settings, asset rename) en Server Actions avec `revalidateTag` ciblé. Tagger les fetches "lecture froide" (`getCockpitToday`, `getDailyBrief`, `listReports`) avec `next:{tags:["cockpit:${userId}"], revalidate:60}`.

### Chantier C — Refonte runtime LLM (5-8h)

- Redaction PII Langfuse via `redactMessages()` central
- Cost tracking propagé jusqu'à `tenant_usage_daily` (fix F-040 + cost-tracker.ts:104)
- Circuit breaker + rate-limiter persistés Redis (sortir du in-process serverless)
- Per-chunk watchdog streaming
- Wallclock timeout sur agent-loop.ts (cap 5min)
- Singleton clients Anthropic + flush Langfuse SIGTERM

### Chantier D — Sprint sécurité 17 vrais P0 + 10 gaps (10-15j)

Bloc auth/IDOR : F-001 admin RBAC, F-002/F-004/F-025 IDOR, F-003 conversations, F-005 browserbase takeover, F-006 Slack OAuth state HMAC, F-008 SSRF LlamaParse, F-010/F-011/F-012 tools enforcement, F-015 fallback email. Bloc gaps : CSP headers, race DB quotas, idempotency keys, SSE auth re-validation, audit log WORM.

### Chantier E — Typage strict + dead code (6-10h)

- Régénérer `lib/database.types.ts` Supabase pour inclure `personas`, `simulation_runs`, `marketplace_*`
- Supprimer 30+ `as any` patterns
- Retirer `app/api/orchestrator` + `app/admin/orchestrator` de `tsconfig.exclude` (ou créer `tsconfig.hom.json` strict en CI séparé)
- Purger les 33 fichiers morts identifiés par knip
- Tests P0 manquants : `lib/credits/*`, `lib/security/arcjet.ts`, `lib/agents/*`, workers Inngest

---

## 9) VERDICT GLOBAL

**Forces** : SSE bien câblé (heartbeat 20s, AbortController), retry+jitter présent, scope auth omniprésent, rate-limit headers Anthropic correctement parsés, 17 stores Zustand sans duplication d'état, discipline tests OK (275 mocks), 8 TODO/FIXME seulement, 2 @ts-ignore justifiés, hook `useModalA11y` centralisé bien fait.

**Faiblesses systémiques** :

- Archi web stuck en mode "Next 13 client SPA" alors qu'on est sur Next 16 + React 19 (0 server action, 0 cache, layout client racine)
- Runtime LLM avec 3 P0 d'observabilité/billing que personne ne verra avant la première facture explosée
- Master audit sécurité solide mais 10 gaps majeurs (CSP, races DB, supply chain, SSE long-lived, OAuth scopes, idempotency, audit logs)
- `lucide-react@^1.14.0` suspect + 0 import = signal supply-chain à creuser maintenant
- `tsconfig` exclut HOM = trou noir au build

**Prochaine étape recommandée** : sprint A = 15 quick wins (1 journée), puis chantiers C (runtime LLM) et D (P0 sécurité) en parallèle, puis A (layout client) et E (typage). Chantier B (cache + Server Actions) peut attendre la stabilisation des invariants ADD.
