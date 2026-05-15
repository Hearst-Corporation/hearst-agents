---
description: Re-audit isolé d'un batch ou d'un finding (read-only, par modèle différent de l'implémenteur).
argument-hint: <batch-id|finding-id> (ex B1.2 ou F-001)
---

# /battle-reaudit — Re-audit isolé

Argument : **$ARGUMENTS**

Si vide → demander un `batch-id` (`B*`) ou un `finding-id` (`F-*`).

## Étape 1 — Identifier le scope

- `$ARGUMENTS` commence par `B` → re-audit du batch entier
- `$ARGUMENTS` commence par `F-` → re-audit d'un finding seul

!node scripts/battle-status.mjs --batch=$ARGUMENTS 2>/dev/null || node scripts/battle-status.mjs --finding=$ARGUMENTS

Récupérer la liste des fichiers modifiés (`files_modified`) depuis la sortie ci-dessus.

## Étape 2 — Récupérer le diff

!git log --oneline -5

Pour les fichiers identifiés à l'étape 1, lancer :

```bash
git diff HEAD~5 -- <fichier1> <fichier2>
```

(adapter au nombre de commits qui couvrent le batch — si pas certain, utiliser `git log -- <fichier>` pour cibler).

## Étape 3 — Spawn reauditer

Spawner sub-agent `reauditer` (subagent_type: `reauditer`) avec :
- `batch_id` ou `finding_ids`
- `files_modified` (depuis étape 1)
- Mission : vérifier indépendamment que les vulnérabilités initiales sont neutralisées sans régression

Le reauditer est **read-only**, il va :
1. Lire les fichiers modifiés
2. Re-créer mentalement chaque attack scenario
3. Vérifier que le fix tient
4. Exécuter `npm run test` sur les specs concernées
5. Retourner verdict JSON

## Étape 4 — Verdict

```
Re-audit $ARGUMENTS
Verdict : PASS | PARTIAL | FAIL
Findings :
  F-001 : NEUTRALIZED
  F-002 : NEUTRALIZED
  F-003 : PARTIALLY_FIXED
Régressions :
  - <feature> : <description>
Recommandations :
  - <action concrète>
```

## Étape 5 — Action selon verdict

- **PASS** → si batch `in_progress`, suggérer `/battle-close $ARGUMENTS`. Sinon annoncer le résultat.
- **PARTIAL** → suggérer re-spawn du fixer avec recommandations en input.
- **FAIL** → re-ouvrir le batch en `pending` ou ouvrir nouveaux findings pour régressions. Proposer plan de remédiation.

## Note multi-modèle

Pour rigueur maximale, Adrien peut en parallèle :
- Lancer une session Codex et lui faire le même check
- Comparer les deux verdicts (méthode "deux modèles distincts")

Cette commande seule = couverture acceptable post-fix.
