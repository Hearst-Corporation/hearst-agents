---
description: Cartographie le codebase — routes, stores, dépendances inter-modules, surface API
---

# /map — Cartographie codebase

Produit une carte statique navigable du système. Utile avant un refactor, un audit d'impact, ou pour onboarder un nouveau contexte.

## Arguments optionnels

`$ARGUMENTS` — vue ciblée : `routes` | `stores` | `modules` | `api` | vide = carte complète.

## Vue 1 — Routes Next.js

!node scripts/list-api-routes.mjs 2>/dev/null
!find app/ -name "page.tsx" | sort | sed 's|app/||;s|/page.tsx||' | head -60

Produis un arbre des routes UI et API avec :
- Méthode HTTP (GET/POST/PUT/DELETE/PATCH)
- Auth requise ou non (détecte `getServerSession`, `requireAuth`, middleware)
- Type de réponse (JSON, stream, redirect)

## Vue 2 — Stores Zustand

!node scripts/list-stores.mjs 2>/dev/null
!grep -rn "create(" app/ lib/ --include="*.ts" --include="*.tsx" | grep -i "store\|zustand" | head -30
!grep -rn "useStore\|use[A-Z][a-zA-Z]*Store" app/ --include="*.tsx" | head -40

Pour chaque store : nom, slices d'état, actions exposées, composants consommateurs.

## Vue 3 — Dépendances inter-modules

!find app/ lib/ -name "index.ts" | sort | head -30
!grep -rn "from '@/" app/ lib/ --include="*.ts" --include="*.tsx" | sed "s/.*from '@\/\([^'\"]*\)'.*/\1/" | sort | uniq -c | sort -rn | head -40

Identifie :
- Modules les plus importés (hubs critiques)
- Imports circulaires potentiels
- Couplage fort entre features qui devraient être isolées

## Vue 4 — Surface API publique

!grep -rn "export " app/api/ lib/api/ 2>/dev/null --include="*.ts" | grep -v "//\|test\|spec" | head -50
!grep -rn "fetch\|axios\|ky" app/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|test" | head -30

## Rapport final

Format markdown navigable avec sections par vue. Chaque item linkable par chemin.

```
## Routes API (N)
### GET /api/[route]
- Auth : oui/non
- Retourne : { ... }
- Consommé par : composant A, composant B

## Stores (N)
### useXxxStore
- État : champ1 (type), champ2 (type)
- Actions : action1(), action2()
- Consommé par : [liste composants]
```

Termine par une section **Points chauds** : les 5 fichiers/modules les plus couplés, avec risque d'impact si modifiés.

## Rapport HTML — ouverture automatique Chrome

Une fois le rapport textuel produit, génère un fichier HTML complet à `/tmp/rapport-map.html` et ouvre-le dans Chrome.

Le HTML doit :
- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "Cartographie codebase", date/heure, vue(s) générée(s)
- 4 sections navigables via ancres : Routes, Stores, Modules, API
- **Routes** : arbre visuel avec icône cadenas si auth requise, badge méthode HTTP coloré (GET=vert, POST=bleu, DELETE=rouge), type de réponse
- **Stores** : cartes par store avec liste état/actions, badge "N composants consommateurs"
- **Modules** : graphe de dépendances simplifié en ASCII art ou tableau couplage fort/faible
- **Points chauds** : top 5 fichiers avec barre de "risque d'impact" visuelle
- Chaque chemin de fichier cliquable `vscode://file/...`
- Footer : date, scope analysé

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-map.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-map.html
