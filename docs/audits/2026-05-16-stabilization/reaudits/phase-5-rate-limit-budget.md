# Re-audit Phase 5 — Rate-limit + Budget Atomic + Circuit Breaker

**Date** : 2026-05-16
**Verdict global** : **PARTIAL** (8 findings : 5 NEUTRALIZED, 3 PARTIALLY_FIXED)
**Contexte** : post-Kimi cleanup + migration k2.5

---

## Findings re-vérifiés

### F-098 — Rate-limit chat/orchestrate → **PARTIALLY_FIXED** ⚠️
- `ajOrchestrate` (10 req/min par IP+userId) OK sur `/api/orchestrate` (`proxy.ts:172-181`)
- `/api/v2/personas/ab-test` + `/api/v2/assets/diff` dans `ARCJET_LLM_JOB_PATHS` (20 req/min) ✅
- **MAIS** : `/api/agents/[id]/chat` n'a **AUCUN** rate limit Arcjet ni `defaultRateLimiter.checkLimit()` direct
- Le path non-smart-routing (route.ts:206-229) appelle `getProvider()` direct sans passer par `router.ts:141` qui contient `checkLimit`
- **Remaining risk** : un user authentifié peut spammer `/api/agents/[id]/chat` (1 hit = 1 call Anthropic)
- **Fix** : ajouter le path dans `ARCJET_LLM_JOB_PATHS` OU appeler `checkLimit` dans le path non-smart

### F-075 — Daily-brief cap → **NEUTRALIZED** ✅
- `checkDailyCap(scope.userId, "daily-brief", 5)` (`daily-brief/generate/route.ts:63`)
- Redis INCR atomique, TTL 24h, fail-closed prod (`lib/credits/daily-caps.ts:22-61`)
- 6 tests passent — sauf 1 test "targetDate invalide" qui est **incorrect** (spec test, pas bug code)

### F-076 — Orchestrate cap budget → **NEUTRALIZED** ✅
- `PRICE_CAP_USD = 0.5` par run (`orchestrate/route.ts:98`)
- Arcjet 10 req/min par (IP, userId) isolation NAT confirmée

### F-105 — kg/ingest rate-limit → **NEUTRALIZED** ✅
- Inclus dans `ARCJET_LLM_JOB_PATHS` via `isLlmJobPath`
- `checkDailyCap` appliqué

### F-079 — Budget atomic race condition → **PARTIALLY_FIXED** ⚠️
- `reserveCreditsAtomic` (avec idempotency key) existe (`lib/credits/client.ts:90`) mais **n'est pas utilisée** par les jobs critiques
- `guardAndReserveCredits` (utilisée par jobs audio/image/code/document) fait `getBalance()` puis `reserveCredits()` → window read-then-write
- L'atomicité dépend entièrement de la migration SQL `0029` (`WHERE balance >= cost RETURNING`) — pas vérifiable depuis le code TS
- **Remaining risk** : si la migration SQL n'implémente pas le check atomique, race condition sous concurrence
- **Fix** : remplacer `guardAndReserveCredits` par `reserveCreditsAtomic` dans les jobs + ajouter test concurrent

### F-108 — Circuit breaker poisoning per-tenant → **NEUTRALIZED** ✅
- Clé breaker = `"${provider}:${tenantId}"` (`circuit-breaker.ts:15-17`)
- `tenantId` passé systématiquement (`router.ts:190,207,292,408,430,523,529`)
- Test "user A trip ne bloque pas user B" passe (`circuit-breaker-per-tenant.test.ts`)
- `httpStatus` numérique en source de vérité (anti-injection "500" dans message)

### F-041 — Erreurs transientes / retry → **NEUTRALIZED** ✅
- `isTransientError` regex 429/500/502/503/504 avec word boundary (`router.ts:69-72`)
- 12 tests, "4291" ne match pas (no false positive)

### F-127 — Metrics process-local → **PARTIALLY_FIXED** ⚠️
- Délibérément in-memory (`metrics.ts:28-30`)
- Sur Vercel multi-instance, chaque lambda part avec compteurs à zéro
- **Circuit breaker lui-même** est également process-local → un cold start reset le breaker
- Un attaquant peut "reset" le breaker en provoquant cold start (redéploiement ou inactivité)
- **Limitation connue et assumée** dans le code — mais non résolue
- **Fix proposé** : persister breaker state en Redis (existant pour daily-caps)

---

## Vérification Kimi (post-migration)

| Route | Budget tenant ? | Rate limit | Promise.all 2x ? |
|-------|-----------------|-----------|------------------|
| `/api/v2/personas/ab-test` | ❌ **NON** | Arcjet 20 req/min | ✅ Oui (2 calls // par hit) |
| `/api/v2/assets/diff` | ❌ **NON** | Arcjet 20 req/min | Non |

**Conséquence** : un user peut faire 20 req/min × 2 LLM calls = **40 appels Kimi/min hors budget tenant**.

---

## Nouveau finding

### F-NEW-P5-01 (medium) — Kimi routes contournent le budget tenant
- **Fichiers** : `app/api/v2/personas/ab-test/route.ts:108`, `app/api/v2/assets/diff/route.ts:127`
- **Severity** : medium (à upgrader vers P1 quand multi-user public — actuellement beta privée)
- **Lien** : redondant avec F002 (migration Kimi globale)
- **Fix** : intégrer Kimi dans router + ajouter `guardAndReserveCredits` (ou `checkDailyCap` minimum)

---

## Recommandations

1. **F-098** : ajouter `/api/agents/[id]/chat` dans `ARCJET_LLM_JOB_PATHS` du proxy OU appeler `checkLimit` dans path non-smart-routing (route.ts:206-229). Effort : 15 min.
2. **F-079** : remplacer `guardAndReserveCredits` par `reserveCreditsAtomic` (jobs audio/image/code/document) + vérifier migration SQL `0029` contient `WHERE balance >= cost` atomique. Ajouter test concurrent (100 hits // sur budget 50). Effort : 2-3h.
3. **F-127** : persister circuit breaker state en Redis. Pattern existant pour daily-caps. Effort : 4-6h. Acceptation risque à confirmer (cf section "Niveau de risque accepté" — solo dev beta privée = tolérable, multi-user public = bloquant).
4. **F-NEW-P5-01** : voir F002. Effort cumulé.
5. **Test daily-brief targetDate invalide** : spec test incorrecte, à corriger dans `__tests__/api/daily-brief.test.ts:106-112` (le body Zod rejette 400 avant `loadDailyBriefForDate`).

---

## Verdict JSON

```json
{
  "batch_id": "P5",
  "verdict": "PARTIAL",
  "findings_neutralized": ["F-075", "F-076", "F-105", "F-108", "F-041"],
  "findings_partial": ["F-098", "F-079", "F-127"],
  "new_findings": ["F-NEW-P5-01"],
  "approval_to_close": false,
  "blocking_multi_user_public": ["F-098", "F-079", "F-127", "F-NEW-P5-01"]
}
```
