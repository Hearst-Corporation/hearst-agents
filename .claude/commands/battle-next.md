---
description: Recommande le prochain batch à exécuter (deps satisfaites, ordre logique).
---

# /battle-next — Prochain batch

!node scripts/battle-next.mjs

## Synthèse à produire

Sur la base de l'output ci-dessus :

```
Batch recommandé : <id> — <titre>
  Phase : <nom>
  Sub-agent : <auth-fixer | ssrf-fixer | ...>
  Effort estimé : <XS|S|M|L>
  Findings inclus : <F-XXX, F-YYY> (N total)
  Pre-conditions : satisfaites | bloquées par <liste>
  Validation criteria : <résumé>
  blast_if_skipped : <oui/non — si oui, signaler en alerte>

Action : /battle-exec <id>
```

Si plusieurs batchs candidats (deps satisfaites mais ordre non strict), prioriser :

1. Phase la plus basse (P0 → P1 → P2)
2. Au sein de la phase, ordre du JSON (séquence logique du Battle Plan)
3. Signaler en premier ceux avec `blast_if_skipped: true`

**Ne lance pas l'exécution** — l'utilisateur valide avec `/battle-exec`.
