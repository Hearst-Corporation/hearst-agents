---
description: Exécute un batch complet du Battle Plan (orchestrateur pilote fixer + tests + re-audit + close)
argument-hint: <batch-id> (ex B0.1, B1.2)
---

# Battle Plan — Exec

Argument : **$ARGUMENTS**

Si `$ARGUMENTS` est vide :

- Stop. Demande à l'utilisateur de fournir un `batch_id` (ex: `/battle-exec B1.2`).
- Suggère de lancer `/battle-next` d'abord pour voir le prochain batch recommandé.

Sinon :

## Étape 0 — Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` ci-dessus :

- ABORT. Refuse d'exécuter le batch.
- Indique à l'utilisateur de déverrouiller via `/admin/agent-driven-dev`.

## Étape 1 — Préparer le contexte

Lis le batch et ses findings :

!node scripts/battle-status.mjs --batch=$ARGUMENTS

Si batch introuvable → ABORT avec message clair.

Si pre_conditions pas satisfaites → ABORT avec liste des batchs requis avant.

Si batch déjà `done` → demander si on veut re-exécuter (idempotency check).

## Étape 2 — Spawn battle-orchestrator

Spawne le sub-agent `battle-orchestrator` avec en input :

- `batch_id`: $ARGUMENTS
- Mission : exécuter le batch de bout en bout selon son workflow standard (lire findings → mark in_progress → spawn fixer → tests → re-audit → close)

Le `battle-orchestrator` va lui-même spawner :

1. Le fixer approprié (`auth-fixer`, `ssrf-fixer`, etc.) selon `sub_agent_recommended` du batch
2. L'agent `validator` pour `npm run validate`
3. L'agent `reauditer` pour vérification post-fix
4. Régénérer HTML et marquer batch `done` dans BATTLE-PLAN.json

## Étape 3 — Restituer à l'utilisateur

Récupère le rapport final du `battle-orchestrator` et présente :

```
✅ Batch $ARGUMENTS — DONE (ou ❌ FAILED / ⚠ PARTIAL)
- Findings closed : F-XXX, F-YYY (n)
- Fichiers modifiés : <count> fichiers (voir git diff)
- Tests ajoutés : <list>
- Validator : ✅ green / ❌ blocker
- Re-audit : ✅ neutralisé / ⚠ régression / ❌ pas fixé
- Commit suggéré : <message>
```

## Étape 4 — Suggérer next

Lance mentalement `/battle-next` et propose :

- Prochain batch recommandé
- Si phase complète : féliciter + indiquer phase suivante
- Si arrivé à GO-LIVE : annoncer 🚀

## Contraintes

- L'utilisateur DOIT valider le commit lui-même (jamais commit auto sauf demande explicite)
- Si batch FAIL ou PARTIAL : ne PAS marquer done, garder `in_progress` + afficher pourquoi
- Si re-audit trouve une régression : ouvrir nouveau finding F-XXX dans findings.json
