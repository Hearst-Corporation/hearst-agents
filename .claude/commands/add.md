---
description: Vérifie les invariants ADD des fichiers stagés avant commit
---

# ADD — Vérification invariants pré-commit

Lance cette commande avant `git commit` quand tu as modifié des fichiers.

## Étape 1 — Verrou

!cat docs/AGENT-LOCK.json

Si `locked === true` : STOP, refuse le commit, informe l'utilisateur.

## Étape 2 — Fichiers stagés

!git diff --staged --name-only

## Étape 3 — Features impactées

Pour chaque fichier stagé, identifie la feature concernée selon `docs/rules/locked-zones.md`. Pour chaque feature identifiée :

@docs/rules/locked-zones.md

## Étape 4 — Analyse

Pour chaque feature touchée, lis la spec :
@docs/features/[ID_FEATURE].md

Analyse ton changement vs les invariants de la section "Invariants verrouillés". 

## Étape 5 — Rapport

Produis un rapport :
- ✅ Features touchées sans invariant concerné → OK
- ⚠️ Features touchées avec invariants potentiellement impactés → LISTE les invariants et explique pourquoi
- 🚫 Invariant clairement violé → STOP, explique, propose update spec

Si tout est ✅ : `git commit` est autorisé.
Si ⚠️ ou 🚫 : attendre validation Adrien.

## Note
Régénère aussi le manifest si tu as modifié une spec :
!npm run features:manifest
