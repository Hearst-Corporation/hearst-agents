---
description: Briefing protocole Agent Driven Dev avant de bosser sur une feature.
argument-hint: [feature-id] (vide = briefing général)
---

# /feature — Briefing ADD

Lecture obligatoire avant toute modification sur une feature. Garantit verrou + invariants + autonomie.

## Étape 1 — Verrou agent

!cat docs/AGENT-LOCK.json

Si `locked: true` :

- Refuser toute écriture (Edit, Write, NotebookEdit) et toute action destructive (`rm`, `git commit`, `git push`, `mv`, drop DB).
- Citer la `reason` si présente.
- Indiquer : déverrouiller via `/admin/agent-driven-dev`.
- Lecture (Read, Grep, Glob, Bash read-only) reste autorisée.

Si `locked: false` → continuer.

## Étape 2 — Rapport maître

@docs/AGENT-DRIVEN-DEV.md

Identifier :

- Features verrouillées (statut `verrouillé v<n>`)
- Niveau de criticité (P0 / P1 / P2)
- Périmètres des invariants

## Étape 3 — Spec ciblée

Si `$ARGUMENTS` non vide, lire la spec :

```bash
cat docs/features/$ARGUMENTS.md
```

Et la rendre visible via :

@docs/features/$ARGUMENTS.md

Focaliser sur :

- **Surface publique** — ce qui peut être modifié
- **Invariants verrouillés** — interdits sans update spec
- **Évolutions autorisées** — libres
- **Tests existants** — couverture actuelle
- **Code orphelin** — code-ready non câblé

## Étape 4 — Règle d'or

Si le changement envisagé contredit un invariant :

1. STOP, ne pas coder.
2. Proposer à Adrien un update de spec :
   - Incrémenter `version spec`
   - Mettre à jour `dernière revue`
   - Documenter le changement d'invariant
3. Attendre validation explicite.
4. Une fois validé : modifier la spec → modifier le code → mettre à jour `docs/rules/locked-zones.md` si nouvelle règle → `npm run features:manifest`.

## Étape 5 — Si feature non verrouillée

Mode autonomie standard (CLAUDE.md). Décider, coder, commit, signaler.

## Étape 6 — Hygiène post-modif

Si modification de fichiers de la feature :

- Mettre à jour `dernière revue` dans `docs/features/<id>.md`
- `npm run features:manifest` si spec touchée
- Le dashboard `/admin/agent-driven-dev` se met à jour automatiquement

## Récap (3 lignes max)

```
Verrou : libre | verrouillé (reason : "...")
Feature : <id> — <statut: autonomie | verrouillée v<n> P<niveau>>
Invariants à respecter : <liste courte ou "aucun (autonomie)">
```

Attendre OK utilisateur avant de commencer.
