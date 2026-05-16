# F002 — Migration Kimi et contournement du routeur LLM

**Date** : 2026-05-16
**Severity** : **P0**
**Phase rattachée** : hors Battle Plan original (régression introduite post-go-live)
**Status** : OPEN
**Source** : audit A3 (llm-auditor) — read-only

---

## TL;DR

La migration Kimi (commits `22febfd8`, `6dea15a4`, `a756607d`) ne touche pas que les 2 routes WIP (`personas/ab-test`, `assets/diff`). **19 fichiers** instancient directement `new OpenAI({ baseURL: "https://api.hypercli.com/v1" })` en contournant `lib/llm/router.ts`, et donc tous les hooks Phase 4/5/6 (circuit breaker, rate limit, metrics, cost, PII redaction, timeout, fallback).

Combiné au domaine `hypercli.com` dont l'origine n'est pas documentée dans le repo (≠ `moonshot.cn` officiel), c'est un risque sécurité + opérationnel **P0**.

---

## Constat — 19 fichiers contournent le router

| Fichier | Ligne clé |
|---|---|
| `app/api/v2/assets/diff/route.ts` | 122 |
| `app/api/v2/personas/ab-test/route.ts` | 75 (post-fix A2) |
| `lib/capabilities/providers/deepgram.ts` | 44 |
| `lib/capabilities/providers/video-prompt-enricher.ts` | 72 |
| `lib/cockpit/drift-detection.ts` | 176 |
| `lib/cockpit/pre-meeting-intel.ts` | 354 |
| `lib/daily-brief/generate.ts` | 215 |
| `lib/engine/orchestrator/ai-pipeline.ts` | 114-116 |
| `lib/engine/orchestrator/planner.ts` | 80-81 |
| `lib/engine/orchestrator/run-research-report.ts` | 314-315 |
| `lib/inbox/inbox-brief.ts` | 214 |
| `lib/meetings/debrief.ts` | 79 |
| `lib/memory/briefing.ts` | 73 |
| `lib/memory/conversation-summary.ts` | 29 |
| `lib/memory/kg.ts` | 129 |
| `lib/memory/mission-context.ts` | 404 |
| `lib/tools/native/kg-query.ts` | 120 |
| `lib/workflows/handlers/ai-classify-priority.ts` | 67 |
| `lib/workflows/handlers/ai-draft-welcome-notes.ts` | 78 |

---

## Hooks contournés (impact concret)

| Hook | Fichier source | Impact |
|---|---|---|
| **Circuit breaker** | `lib/llm/circuit-breaker.ts` | Aucun OPEN/HALF_OPEN pour Kimi. Down hypercli → timeouts en cascade |
| **Rate limiter** | `lib/llm/rate-limiter.ts` | Pas de plafond user/tenant. Abus = consommation libre |
| **Metrics** | `lib/llm/metrics.ts` | Latence, tokens, coût Kimi non agrégés |
| **Retry backoff** | `lib/llm/router.ts:74-87` | `retryWithBackoff` (exp + jitter) absent |
| **Cost tracking** | `lib/llm/pricing.ts` | Pricing Kimi présent (lignes 27-30) mais ignoré sans router |
| **Fallback chain** | `lib/llm/router.ts:105-123` | Pas de bascule Anthropic/OpenAI si Kimi down → 502 direct |
| **PII redaction (Langfuse)** | Tracer du router | KG, inbox, mission-context envoyés à hypercli sans redaction |
| **Timeout watchdog** | `lib/llm/timeout.ts` | `timeoutMs` non appliqué. `ab-test` peut bloquer indéfiniment |

---

## Risque hypercli.com

### Documenté dans le repo
- `lib/llm/pricing.ts:27` : "Kimi (Moonshot AI via hypercli)"
- URL `https://api.hypercli.com/v1` dans **18 fichiers**
- `lib/admin/health.ts:416` : health check GET `/v1/models`

### Non documenté
- Aucun commentaire/lien vers doc officielle Moonshot confirmant hypercli.com comme proxy first-party
- `hypercli.com` ≠ `moonshot.cn` (endpoint historique, cf commit `a756607d`)
- Pas de vérification TLS ni doc de chaîne de confiance

### Risques concrets
1. **MITM / interception** : si hypercli.com est un tiers non-affilié → tous les prompts (assets, personas, inbox, KG) loggués par un tiers inconnu
2. **Exfiltration PII** : `lib/memory/kg.ts`, `lib/memory/mission-context.ts`, `lib/inbox/inbox-brief.ts` envoient des données structurées d'utilisateurs (contacts, emails, réunions) sans redaction
3. **Pas de TLS cert pinning** : SDK OpenAI utilise HTTPS Node natif sans pinning → changement de cert silencieux
4. **Dépendance critique non contractuelle** : orchestrateur principal (`ai-pipeline.ts`, `planner.ts`) repose entièrement sur hypercli sans SLA

---

## Plan d'intégration router (étapes numérotées)

### Étape 1 — Créer `lib/llm/kimi.ts` (provider)
Pattern identique à `lib/llm/openai.ts` :
- `baseURL: process.env.KIMI_BASE_URL ?? "https://api.hypercli.com/v1"`
- `apiKey: process.env.KIMI_API_KEY`
- Models : `kimi-k2.5`, `kimi-k2.6`

### Étape 2 — Enregistrer Kimi dans `lib/llm/router.ts:getProvider()` (lignes 40-57)
Ajouter case `"kimi"` dans le switch → `new KimiProvider()`.

### Étape 3 — Migrer les 2 routes WIP vers `chatWithProfile()`
- `app/api/v2/assets/diff/route.ts` : remplacer `llmDiff()` par `chatWithProfile(sb, KIMI_PROFILE_ID, messages, ..., scope.userId, scope.tenantId)`
- `app/api/v2/personas/ab-test/route.ts` : remplacer les deux `runOne()` par deux `chatWithProfile()` parallèles

### Étape 4 — Vérifier les `model_profiles` Kimi en base
`lib/admin/seed.ts:37-83` a déjà 4 entrées `model_provider: "kimi"`. Vérifier `fallback_profile_id` → Anthropic Sonnet.

### Étape 5 — Migrer les 17 autres sites d'appel direct
Par ordre de criticité :
1. `lib/engine/orchestrator/ai-pipeline.ts` (orchestrateur principal)
2. `lib/engine/orchestrator/planner.ts` + `run-research-report.ts`
3. `lib/memory/*` (4 fichiers — PII)
4. `lib/cockpit/*` (2 fichiers)
5. Reste (`lib/inbox`, `lib/meetings`, `lib/workflows`, `lib/capabilities`, `lib/tools`)

---

## Env vars à ajouter dans `.env.example`

```bash
# ── Kimi (Moonshot AI via hypercli.com) ──
# Requis pour orchestrateur, mémoire, cockpit, inbox, daily-brief, assets diff, personas ab-test.
# ATTENTION : vérifier que hypercli.com est l'endpoint officiel Moonshot avant mise en prod.
KIMI_API_KEY=
KIMI_BASE_URL=https://api.hypercli.com/v1
```

`KIMI_BASE_URL` est hardcodé en 18 endroits — second problème à corriger.

---

## Tests à créer

| Test | Fichier cible | Type |
|---|---|---|
| Circuit breaker Kimi trip sur 5xx | `lib/llm/__tests__/kimi.test.ts` | Vitest unit |
| Fallback Kimi → Anthropic sur breaker OPEN | `lib/llm/__tests__/router-kimi-fallback.test.ts` | Vitest unit |
| `assets/diff` retourne `naiveDiff` si Kimi timeout | `__tests__/api/assets-diff.test.ts` | Vitest integration |
| `personas/ab-test` retry sur 429 Kimi | `__tests__/api/personas-ab-test.test.ts` | Vitest integration |
| Health check hypercli TLS valide | `lib/admin/__tests__/health-kimi.test.ts` | Vitest unit |
| Metrics Kimi apparaissent dans `defaultMetrics` post-appel | `lib/llm/__tests__/metrics-kimi.test.ts` | Vitest unit |

---

## Verification

```bash
# Vérifier que plus aucun appel direct OpenAI(hypercli) hors router :
grep -rn "new OpenAI(" lib/ app/api/ | grep -v "lib/llm/" | grep "hypercli\|KIMI_API_KEY"
# Doit retourner 0 ligne après migration complète.

# Vérifier que KIMI_BASE_URL n'est plus hardcodée :
grep -rn "api.hypercli.com" lib/ app/api/ | grep -v "lib/llm/kimi.ts"
# Doit retourner 0 ligne.
```

---

## Severity finale

**P0** — Régression sécurité + opérationnelle critique. Données PII (KG, inbox, mission-context) envoyées à un endpoint non-vérifiable (`hypercli.com`) sans circuit breaker, retry, fallback ni redaction. Bloquant pour multi-user public.

**Effort estimé** : 8-12h (Étapes 1+2+3 = 3-4h, Étape 5 = 5-8h pour les 17 fichiers restants).
