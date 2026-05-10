---
description: Marque un batch comme done (manuellement) + close findings + régénère HTML. À utiliser uniquement si /battle-exec a partiellement échoué et que tu valides manuellement.
argument-hint: <batch-id>
---

# Battle Plan — Close batch (manuel)

Argument : **$ARGUMENTS**

⚠ **À utiliser uniquement** si tu as validé manuellement le batch après que `/battle-exec` ait posé un blocker contournable.

Pour usage normal : utiliser `/battle-exec` qui close automatiquement après re-audit OK.

## Étape 1 — Vérification

!cat docs/AGENT-LOCK.json

Si `locked: true` → ABORT.

Lis le batch courant :

!node scripts/battle-status.mjs --batch=$ARGUMENTS

Vérifier :

- batch existe
- status actuel = `in_progress` (sinon demander confirmation)

Demande à l'utilisateur :

1. Quels findings sont VRAIMENT closed (peut être un sous-ensemble) ?
2. Y a-t-il des régressions à ouvrir comme nouveaux findings F-XXX ?
3. Confirmer : marquer `done` ?

## Étape 2 — Apply

Si confirmé :

!node scripts/battle-mark.mjs --batch=$ARGUMENTS --status=done

Et pour chaque finding closed :

!node scripts/battle-mark.mjs --finding=F-XXX --status=closed

(Adapter F-XXX à la vraie liste retournée par l'utilisateur.)

## Étape 3 — Régénérer

!npm run audit:render
!npm run battle:render

## Étape 4 — Suggérer commit

Présente :

```
✅ Batch $ARGUMENTS marked DONE manually
- Findings closed: <list>
- HTML régénéré
- Commit suggestion :

fix(security): close batch $ARGUMENTS — <description>

Closes findings: F-XXX, F-YYY
Manually closed after partial /battle-exec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

NE COMMIT PAS toi-même.
