---
description: Marque un batch comme done (manuel) + close findings + régénère HTML. Uniquement si /battle-exec a partiellement échoué.
argument-hint: <batch-id>
---

# /battle-close — Close batch (manuel)

Argument : **$ARGUMENTS**

À utiliser uniquement si tu as validé manuellement le batch après que `/battle-exec` ait posé un blocker contournable. Usage normal : `/battle-exec` close automatiquement après re-audit OK.

## Étape 1 — Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → ABORT.

!node scripts/battle-status.mjs --batch=$ARGUMENTS

Vérifier :

- batch existe
- status actuel = `in_progress` → sinon demander confirmation

## Étape 2 — Confirmation utilisateur

Demander explicitement à Adrien :

1. Quels findings sont VRAIMENT closed (peut être un sous-ensemble) ?
2. Régressions à ouvrir comme nouveaux findings F-XXX ?
3. Confirmer le passage en `done` ?

Attendre `o` ou `oui`.

## Étape 3 — Application

Si confirmé :

!node scripts/battle-mark.mjs --batch=$ARGUMENTS --status=done

Pour chaque finding closed (remplacer F-XXX par la vraie liste) :

```bash
node scripts/battle-mark.mjs --finding=F-XXX --status=closed
```

Pour chaque régression à ouvrir :

```bash
node scripts/battle-mark.mjs --new-finding --batch=$ARGUMENTS --severity=<P0|P1|P2> --title="<titre>"
```

## Étape 4 — Régénérer HTML

!npm run audit:render
!npm run battle:render

## Étape 5 — Suggérer commit

```
Batch $ARGUMENTS marked DONE manually
  Findings closed : <liste>
  HTML régénéré
  Commit suggestion :

  fix(security): close batch $ARGUMENTS — <description>

  Closes findings: F-XXX, F-YYY
  Manually closed after partial /battle-exec.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Ne commit pas toi-même.** L'utilisateur lance `git commit` après revue.
