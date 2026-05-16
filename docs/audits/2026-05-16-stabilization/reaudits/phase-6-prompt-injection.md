# Re-audit Phase 6 — Prompt injection + délimiteurs RAG/KG

**Date** : 2026-05-16
**Verdict global** : **PARTIAL** (6 NEUTRALIZED, 3 PARTIALLY_FIXED)
**Contexte** : post-Kimi cleanup + migration k2.5

---

## Findings re-vérifiés

### F-044 — Gmail HTML stripping → **NEUTRALIZED** ✅
- `lib/connectors/google/gmail.ts:121-139` (`stripEmailHtml`)
- 11 tests passent (`__tests__/security/gmail-html-strip.test.ts`)
- **Résidu mineur** : vecteurs `color:rgb(255,255,255)`, `opacity:0` non couverts (impact limité)

### F-045 — Embeddings poisoning → **NEUTRALIZED** ✅
- `lib/memory/retrieval-context.ts:89` (`fenceUntrusted("memory", ...)`)
- `lib/engine/orchestrator/system-prompt.ts:384` (spotlight header en tête)
- 25 tests passent

### F-046 — KG labels injection → **NEUTRALIZED** ✅
- `lib/memory/kg.ts:223-229` (`sanitizeKgLabel` + 8 FORBIDDEN patterns)
- `fenceUntrusted("kg", ...)` à l'affichage (`kg-context.ts:62`)
- **Résidu** : le champ `type` des edges KG n'est pas sanitisé avant `upsertEdge` (`kg-ingest-pipeline.ts:106-113`) — non injecté dans le system prompt principal actuellement

### F-047 — web_search snippets → **NEUTRALIZED** ✅
- `lib/tools/native/web-search.ts:32-51` (`fenceUntrusted("search", ...)`)

### F-049 — Browser agent HTML → **NEUTRALIZED** ✅
- `lib/browser/agent-loop.ts:262-268` (`fenceUntrusted("web_page", ...)`)
- `cleanHtmlSnippet` strip script/style/comments

### F-119 — KG query leak system prompt → **NEUTRALIZED** ✅

---

### F-101 — web_search cache cross-tenant → **PARTIALLY_FIXED** ⚠️
- `lib/tools/handlers/web-search.ts:72-73` : `hashQuery` inclut `tenantId` **quand passé**
- `lib/tools/native/web-search.ts:77` : `searchWeb` appelé **SANS** `tenantId`
- `lib/engine/orchestrator/ai-pipeline.ts:523` : `buildWebSearchTools()` appelé sans `tenantId` (alors que `resolvedTenantId` est disponible dans le scope)
- **Risque résiduel** : cache Redis keyé query-only → tenant A peut recevoir résultats produits pour tenant B. Spotlighting empêche l'injection d'instruction, mais reste une **fuite de données cross-tenant**
- **Fix** : passer `tenantId` dans `buildWebSearchTools()` → `searchWeb()` (3 lignes)

### F-104 — Conversation summary verbatim → **PARTIALLY_FIXED** ⚠️
- `SummarySchema` Zod défini (`conversation-summary.ts:17-22`)
- `fenceUntrusted("summary", ...)` à la lecture (`getSummary` ligne 150)
- **MAIS** : `compress()` retourne le texte brut LLM (Kimi k2.5) sans appliquer `SummarySchema.parse()` (`conversation-summary.ts:77-82`)
- La fence protège l'injection mais la structure bornée n'est pas enforced
- **Fix** : appliquer `SummarySchema.parse()` sur sortie `compress()`

### F-115 — Persona systemPromptAddon → **PARTIALLY_FIXED** ⚠️
- `INJECTION_PATTERNS` × 8 + `sanitizeAddon` actifs (`system-prompt-addon.ts:24-57`)
- `buildPersonaAddon` applique `sanitizeAddon` sur `systemPromptAddon`
- **MAIS** : `description`, `tone`, `styleGuide` injectés bruts dans `<persona>` sans `sanitizeAddon` (`system-prompt-addon.ts:67-82`)
- Un user qui contrôle ces champs via API persona CRUD peut injecter `</persona>` dans description/styleGuide pour sortir du bloc
- **Fix** : appliquer `sanitizeAddon` (ou strip `</persona>`) sur tous les champs

---

## Régressions détectées

**Aucune régression P6.** Les 8 tests en échec globaux sont pré-existants ou liés à Kimi migration (cf F-NEW-P1-01).

---

## Recommandations

1. **F-101 (cross-tenant cache)** — passer `tenantId` dans `buildWebSearchTools()` (`ai-pipeline.ts:523`) → `searchWeb()` (`native/web-search.ts:77`). `resolvedTenantId` est déjà dans le scope. Effort : 10 min.
2. **F-104 (summary structure)** — appliquer `SummarySchema.parse()` sur sortie `compress()` (`conversation-summary.ts:77`). Effort : 15 min.
3. **F-115 (persona fields)** — appliquer `sanitizeAddon` sur `description`, `tone`, `styleGuide` dans `buildPersonaAddon` (`system-prompt-addon.ts:67-82`). Effort : 20 min.
4. **F-046 résiduel** — sanitiser `edge.type` avant `upsertEdge` (`kg-ingest-pipeline.ts:106-113`). Effort : 10 min.

**Total effort fixes P6 PARTIAL** : ~55 min.

---

## Verdict JSON

```json
{
  "phase": "P6",
  "verdict": "PARTIAL",
  "findings_neutralized": ["F-044", "F-045", "F-046", "F-047", "F-049", "F-119"],
  "findings_partial": ["F-101", "F-104", "F-115"],
  "regressions_found": [],
  "validation_results": {
    "typecheck": "pass",
    "lint": "pass",
    "test_unit": "3083 pass / 8 fail (non liés P6)"
  },
  "approval_to_close": false,
  "blocking_multi_user_public": ["F-101", "F-115"]
}
```
