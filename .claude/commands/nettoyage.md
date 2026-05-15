---
description: Nettoie le codebase — dead code, exports orphelins, magic numbers, dettes lint. Rapport HTML.
argument-hint: [chemin|glob] (vide = repo entier)
---

# /nettoyage — Nettoyage codebase

Analyse statique read-only. Aucune suppression automatique. Sortie : rapport HTML + plan de nettoyage en batches.

## Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → rapport autorisé, plan de batches affiché mais non exécuté.

## Scope

`$ARGUMENTS` — chemin ou glob (ex: `app/` ou `components/missions/`). Vide = repo entier.

## Stratégie : 5 sous-agents en parallèle

Spawn 5 Agents dans **un seul message** (subagent_type: `Explore`).

### Agent 1 — Exports orphelins

Commande : `npx knip --reporter json 2>/dev/null`

Identifie : exports non consommés, fichiers jamais importés, re-exports circulaires. Exclure `spatial-safe/`.

### Agent 2 — Dead code TypeScript

Commande : `npx ts-prune --error 2>/dev/null`

Lister symboles (fonctions, types, constantes) jamais référencés. Croiser avec Agent 1.

### Agent 3 — Magic numbers & inline styles

Commandes :
- `grep -rn "style={{" app/ components/ --include="*.tsx" | grep -v "var(--"`
- `grep -rEn "#[0-9a-fA-F]{3,8}" app/ components/ --include="*.tsx" | grep -v globals.css`
- `grep -rEn "(px|py|p|m|gap|w|h)-\[" app/ components/ --include="*.tsx"`

Lister valeurs hardcodées qui devraient passer par token `globals.css`.

### Agent 4 — Dettes lint

Commande : `npx eslint . --format json 2>/dev/null`

Parser et lister par fichier:ligne avec sévérité.

### Agent 5 — TODO/FIXME/HACK obsolètes

Commande : `grep -rEn "(TODO|FIXME|HACK|XXX)" app/ lib/ components/ --include="*.ts" --include="*.tsx"`

Vérifier âge git blame, marquer obsolète si > 90 jours sans contexte.

## Règles de sécurité (jamais auto-supprimer)

- Symboles marqués `@public`
- Exports depuis `index.ts` racine
- Fichiers dans `app/api/`
- Tout fichier dans `spatial-safe/` ou `spatial/`

Ces items nécessitent confirmation utilisateur explicite.

## Agrégation → render-report

JSON :

```json
{
  "title": "Nettoyage codebase",
  "scope": "<arg ou 'repo entier'>",
  "kpis": { "p0": N, "p1": N, "p2": N },
  "sections": [
    { "name": "Exports orphelins", "findings": [...] },
    { "name": "Dead code TS", "findings": [...] },
    { "name": "Magic numbers", "findings": [...] },
    { "name": "Dettes lint", "findings": [...] },
    { "name": "TODO/FIXME obsolètes", "findings": [...] }
  ],
  "plan": [
    { "name": "Batch 1 — Exports orphelins safe", "items": ["..."] },
    { "name": "Batch 2 — Magic numbers → tokens", "items": ["..."] },
    { "name": "Batch 3 — Dead code TS", "items": ["..."] }
  ]
}
```

!node scripts/render-report.mjs --type=nettoyage --data=/tmp/nettoyage-data.json --open

## Réponse finale (5 lignes max)

```
Nettoyage <scope> · P0:N P1:N P2:N
Plan : 3 batches proposés
Rapport : docs/audit/nettoyage-YYYY-MM-DD.html
```
