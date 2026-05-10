---
description: Affiche l'état du Battle Plan sécurité (progression par phase, batchs done/pending/blocked)
---

# Battle Plan — Status

!node scripts/battle-status.mjs

Lis l'output ci-dessus et présente un résumé clair :
- Total batchs done / pending / blocked / deferred
- Phase courante (la première phase non complète)
- Prochain batch recommandé (cf `/battle-next`)
- 1-2 phrases sur le critical path (combien de jours estimé restants)

Si l'utilisateur veut plus de détail, dis-lui :
- Voir HTML : `open docs/audits/2026-05-10-security/BATTLE-PLAN.html`
- Lancer `/battle-next` pour voir quel batch attaquer maintenant
