---
description: Recommande le prochain batch à exécuter (deps satisfaites, ordre logique)
---

# Battle Plan — Next batch

!node scripts/battle-next.mjs

Lis l'output ci-dessus.

Présente :
1. **Batch recommandé** : ID, titre, phase, sub-agent recommandé, effort estimé
2. **Findings inclus** : liste compacte (F-XXX titre, severity)
3. **Pre-conditions** : déjà satisfaites ou pas
4. **Validation criteria** : ce qui devra être vérifié à la fin
5. **Next action** : tape `/battle-exec <batch_id>` pour démarrer

Si plusieurs batchs candidats (deps satisfaites mais pas ordre strict), propose le plus prioritaire selon :
- Phase la plus basse en priorité (P0 → P1 → P2 → ...)
- Au sein de la phase, ordre du JSON (séquence logique)
- Avertir si batch a un `blast_if_skipped` (montrer en rouge mental)

NE LANCE PAS l'exécution — l'utilisateur doit valider avec `/battle-exec`.
