---
description: État du Battle Plan sécurité (progression par phase, batchs done/pending/blocked).
---

# /battle-status — État Battle Plan

!node scripts/battle-status.mjs

## Synthèse à produire

Sur la base de l'output ci-dessus :

```
Battle Plan · phase courante : <nom>
Done : N · Pending : N · Blocked : N · Deferred : N
Prochain batch recommandé : <id> — <titre court> (cf /battle-next)
Critical path estimé : ~X jours restants
```

## Aller plus loin

- Détails HTML : `open docs/audits/2026-05-10-security/BATTLE-PLAN.html`
- Batch recommandé : `/battle-next`
- Exécuter un batch : `/battle-exec <batch-id>`
