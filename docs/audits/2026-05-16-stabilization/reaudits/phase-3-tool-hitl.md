# Re-audit Phase 3 — Tool execution + HITL crypto

**Date** : 2026-05-16
**Auditor** : claude-sonnet-4-6 (different from opus implementer)
**Scope** : B3.1 (F-010, F-011, F-012, F-102), B3.2, B3.3
**Contexte** : post-Kimi cleanup 2026-05-15 + migration k2.5

## Verdict global : **PASS**

Aucune régression détectée. 41/41 tests sécurité P3 passent. Tous les fixes du Battle Plan original tiennent.

---

## Tools dangereux inventoriés

| Tool | Localisation | HITL requis | Signature vérifiée | Status |
|------|--------------|-------------|--------------------|--------|
| `send_email` (Resend) | `lib/tools/native/extras-services.ts:119-182` | Oui, HMAC | Oui — `verifyConfirmationToken` ligne 129 | **OK** |
| `GMAIL_SEND_EMAIL` + Composio write actions | `lib/connectors/composio/to-ai-tools.ts:96-135` | Oui, HMAC | Oui — `verifyConfirmationToken` ligne 110 | **OK** |
| `schedule_inngest_job` | `lib/tools/native/extras-services.ts:344-349` | Whitelist statique 3 events | N/A (read-only) | **OK** |
| `create_scheduled_mission` | `lib/engine/orchestrator/ai-pipeline.ts:609-617` | Banni si `missionId` présent | N/A | **OK** |
| `request_daily_brief`, `run_mission`, `request_connection` | Idem | Banni si `missionId` | N/A | **OK** |

---

## Findings re-vérifiés

### F-010 — send_email HITL → **NEUTRALIZED** ✅
- Gate sur `args._confirmationToken` (et non `_preview` comme avant)
- HMAC binding : userId + tenantId + toolSlug + argsHash
- Fail-safe si scope absent
- Le PARTIAL du re-audit GL.4 (2026-05-12) est désormais clos.

### F-011 — allowedTools effectif → **NEUTRALIZED** ✅
- `_allowedTools` injecté au moment de l'exécution par `resolveCapabilityScope` (`lib/engine/orchestrator/index.ts:266`)
- Intersection appliquée AVANT `streamText` (`ai-pipeline.ts:596-603`)
- Pas de bypass par ajout tardif de tool

### F-012 — Fork bomb scheduler → **NEUTRALIZED** ✅
- Bannissement de `create_scheduled_mission`, `request_daily_brief`, `run_mission`, `request_connection` si `missionId` présent
- Guards cumulatifs avec filtre allowedTools

### F-102 — Inngest event whitelist → **NEUTRALIZED** ✅
- `INNGEST_EVENT_WHITELIST` = Set de 3 events
- `app/admin.*` et `app/email.send` bloqués

### Cross-user tool execution → **NEUTRALIZED** ✅
- `userId` + `tenantId` viennent du JWT NextAuth, pas du body
- Tokens HMAC bindent userId + tenantId → un token user A ≠ usable par user B

---

## Impact du Kimi cleanup

Commit `19f184f9` (refactor readability) a modifié `ai-pipeline.ts` (ajout `kimiWithReasoning` middleware, switch modèle `kimi(ORCHESTRATOR_MODEL)` → `kimiWithReasoning(ORCHESTRATOR_MODEL)`). Les blocs F-011/F-012 (lignes 592-617) sont **inchangés**.

Commit `22febfd8` (Kimi k2.5) a touché 1 test seulement, pas les fichiers HITL.

Les 2 routes Kimi directes (`assets/diff`, `personas/ab-test`) n'exposent aucun tool execution → hors périmètre P3.

---

## Tests passés

| Test | Résultat |
|------|----------|
| `__tests__/security/tool-hitl-confirmation.test.ts` | 7/7 ✅ |
| `__tests__/security/send-email-hitl.test.ts` | 7/7 ✅ |
| `__tests__/security/allowed-tools-runtime.test.ts` | 10/10 ✅ |
| `__tests__/security/scheduler-isolation.test.ts` | 10/10 ✅ |
| `__tests__/connectors/to-ai-tools-write-guard.test.ts` | 7/7 ✅ |
| `__tests__/security/gmail-send-hitl.test.ts` | 7/7 ✅ |
| **Total** | **41/41 ✅** |

---

## Nouveau finding

### NF-001 (low) — Dead compat backward `ctx: string` dans `toAiTools`
- **Fichier** : `lib/connectors/composio/to-ai-tools.ts:65-68`
- **Problème** : Compat backward où `ctx` peut être un string → `tenantId = ""`
- **Status réel** : path JAMAIS déclenché en prod (`ai-pipeline.ts:562` passe toujours `{userId, tenantId}`)
- **Risque** : faible — mais si un futur appelant utilise la signature legacy, le token HMAC sera émis avec `tenantId: ""` et la vérification échouera silencieusement
- **Fix proposé** : retirer l'overload string. Effort : 5 min.

---

## Recommandations

1. **NF-001** : retirer le compat backward `ctx: string` (5 min)
2. **Test intégration allowedTools** : actuellement le test copie la logique au lieu d'importer `runAiPipeline`. Ajouter un test d'intégration appelant `runAiPipeline` avec mock LLM renforcerait la couverture contre les refactors futurs.
3. **PARTIAL GL.4 F-010 confirmé clos** — peut être marqué definitively dans `BATTLE-PLAN.json`.

---

## Verdict JSON

```json
{
  "batch_id": "B3.1",
  "verdict": "PASS",
  "findings_status": {
    "F-010": "NEUTRALIZED",
    "F-011": "NEUTRALIZED",
    "F-012": "NEUTRALIZED",
    "F-102": "NEUTRALIZED"
  },
  "regressions_found": [],
  "new_findings": ["NF-001"],
  "validation_results": {
    "typecheck": "pass",
    "test_unit": "41/41 P3 security tests pass"
  },
  "approval_to_close": true
}
```
