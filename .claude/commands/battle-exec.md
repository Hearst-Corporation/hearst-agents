---
description: Exécute un batch complet du Battle Plan (orchestrateur pilote fixer + tests + re-audit + close).
argument-hint: <batch-id> (ex B0.1, B1.2)
---

# /battle-exec — Exécution d'un batch

Argument : **$ARGUMENTS**

Si `$ARGUMENTS` vide → STOP. Demander un `batch_id`. Suggérer `/battle-next` d'abord.

## Étape 0 — Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → ABORT. Refuser l'exécution. Indiquer déverrouillage via `/admin/agent-driven-dev`.

## Étape 1 — Contexte batch

!node scripts/battle-status.mjs --batch=$ARGUMENTS

Vérifier :
- batch existe → sinon ABORT message clair
- `pre_conditions` satisfaites → sinon ABORT avec liste batchs requis
- batch n'est pas déjà `done` → sinon demander confirmation (idempotency check)

## Étape 2 — Spawn battle-orchestrator

Spawner le sub-agent `battle-orchestrator` (subagent_type: `battle-orchestrator`) avec en input :
- `batch_id`: $ARGUMENTS
- Mission : exécuter le batch de bout en bout selon son workflow standard

Le `battle-orchestrator` va lui-même piloter :
1. Le fixer approprié (`auth-fixer`, `ssrf-fixer`, etc.) selon `sub_agent_recommended` du batch
2. L'agent `validator` pour `npm run validate`
3. L'agent `reauditer` pour vérification post-fix
4. Régénération HTML + marquage `done` dans `BATTLE-PLAN.json` si tout vert

## Étape 3 — Restituer le rapport final

```
Batch $ARGUMENTS — DONE | PARTIAL | FAILED
  Findings closed : F-XXX, F-YYY (n)
  Fichiers modifiés : N (voir git diff)
  Tests ajoutés : <liste>
  Validator : green | blocker <détail>
  Re-audit : neutralisé | régression <détail> | non fixé
  Commit suggéré : <message>
```

## Étape 4 — Suggérer next

Lancer mentalement `/battle-next` et proposer :
- Prochain batch recommandé
- Si phase complète : féliciter + indiquer phase suivante
- Si arrivé à GO-LIVE : annoncer la fin du Battle Plan

## Contraintes

- L'utilisateur valide le commit lui-même — jamais commit auto sauf demande explicite
- Si batch FAIL ou PARTIAL : garder `in_progress`, ne pas marquer `done`
- Si re-audit détecte une régression : ouvrir un nouveau finding F-XXX dans `findings.json`
