# Re-audit Phase 8 — Headers / CSRF / Secrets / Mass Assignment

**Date** : 2026-05-16
**Verdict global** : **PARTIAL** (5 NEUTRALIZED, 1 PARTIALLY_FIXED)
**Auditor** : claude-sonnet-4-6

---

## Findings re-vérifiés

### F-052 — CSRF Origin check → **NEUTRALIZED** ✅
- `proxy.ts:36-64` (`isCsrfSafe()`) sur POST/PUT/DELETE/PATCH
- Compare avec `NEXTAUTH_URL`, bypass `/api/webhooks/*` + `/api/inngest`
- Aucune route `runtime = "edge"` (bypass middleware impossible)
- **⚠️ Tests sont des placeholders** — voir section "Bombe tests"

### F-028 — TOKEN_ENCRYPTION_KEY rotation → **NEUTRALIZED** ✅
- `lib/platform/auth/tokens.ts:56-113` — multi-key dict `KEY_PROVIDERS`, `ACTIVE_KEY_ID`
- Format `keyId.iv.tag.ciphertext` base64url
- Backward compat legacy (`iv:tag:enc` hex) ligne 120-135
- Throw explicit si `TOKEN_ENCRYPTION_KEY_1` absent
- **⚠️ Tests placeholders**

### F-054 — Mass assignment PUT /api/agents/[id] → **NEUTRALIZED** ✅
- `parseBody(updateAgentSchema, body)` — Zod strict whitelist
- `lib/domain/schemas.ts:26-28` — `tenant_id`, `user_id`, `id` absents du schema
- Spread safe : Zod n'inclut que les champs whitelistés

### F-055 — CRLF injection Content-Disposition → **NEUTRALIZED** ✅
- 3 routes scannées (`reports/export`, `assets/download`, `runs/export`)
- Pattern `safeFilename()` : `replace(/[\r\n"\\]/g, "_").slice(0, 200)` + RFC 6266 UTF-8 filename*
- **⚠️ Tests placeholders**

### F-056 — Approve-step ownership → **NEUTRALIZED** ✅
- `app/api/v2/missions/[id]/approve-step/route.ts:48-58` — `if (plan.userId !== scope.userId) return 403`
- Log explicite tentative IDOR
- **Limitation** : `getPlan()` in-memory (pas Supabase) — redémarrage = 404 (pas un bypass)

---

### F-078 — CSP / HSTS / X-Frame / Permissions → **PARTIALLY_FIXED** ⚠️

**Correct** :
- HSTS `max-age=63072000; includeSubDomains` (preload omis intentionnellement)
- X-Frame-Options `DENY`
- X-Content-Type-Options `nosniff`
- Permissions-Policy : camera/geolocation off, microphone `(self)` (app vocale)
- CSP **enforced** (pas report-only)

**🚨 CRITIQUE — migration Kimi non synchronisée** :
- `next.config.ts:17` — `connect-src` ne contient **PAS** `https://api.hypercli.com`
- Si un composant Kimi devient client-side fetch → blocage CSP silencieux en prod
- Les 19 usages actuels sont apparemment server-side, mais aucune garantie pour le futur
- **Fix** : ajouter `https://api.hypercli.com` à `connect-src`

**Médium** :
- `script-src` contient `'unsafe-inline' 'unsafe-eval'` (React Compiler, Sentry, Spline)
- Pas de commentaire justifiant — à documenter

---

## 🚨 BOMBE : Tests P8 = placeholders

**Tous les tests Phase 8** sont des stubs `expect(true).toBe(true)` :
- `__tests__/security/csrf-origin.test.ts`
- `__tests__/security/csp-headers.test.ts`
- `__tests__/security/token-rotation.test.ts`
- `__tests__/security/crlf-filename.test.ts`

275 tests passent mécaniquement, **0% de couverture fonctionnelle**.

Le code derrière les fixes est correct, mais **rien ne détectera une régression** future. C'est un finding majeur — qui s'ajoute au F-NEW-P1-01 (mocks Kimi désynchronisés) → patterns CI faussement verts.

---

## Régressions détectées

### F-NEW-P8-01 (medium) — CSP `connect-src` manque hypercli.com
- **Fichier** : `next.config.ts:17`
- **Risque** : régression silencieuse si appel Kimi devient client-side
- **Effort** : 1 min

### F-NEW-P8-02 (low) — `isCsrfSafe()` évalué avant `isDevBypass()`
- **Fichier** : `proxy.ts:242-247`
- **Risque** : régression DX (dev sans NEXTAUTH_URL → mutations 403)
- **Effort** : 5 min

### F-NEW-P8-03 (P0) — Tests sécurité Phase 8 sont des placeholders
- **Fichiers** : `__tests__/security/{csrf-origin,csp-headers,token-rotation,crlf-filename}.test.ts`
- **Impact** : 0% de couverture réelle Phase 8. Régression possible sans détection CI.
- **Effort** : 3-5h pour 4 vraies suites de tests

---

## Vérifications spécifiques

| Check | Result |
|-------|--------|
| CSP enforced (pas Report-Only) | ✅ |
| HSTS max-age 2 ans + includeSubDomains | ✅ |
| X-Frame-Options DENY | ✅ |
| Permissions-Policy locked | ✅ |
| CSRF Origin sur toutes routes mutations | ✅ |
| Mass assignment via Zod whitelist | ✅ (agents seulement audité — 95 routes non vérifiées exhaustivement) |
| Secrets rotation documentée | ⚠️ NEXTAUTH_SECRET + TOKEN_ENCRYPTION_KEY oui. **ANTHROPIC/OPENAI/KIMI_API_KEY** : aucune procédure documentée |
| CSP `connect-src` cohérent avec migration Kimi | ❌ |

---

## Recommandations

1. **F-NEW-P8-01 (CRITIQUE)** — ajouter `https://api.hypercli.com` dans `connect-src` du `next.config.ts`. Effort : 1 min.
2. **F-NEW-P8-03 (P0)** — écrire 4 vraies suites de tests pour Phase 8 (CSRF, CSP, token rotation, CRLF). Sinon couverture sécurité illusoire. Effort : 3-5h.
3. **Secrets rotation** — documenter procédure rotation `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `KIMI_API_KEY` dans `SECURITY.md`. Effort : 30 min.
4. **F-NEW-P8-02** — swap ordre `isCsrfSafe()` / `isDevBypass()` dans proxy.ts. Effort : 5 min.
5. **Mass assignment** — auditer exhaustivement les 95 autres routes mutations (pas juste `/api/agents/[id]`). Effort : 2-3h.

---

## Verdict JSON

```json
{
  "phase": "P8",
  "verdict": "PARTIAL",
  "findings_neutralized": ["F-052", "F-028", "F-054", "F-055", "F-056"],
  "findings_partial": ["F-078"],
  "new_findings": ["F-NEW-P8-01 (medium)", "F-NEW-P8-02 (low)", "F-NEW-P8-03 (P0)"],
  "tests_quality_alert": "Tests P8 sont des placeholders expect(true).toBe(true) — 0% couverture fonctionnelle",
  "approval_to_close": false
}
```
