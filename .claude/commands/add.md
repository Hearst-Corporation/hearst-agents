---
description: Vérifie les invariants ADD des fichiers stagés avant commit (verrou, zones, specs).
---

# /add — Vérification invariants pré-commit

Garde-fou avant `git commit`. Vérifie verrou agent + invariants des features touchées + manifest à jour.

## Étape 1 — Verrou agent

!cat docs/AGENT-LOCK.json

Si `locked: true` → STOP. Refuser le commit. Informer l'utilisateur, citer la `reason`. Indiquer qu'il doit déverrouiller via `/admin/agent-driven-dev`.

## Étape 2 — Fichiers stagés

!git diff --staged --name-only

Si zéro fichier stagé → rien à vérifier, indiquer "git add nécessaire d'abord".

## Étape 3 — Mapping fichier → feature

Lire `docs/rules/locked-zones.md` :

@docs/rules/locked-zones.md

Pour chaque fichier stagé, déterminer quelle(s) feature(s) il touche via les patterns du fichier `locked-zones.md`. Construire la liste unique des features impactées.

## Étape 4 — Lecture des specs touchées

Pour chaque feature_id identifiée, ouvrir `docs/features/<feature_id>.md` via :

```bash
cat docs/features/<feature_id>.md
```

Identifier :

- statut (verrouillé v<n> ou autonomie)
- section "Invariants verrouillés"
- section "Évolutions autorisées"

## Étape 5 — Diff vs invariants

Pour chaque feature verrouillée touchée, comparer le diff staged avec les invariants :

```bash
git diff --staged -- <fichiers concernés>
```

Classer chaque finding :

- ✅ Pas de contradiction avec invariants
- ⚠ Possible impact sur invariant — demander revue avant commit
- 🚫 Invariant clairement violé — STOP

## Étape 6 — Manifest features

Si un fichier `docs/features/*.md` est stagé :

!npm run features:manifest

Vérifier que `docs/features/_manifest.json` est aussi stagé. Sinon proposer :

```bash
git add docs/features/_manifest.json
```

## Étape 7 — Rapport

```
ADD pre-commit · N fichiers stagés
Features touchées : <liste>
  ✅ <feat-a> : aucun invariant impacté
  ⚠ <feat-b> : section X.Y à revoir manuellement
  🚫 <feat-c> : invariant Z violé — STOP
Manifest : à jour | régénéré et stagé | nécessite git add
```

Verdict :

- Tout ✅ et manifest OK → commit autorisé.
- Au moins un ⚠ → afficher détail, demander confirmation utilisateur explicite.
- Au moins un 🚫 → STOP, proposer update spec (incrémenter `version spec`) avant tout commit.

**Ne commit jamais toi-même** — l'utilisateur lance `git commit` après ton OK.
