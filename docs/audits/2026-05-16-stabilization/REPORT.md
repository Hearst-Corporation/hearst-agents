# Rapport d'audit Hearst OS — Stabilisation 2026-05-16

**Auditor** : Claude Opus 4.7 (orchestrateur) + 10 sous-agents Sonnet 4.6 en parallèle
**Contexte** : post-Kimi cleanup 2026-05-15 + migration Kimi k2.5 sur orchestrateur
**Risk level** : solo-dev / beta privée (P0/P1 fermés systématique, P2 tolérés)

---

## TL;DR

Le Battle Plan 2026-05-10 (44/52 done) **tient** sur les phases sécurité critiques :
- ✅ **Phase 1** (auth/RBAC/RLS) — PASS, 16 findings tous neutralisés, 31 routes auditées
- ✅ **Phase 3** (tool HITL crypto) — PASS, 41/41 tests sécurité passent

Mais **3 phases sont PARTIAL** et un drift majeur post-cleanup a été détecté :
- ⚠️ **Phase 5** (rate-limit) — `/api/agents/[id]/chat` sans rate limit + budget atomic en race
- ⚠️ **Phase 6** (prompt injection) — cache web_search cross-tenant + persona fields non sanitizés
- ⚠️ **Phase 8** (headers/CSRF) — CSP n'autorise pas hypercli.com + **tous les tests P8 sont des placeholders** (`expect(true).toBe(true)`)
- 🚨 **F002 — 19 fichiers contournent le router LLM** via `hypercli.com` (PII, orchestrateur, mémoire)

**Bombe de la session** : tests sécurité Phase 8 = 0% couverture réelle. CI verte = illusion.

---

## État baseline avant / après

| Check | Avant | Après vague 1 |
|-------|-------|---------------|
| `npm run typecheck` | 33 erreurs | **0** ✅ |
| `npm run test` | 8 fails | 8 fails (pré-existants, hors P1/P3/P5/P6/P8) |
| `npm run circular` | 0 | 0 ✅ |
| `npm run audit:deps` | ENOLOCK | 1 CVE moderate (mitigée) ✅ |
| `app/api/v2/personas/ab-test/route.ts` | 500 systématique | ✅ Fonctionnelle, multi-tenant |
| Route `assets/diff` | OK mais hors router | OK mais hors router (F002) |

---

## Verdicts par phase (vague 1)

### ✅ Phase 1 — Auth / RBAC / RLS / Multi-tenant → **PASS**
- 16 findings tous NEUTRALIZED
- 31 routes API auditées (admin + v2 + agents)
- 3 migrations ownership en place (0070, 0071, 0072-0074)
- 358 tests sécurité passent
- PARTIAL GL.4 (`jobs/[jobId]/status`) confirmé durci
- **Régressions** : 0

### ✅ Phase 3 — Tool execution + HITL crypto → **PASS**
- 4 findings NEUTRALIZED (F-010 send_email, F-011 allowedTools, F-012 fork bomb, F-102 Inngest whitelist)
- 41/41 tests sécurité P3 passent
- Tools dangereux (send_email, Composio writes, schedule_inngest, scheduled_mission) tous HITL HMAC
- Cross-user impossible (userId+tenantId binding HMAC + scope JWT)
- **Régressions** : 0
- Mineur : NF-001 dead compat backward dans `to-ai-tools.ts` (P3, 5 min)

### ⚠️ Phase 5 — Rate-limit + Budget atomic → **PARTIAL**
- 5 NEUTRALIZED (F-075, F-076, F-105, F-108, F-041)
- 3 PARTIALLY_FIXED :
  - **F-098** — `/api/agents/[id]/chat` sans rate limit Arcjet (P1)
  - **F-079** — `guardAndReserveCredits` lit puis écrit (race) — atomicité dépend SQL 0029 (P1)
  - **F-127** — circuit breaker process-local, reset cold start Vercel (P1, acceptable beta privée)
- 1 NOUVEAU : **F-NEW-P5-01** — Kimi routes hors budget tenant (P1)

### ⚠️ Phase 6 — Prompt injection + RAG/KG → **PARTIAL**
- 6 NEUTRALIZED (F-044, F-045, F-046, F-047, F-049, F-119)
- 3 PARTIALLY_FIXED :
  - **F-101** — web_search cache cross-tenant (tenantId non passé) (P1)
  - **F-104** — summary LLM non validé SummarySchema (P2)
  - **F-115** — persona description/tone/styleGuide non sanitizés (P1)

### ⚠️ Phase 8 — Headers / CSRF / Secrets / Mass Assignment → **PARTIAL**
- 5 NEUTRALIZED (F-052, F-028, F-054, F-055, F-056)
- 1 PARTIALLY_FIXED :
  - **F-078** — CSP `connect-src` manque `api.hypercli.com` (P1)
- 3 NOUVEAUX :
  - **F-NEW-P8-01** — CSP block silencieux possible (P1)
  - **F-NEW-P8-02** — Dev régression CSRF/bypass order (P3)
  - **F-NEW-P8-03** — **Tests Phase 8 sont placeholders** (P0)

---

## Findings critiques (P0)

| ID | Title | Status | Effort |
|----|-------|--------|--------|
| F001 | Route ab-test cassée TS2304 | ✅ CLOSED (A2) | - |
| F003 | 33 erreurs TS bloquent CI | ✅ CLOSED (A1) | - |
| **F002** | 19 fichiers contournent router LLM via hypercli | 🔴 OPEN | 12h |
| **F-NEW-P8-03** | Tests sécurité Phase 8 placeholders | 🔴 OPEN | 5h |

---

## Findings P1 (bloquant multi-user public)

| ID | Title | Effort |
|----|-------|--------|
| F-098 | `/api/agents/[id]/chat` sans rate limit | 15min |
| F-079 | `guardAndReserveCredits` race condition | 3h |
| F-127 | Circuit breaker process-local | 6h |
| F-NEW-P5-01 | Kimi hors budget tenant (sous-ensemble F002) | 1h |
| F-101 | web_search cache cross-tenant | 10min |
| F-115 | Persona fields non sanitizés | 25min |
| F-NEW-P8-01 | CSP manque hypercli.com | 1min |
| F-MISSING-METRICS-PERSIST | router.recordCall() n'écrit pas DB | 6h |
| F004 | audit:deps cassé | ✅ CLOSED |

**Total effort P1 restant** : ~17h.

---

## Phase 11 deferred — Synthèse A10

8 batchs deferred du Battle Plan original, **priorisation pour beta privée** :

| Batch | Title | Effort | Priorité solo beta |
|-------|-------|--------|---------------------|
| B11.1 | Démonter layout (user) racine + Server Actions | 3-4j | P1 dès >20 users |
| B11.2 | Refactor godfiles + console.* → logger | 1-2j | P2 dette |
| B11.3 | Perf KG (trigram + BFS + LRU) | 1-2j | P2 dette |
| B11.4 | SSE auth + OAuth scope + Idempotency-Key | 1j | **P1 strict** |
| B11.5 | LLM wallclock + constants externalisées | ½j | **P1 strict** |
| B11.6 | Sentry tunnel + Langfuse runAiPipeline + cap historique + pdfkit | 1j | P1 partiel (F-039, F-042) |
| B11.7 | NextAuth v4 → v5 + Hearst Card revoke + slowloris | 3-5j | F-112 Hearst Card = P1 (3h isolable) |
| B11.8 | Payload schema versioning + Composio webhook receiver | 1j | P2 dette |

**Quick wins isolables P1 strict (~2j cumulés)** :
- F-042 conversationHistory cap (5min)
- F-112 Hearst Card revoke (3h)
- F-039 Langfuse trace runAiPipeline (1h)
- B11.5 wallclock LLM (½j)
- B11.4 split SSE auth + Idempotency-Key + scope (1j)

---

## Angles morts (hors Battle Plan original)

A10 a confirmé 5 angles morts P1 importants :

1. **Persistance LLM metrics** — `router.recordCall()` n'écrit JAMAIS en DB. Chat direct + commandeur + classifier passent par router et laissent zéro trace. (P1, 6h)
2. **Test panne fallback chain** — 4 providers down → UI propre, jamais testé (P2, 3h)
3. **Streaming client disconnect** — run continue après fermeture onglet, tokens facturés (P1 si long-running, 4h)
4. **Cost cap per tenant enforced** — `profile.max_cost_per_run` existe mais c'est per-run pas per-day (P1, 1j)
5. **Eval qualité LLM** — golden set + scoring absent (P2 beta, P1 client payant, 2j)

---

## Backlog priorisé (solo dev, beta privée)

### P0 — À faire avant tout (~7h)
1. F002 partial fix : intégrer Kimi dans router (4-6h pour les 5 fichiers critiques `orchestrator/*` + `memory/*`). Les autres fichiers peuvent attendre.
2. F-NEW-P8-03 : remplacer les 4 fichiers tests placeholders par vraies suites (3-5h). **Sinon couverture sécurité = théâtre.**

### P1 — Avant multi-user public (~17h)
- F-098, F-101, F-115, F-NEW-P8-01, F-NEW-P5-01 (quick wins ~2h cumulées)
- F-079 (3h), F-127 (6h)
- F-MISSING-METRICS-PERSIST (6h)
- Quick wins Phase 11 (F-042, F-112, F-039, B11.5) (~6h)

### P2 — Avant SaaS payant
- F-104 SummarySchema enforce (15min)
- F-NEW-P1-01 mocks Kimi tests cockpit (30min)
- B11.2, B11.3, B11.8
- Eval qualité LLM golden set
- Tests panne fallback chain

### P3 — Dette long terme
- NF-001, F-NEW-P8-02
- B11.7 NextAuth v5
- Cleanup résidu `HEARST_TENANT_ID` dans `lib/integrations/catalog.ts`

---

## Performance des agents (intransigeance)

| Agent | Mission | Score |
|-------|---------|-------|
| A1 | TS errors tests | ✅ Excellent — 0 errors, 120 tests pass, pas de `as any` |
| A2 | Restaurer ab-test | ✅ Excellent — restaure logique + indentation corrigée |
| A3 | Audit Kimi | ✅ **Excellent** — découverte 19 fichiers vs 2 attendus |
| A4 | Fix audit:deps | ✅ Bon — 1 CVE remontée |
| A5 | Re-audit Phase 1 | ✅ Excellent — 31 routes auditées, verdict argumenté |
| A6 | Re-audit Phase 3 | ✅ Excellent — 41/41 tests, NF-001 trouvé |
| A7 | Re-audit Phase 5 | ✅ Excellent — 3 partials détaillés |
| A8 | Re-audit Phase 6 | ✅ Excellent — 3 partials précis, fix line:col |
| A9 | Re-audit Phase 8 | ✅ **Excellent** — bombe placeholders détectée |
| A10 | Plan Phase 11 | ✅ Excellent — angle mort metrics confirmé |

**Aucune sanction.** Tous les agents ont rendu un travail exploitable avec citations fichier:ligne. Trois tentatives initiales de bypass READ-ONLY (A3, A5) ont été correctement gérées (rapport en réponse au lieu d'écriture interdite) — j'ai persisté manuellement.

**Leçon** : la consigne "READ-ONLY strict : pas d'Edit, pas de Write" + "Output dans fichier docs/..." est contradictoire et a perturbé A3, A5. À corriger pour la vague 2 : autoriser explicitement Write dans `docs/audits/2026-05-16-stabilization/`.

---

## Vague 2 — Exécution (TERMINÉE 2026-05-16)

### Résultats par agent

| Agent | Mission | Status | Output |
|-------|---------|--------|--------|
| V2-A1 | headers-fixer : CSP hypercli + CSRF order + SECURITY.md rotation | ✅ DONE | commit `bb880110` |
| V2-A2 | prompt-injection-fixer : F-101 + F-115 + F-046 edge.type | ✅ DONE | +44 tests, pattern `sanitizeTextField` |
| V2-A3 | rate-limit-fixer : F-098 chat path | ⚠️ DONE avec over-match | corrigé manuellement post-vague (regex `^/api/agents/[^/]+/(chat\|run)$`) |
| V2-A4 | tests-a11y-fixer : 4 fichiers tests P8 placeholders | ✅ DONE | commit `18d93d19`, 36 vrais tests, factorisation `lib/utils/safe-filename.ts` |
| V2-A5 | cleanup-fixer : NF-001 + mocks Kimi cockpit | ✅ DONE | commit `0dc69e8f`, 106/106 tests |
| V2-A6 | llm-auditor : plan F002 + monitoring fixers | ✅ DONE | `F002-PLAN-implementation.md` (721 lignes), 3 pièges identifiés |

### Findings fermés par la Vague 2

| ID | Title | Status final |
|----|-------|--------------|
| F-NEW-P8-01 | CSP connect-src manque hypercli.com | ✅ CLOSED |
| F-NEW-P8-02 | isCsrfSafe avant isDevBypass | ✅ CLOSED |
| F-NEW-P8-03 | Tests P8 placeholders | ✅ CLOSED (36 vrais tests) |
| F-098 | /api/agents/[id]/chat sans rate limit | ✅ CLOSED (regex précis, pas over-match) |
| F-101 | web_search cache cross-tenant | ✅ CLOSED |
| F-115 | Persona description/tone/styleGuide non sanitizés | ✅ CLOSED |
| F-046 (résiduel) | edge.type non sanitizé | ✅ CLOSED |
| NF-001 | Dead compat ctx:string | ✅ CLOSED |
| F-NEW-P1-01 | Mocks Kimi cockpit désynchronisés | ✅ CLOSED |
| Secrets rotation LLM | Procédure non documentée | ✅ CLOSED (SECURITY.md) |

**10 findings fermés en Vague 2.**

### Découvertes Vague 2

1. **Piège ai-pipeline.ts (V2-A6)** : utilise `@ai-sdk/openai` (Vercel AI SDK), pas `new OpenAI()`. Incompatible avec `chatWithProfile` sans refactor profond → migration partielle (hooks circuit-breaker/metrics seulement + lire `KIMI_BASE_URL` env).
2. **Bug latent `lib/memory/kg.ts:124`** : `apiKey` lit `process.env.ANTHROPIC_API_KEY` mais l'utilise comme clé Kimi → 401 silencieux probable depuis hypercli. Disparaît après migration.
3. **planner.ts** : ajout `sb, userId, tenantId` change signature publique → grep callers obligatoire (~5 callers à adapter).
4. **factorisation safe-filename** : V2-A4 a centralisé la logique dans `lib/utils/safe-filename.ts` (avant : dupliquée dans 3 routes).

### État final baseline (post Vague 2)

| Check | Result |
|-------|--------|
| `npm run typecheck` | **0 erreur ✅** |
| `npm run test -- __tests__/security/` | **315/320 pass, 5 skipped, 0 fail ✅** |
| `npm run circular` | 0 ✅ |
| Git commits dans la session | 4 (4e22371b, bb880110, 0dc69e8f, 18d93d19) |
| Files non commités | 2 nouveaux tests V2-A2 + F002-PLAN.md V2-A6 + fix over-match manuel |

### Backlog mis à jour

**Encore OPEN (P1) — restent ~17h pour multi-user public :**
- **F002** (12h) — 19 fichiers contournent router Kimi. **Plan complet livré** dans `F002-PLAN-implementation.md`.
- **F-079** (3h) — `guardAndReserveCredits` race condition
- **F-127** (6h) — Circuit breaker process-local (acceptable beta privée)
- **F-MISSING-METRICS-PERSIST** (6h) — router.recordCall() n'écrit pas DB
- **F-NEW-P5-01** (1h) — Routes Kimi hors budget tenant (redondant avec F002)

**OPEN (P2) :**
- F-104 SummarySchema enforce (15min)

**OPEN (P3) :**
- F-046 résiduel sur `edge.type` extra (déjà fait) — pas de résidu

---

## Prochaines vagues recommandées

### Vague 2 — Quick wins P1 (~3h, à valider avant lancement)
Spawn 6 fixers en parallèle :
1. `headers-fixer` — CSP connect-src + secrets rotation runbook (1min + 30min)
2. `prompt-injection-fixer` — F-101 tenantId + F-115 persona fields + F-046 edge.type (45min)
3. `rate-limit-fixer` — F-098 ajouter chat dans LLM_JOB_PATHS (15min)
4. `tests-a11y-fixer` — réécrire 4 fichiers tests placeholders Phase 8 (3-5h)
5. `cleanup-fixer` — NF-001 + F-NEW-P8-02 + F-NEW-P1-01 mocks Kimi (1h)
6. `llm-auditor` (audit only) — vérifier que les fixes vague 2 n'introduisent pas de régression

### Vague 3 — F002 intégration Kimi router (~12h)
Spawn `llm-auditor` (plan détaillé) puis chantier ciblé sur les 5 fichiers critiques `lib/engine/orchestrator/*` + `lib/memory/*` en premier.

### Vague 4 — F-079 + F-127 + F-MISSING-METRICS-PERSIST (~15h)
Probablement à étaler sur 2-3 jours.

---

## Artefacts produits

```
docs/audits/2026-05-16-stabilization/
├── REPORT.md (ce fichier)
├── findings.json
├── findings/
│   ├── F002-kimi-migration.md
│   └── F003-phase11-plan.md
└── reaudits/
    ├── phase-1-auth-rbac-rls.md
    ├── phase-3-tool-hitl.md
    ├── phase-5-rate-limit-budget.md
    ├── phase-6-prompt-injection.md
    └── phase-8-headers-csrf.md
```

---

## Questions restantes pour Adrien

1. **F002 ordre d'intégration** : on commence par les 5 fichiers `lib/engine/orchestrator/*` + `lib/memory/*` (PII users) ou tout d'un coup les 19 ?
2. **F-127 acceptation risque** : on tolère le breaker process-local sur beta privée et on lance Vague 4 avant multi-user public ? Ou on le persiste tout de suite ?
3. **F-NEW-P8-03 tests placeholders** : qui les a écrits comme ça ? Recherche dans git log pour comprendre l'historique avant de remplacer ?
4. **Logs prod Sentry/Langfuse** : tu m'envoies les snapshots maintenant qu'on a la baseline, ou plus tard pour SECTION 15 ?
5. **Phase 11 séquence d'attaque** : tu valides le découpage "quick wins ~2j puis hardening Vague 4" ou tu préfères tout faire en 1 chantier ?
