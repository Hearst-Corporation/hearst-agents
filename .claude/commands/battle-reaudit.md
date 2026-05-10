---
description: Lance un re-audit isolé sur un batch ou un finding spécifique (par modèle différent de l'implémenteur)
argument-hint: <batch-id|finding-id>
---

# Battle Plan — Re-audit

Argument : **$ARGUMENTS**

Si `$ARGUMENTS` vide → demander batch_id ou finding_id.

## Étape 1 — Identifier le scope

Si `$ARGUMENTS` commence par `B` (e.g. `B1.2`) → re-audit du batch entier.
Si `$ARGUMENTS` commence par `F-` (e.g. `F-001`) → re-audit d'un finding seul.

!node scripts/battle-status.mjs --batch=$ARGUMENTS 2>/dev/null || node scripts/battle-status.mjs --finding=$ARGUMENTS

## Étape 2 — Récupérer git diff

```bash
git log --oneline -5
git diff HEAD~5 -- <files_modified>
```

(Adapter selon ce qu'il faut auditer.)

## Étape 3 — Spawn reauditer

Spawne sub-agent `reauditer` avec :
- `batch_id` ou `finding_ids`
- `files_modified` (depuis git diff)
- Mission : vérifier indépendamment que les vulnérabilités initiales sont neutralisées sans régression

Le reauditer est read-only, il va :
1. Read les fichiers modifiés
2. Re-créer mentalement chaque attack scenario
3. Vérifier que le fix tient
4. Run npm run test sur les specs concernées
5. Retourner JSON verdict

## Étape 4 — Présenter le verdict

```
🔍 Re-audit $ARGUMENTS
Verdict: PASS | PARTIAL | FAIL
Findings status:
  F-001: NEUTRALIZED ✅
  F-002: NEUTRALIZED ✅
  F-003: PARTIALLY_FIXED ⚠
Régressions détectées:
  - <feature>: <description>
Recommandations:
  - <action>
```

## Étape 5 — Action selon verdict

- **PASS** : Si batch en `in_progress`, suggérer `/battle-close $ARGUMENTS`. Sinon juste annoncer le résultat.
- **PARTIAL** : Suggérer de spawner à nouveau le fixer avec les recommandations en input.
- **FAIL** : Re-ouvrir le batch en `pending` ou ouvrir nouveaux findings pour les régressions. Suggérer plan de remédiation.

## Note multi-modèle

Pour un re-audit encore plus rigoureux, l'utilisateur peut en parallèle :
- Lancer une session Codex et lui faire le même check
- Comparer les deux verdicts (méthode "deux modèles distincts" pour vrai cross-validation)

Mais déjà cette commande seule = couverture acceptable post-fix.
