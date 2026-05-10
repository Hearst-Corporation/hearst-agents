# Battle Workflow — Orchestration sécurité Hearst OS

Ce document est le **runbook** complet pour exécuter le Battle Plan sécurité (`docs/audits/2026-05-10-security/BATTLE-PLAN.json`) jusqu'au go-live.

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│  /battle-next  →  /battle-exec <id>  →  /battle-reaudit  →  Commit   │
│       ↑                                                       │       │
│       └──────────── npm run battle:render ←──────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
```

## Sources de vérité

| Fichier | Rôle |
|---|---|
| `docs/audits/2026-05-10-security/BATTLE-PLAN.json` | Phases + batchs + statuts + dépendances |
| `docs/audits/2026-05-10-security/findings.json` | 130 findings consolidés (4 sources) |
| `docs/audits/2026-05-10-security/AUDIT-MASTER.html` | Vue tableau filtrable des findings |
| `docs/audits/2026-05-10-security/BATTLE-PLAN.html` | Vue séquentielle phases/batchs |

## Slash commands disponibles

| Command | Rôle |
|---|---|
| `/battle-status` | État global du plan (progression par phase) |
| `/battle-next` | Recommande prochain batch éligible (deps satisfaites) |
| `/battle-exec <batch-id>` | Pilote l'exécution complète d'un batch (orchestrateur + fixer + tests + re-audit + close) |
| `/battle-close <batch-id>` | Marque batch done manuellement (uniquement si /battle-exec a partiellement échoué) |
| `/battle-reaudit <batch-id\|finding-id>` | Re-audit isolé par modèle différent |

## Sub-agents disponibles

### Orchestrateur

- **`battle-orchestrator`** (opus) — Pilote l'exécution complète d'un batch. Spawnable via `/battle-exec` ou en spawn direct.

### Fixers spécialisés (par phase du Battle Plan)

| Agent | Modèle | Phases couvertes |
|---|---|---|
| `auth-fixer` | sonnet | P0 / P1 / P3 / P8 (auth, RBAC, RLS, OAuth, sessions, multi-tenant) |
| `ssrf-fixer` | sonnet | P2 (SSRF guard, file upload caps, magic bytes) |
| `tool-hitl-fixer` | sonnet | P3 (HITL crypto, allowedTools, scheduler isolation) |
| `obs-fixer` | sonnet | P4 (Sentry/Langfuse redaction, cost tracking, assertLangfuseReady) |
| `rate-limit-fixer` | haiku | P5 (rate-limit, budget caps, atomic DB, circuit breaker per-tenant) |
| `prompt-injection-fixer` | sonnet | P6 (RAG/KG délimiteurs, spotlighting, sanitize externes) |
| `reliability-fixer` | sonnet | P7 (workers, queues, idempotency, cancel propagation) |
| `headers-fixer` | haiku | P8 (CSP, CSRF, headers, secrets rotation, mass assignment) |
| `tests-a11y-fixer` | haiku | P9 (tests credits/arcjet, jsx-a11y, ChatDock ARIA) |
| `cleanup-fixer` | haiku | P10 (deps circulaires, typing, dead code, CI lockfile) |

### Vérificateurs

- **`reauditer`** (sonnet) — Re-audit post-fix indépendant (read-only). Spawnable par `battle-orchestrator` ou `/battle-reaudit`.
- **`validator`** (haiku, existant) — `npm run validate` structuré.

### Existants utilisés en transversal

- **`route-mapper`** (haiku) — impact analysis routes API + stores
- **`llm-auditor`** (sonnet) — audit runtime LLM
- **`Plan`** (general) — design d'implémentation pour gros refactors
- **`Explore`** (general) — recherche code multi-fichiers

## Workflow standard pour exécuter un batch

### 1. Prérequis

```bash
# Vérifier état actuel
/battle-status

# Identifier prochain batch éligible
/battle-next
```

Output type :
```
🎯 Prochain batch recommandé
⏳ B0.1 — Fix CI build (visual lint + design-token test)
  Phase: P0 PHASE 0 — Pré-flight
  Effort: 1-2h
  Sub-agent: validator
  Findings (1): 🔥 F-024
  → Pour exécuter : /battle-exec B0.1
```

### 2. Exécution

```bash
/battle-exec B0.1
```

Ce qui se passe sous le capot :

1. **Pré-flight** : check `AGENT-LOCK.json`, vérifier batch existe + pre_conditions satisfaites
2. **Mark in_progress** : `node scripts/battle-mark.mjs --batch=B0.1 --status=in_progress`
3. **Spawn `battle-orchestrator`** avec `batch_id=B0.1`
4. L'orchestrateur :
   - Lit `findings.json` pour pull les détails de F-024
   - Spawn le fixer approprié (ici `validator` ou `general-purpose`)
   - Le fixer implémente les fixes
   - Spawn `validator` agent pour `npm run validate`
   - Spawn `reauditer` pour vérification post-fix
5. **Si tout green** :
   - `node scripts/battle-mark.mjs --batch=B0.1 --status=done`
   - `node scripts/battle-mark.mjs --finding=F-024 --status=closed`
   - `npm run audit:render && npm run battle:render`
   - Suggestion de commit message conventional
6. **Si fail/partial** :
   - Garde status `in_progress`
   - Documente blockers
   - Suggère re-spawn fixer OU ouverture nouveau finding

### 3. Validation manuelle (optionnelle)

Pour les batchs critiques (P0 showstoppers, B7.1 jobs orphelins) :

```bash
# Re-audit indépendant
/battle-reaudit B0.1

# Smoke test e2e
npm run test:e2e
```

### 4. Commit

L'orchestrateur **ne commit pas**. Toi tu commit après validation :

```bash
git add -A
git commit -m "fix(security): close batch B0.1 — fix CI build

Closes findings: F-024
Re-audited: ✅ by reauditer agent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

## Règles d'or

### 🔒 AGENT-LOCK respecté

Tous les scripts (`battle-mark.mjs`) checkent `docs/AGENT-LOCK.json` avant écriture. Si `locked: true`, ABORT.

### 🔄 Re-audit par modèle ≠ implémenteur

L'agent qui implémente NE re-audite JAMAIS son propre fix. `reauditer` (sonnet) re-audite les fixes opus. Pour rigueur max, lancer aussi un re-audit Codex en parallèle.

### 📋 Pre-conditions strictes

`/battle-next` ne propose qu'un batch dont **toutes** les `pre_conditions` sont status `done`. Pas de saut de phase non justifié.

### 🚫 Pas de commit auto

Aucune slash command ne commit. Toujours validation user finale.

### 📊 HTML toujours à jour

Tout changement de status → régénération automatique du HTML via `npm run battle:render` (déclenché par l'orchestrateur).

## Cas particuliers

### Batch bloqué (deps non satisfaites)

`/battle-next` ne le propose pas. Pour débloquer : compléter la pre_condition d'abord. Si vraiment bloqué (dep impossible à clore), marquer manuellement :

```bash
node scripts/battle-mark.mjs --batch=BX.Y --status=blocked --reason="dep BZ.W impossible sans rework architecture"
```

### Batch deferred (post-go-live)

Phase 11 = batchs deferred par défaut. Ne sont pas inclus dans `/battle-next`. Pour les attaquer après go-live, soit :
- Édit manuel BATTLE-PLAN.json : `status: "pending"`
- Soit nouveau Battle Plan dédié post-go-live

### Re-spawn fixer après fail

Si un fixer livre du code qui fail le re-audit :

```bash
# 1. Lire le rapport du reauditer (ce qui n'est pas fixé / ce qui a régressé)
/battle-status --batch=BX.Y

# 2. Re-spawn le fixer avec le contexte du verdict
# (battle-orchestrator le fait automatiquement, sinon manuel)

# 3. Re-run validation + re-audit
```

### Régression introduite par un fix

Si le `reauditer` détecte une régression :

```bash
# Ouvrir un nouveau finding F-XXX dans findings.json (manuel ou via prompt)
# Ne PAS marquer le batch done
# Suggérer un nouveau batch pour fixer la régression
```

## Phases du plan

Voir `BATTLE-PLAN.json` pour le détail complet. Vue compacte :

```
PHASE 0  — Pré-flight (1j)            → CI vert, déps urgentes
PHASE 1  — Foundation auth/multi-tenant (3-5j) → 🔥 SHOWSTOPPER F-095/F-096
PHASE 2  — SSRF + uploads (2-3j)
PHASE 3  — Tool execution + HITL (3-4j)
PHASE 4  — Observabilité + redaction PII (1-2j)
PHASE 5  — Rate-limit + budget (2-3j)
PHASE 6  — Prompt injection + RAG/KG (2-3j)
PHASE 7  — Reliability + jobs (3-5j)  → 🔥 RISQUE #1 prod B7.1
PHASE 8  — Headers + CSRF + secrets (2-3j)
PHASE 9  — Tests + a11y (2-3j)
PHASE 10 — Deps + cleanup + typing (2-3j)
─────────────────────────────────────  ← go-live possible ici
PHASE 11 — Post-go-live hardening (1-2 sem) [deferred]
GO-LIVE  — Checklist validation finale
```

## Cycles d'amélioration

Après go-live :

1. Réactiver Phase 11 batchs (de `deferred` → `pending`) selon priorité
2. Lancer nouveau Battle Plan pour autre scope (LLM dédié, perf, archi) :
   - Créer `docs/audits/<date>-<scope>/BATTLE-PLAN.json` même schema
   - `npm run battle:render` génère HTML

## Troubleshooting

### "Batch ne passe pas en done après /battle-exec"

- Vérifier que le `reauditer` a retourné PASS (pas PARTIAL ni FAIL)
- Vérifier `npm run validate` green
- Si tout OK : `/battle-close <batch_id>` manuel après inspection

### "Le HTML ne se met pas à jour"

```bash
npm run battle:render  # force régénération
```

### "Plusieurs batchs candidats à exécuter en parallèle"

Possible si pre_conditions overlap. Mais : ne pas paralléliser des batchs qui touchent les mêmes fichiers (risque de conflit git).

Sequence en parallèle OK :
- B4.1 (obs-fixer) + B5.1 (rate-limit-fixer) + B6.1 (prompt-injection-fixer)

Sequence à séquencer :
- B1.1 → B1.2 → B1.3 (touchent tous proxy.ts / auth)

### "Un fix touche un fichier verrouillé ADD"

Cf. `docs/AGENT-LOCK.json`. Si `locked: true` : déverrouiller via `/admin/agent-driven-dev` avant exec.

## Liens utiles

- [BATTLE-PLAN.html](2026-05-10-security/BATTLE-PLAN.html) — vue séquentielle batchs
- [AUDIT-MASTER.html](2026-05-10-security/AUDIT-MASTER.html) — vue tableau findings
- [REGISTRY.json](REGISTRY.json) — index global des audits
- [findings.json](2026-05-10-security/findings.json) — source de vérité findings
- [BATTLE-PLAN.json](2026-05-10-security/BATTLE-PLAN.json) — source de vérité plan

## Changelog

- **2026-05-11** : v1.0 workflow complet (12 sub-agents, 5 slash commands, 3 scripts orchestration, BATTLE-PLAN 52 batchs / 130 findings)
