---
description: Cartographie codebase — routes, stores, dépendances, surface API. Rapport HTML navigable.
argument-hint: [routes|stores|modules|api] (vide = complet)
---

# /map — Cartographie codebase

Read-only. Sortie : rapport HTML avec sections par vue.

## Scope

`$ARGUMENTS` — vue ciblée : `routes` | `stores` | `modules` | `api` | vide = carte complète.

## Stratégie : 4 sous-agents en parallèle

Spawn 4 Agents (subagent_type: `Explore`) dans **un seul message**.

### Agent 1 — Routes Next.js (UI + API)

Commandes :
- `node scripts/list-api-routes.mjs 2>/dev/null`
- `find app/ -name "page.tsx" | sort | sed 's|app/||;s|/page.tsx||'`
- `find app/api -name "route.ts" | sort`

Pour chaque route, identifier :
- Méthode HTTP (GET/POST/PUT/DELETE/PATCH)
- Auth requise (`getServerSession`, `requireAuth`, middleware)
- Type de réponse (JSON, stream, redirect)

### Agent 2 — Stores Zustand

Commandes :
- `node scripts/list-stores.mjs 2>/dev/null`
- `grep -rn "create(" app/ lib/ --include="*.ts" --include="*.tsx" | grep -iE "(store|zustand)"`
- `grep -rEn "use[A-Z][a-zA-Z]+Store" app/ components/ --include="*.tsx"`

Pour chaque store : nom, slices d'état, actions exposées, composants consommateurs.

### Agent 3 — Dépendances inter-modules

Commandes :
- `grep -rh "from '@/" app/ lib/ components/ --include="*.ts" --include="*.tsx" | sed -E "s|.*from '@/([^']+)'.*|\\1|" | sort | uniq -c | sort -rn | head -40`

Identifier :
- Top 10 modules les plus importés (hubs critiques)
- Imports circulaires potentiels (croiser via madge si dispo : `npx madge --circular --extensions ts,tsx app/`)
- Couplage fort entre features qui devraient être isolées

### Agent 4 — Surface API publique

Commandes :
- `grep -rEn "export (async )?function|export const" app/api/ lib/api/ --include="*.ts" 2>/dev/null`
- `grep -rEn "(fetch|axios|ky)\(" app/ components/ --include="*.tsx" --include="*.ts"`

Lister tous les endpoints + consommateurs.

## Agrégation → render-report

```json
{
  "title": "Cartographie codebase",
  "scope": "<arg ou 'complet'>",
  "sections": [
    { "name": "Routes (UI + API)", "findings": [...] },
    { "name": "Stores Zustand", "findings": [...] },
    { "name": "Dépendances inter-modules", "findings": [...] },
    { "name": "Surface API", "findings": [...] }
  ],
  "quickWins": [
    { "title": "Top 5 fichiers les plus couplés (risque impact)", "..." }
  ]
}
```

Chaque finding sert ici à lister un item (route, store, module) avec son path. La sévérité est libre — utiliser `P2` par défaut, `P1` pour les points chauds, `P0` pour les circulaires détectées.

!node scripts/render-report.mjs --type=map --data=/tmp/map-data.json --open

## Réponse finale (5 lignes max)

```
Cartographie <scope> · N routes, M stores, K modules
Points chauds : <top 3>
Rapport : docs/audit/map-YYYY-MM-DD.html
```
