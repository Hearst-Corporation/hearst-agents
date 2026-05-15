---
description: Analyse couverture + génère specs prioritaires (Vitest + Playwright). Rapport HTML.
argument-hint: [chemin|module] (vide = analyse complète)
---

# /test — Couverture & gaps de tests

Analyse read-only de l'état des tests + génération de specs prioritaires.

## Scope

`$ARGUMENTS` — chemin ciblé (ex: `app/api/`, `components/missions/`, `e2e/`). Vide = analyse complète.

## Stratégie : 3 sous-agents en parallèle

Spawn 3 Agents dans **un seul message** (subagent_type: `Explore`).

### Agent 1 — Inventaire tests existants

Commandes :
- `find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) -not -path "*/node_modules/*" | sort`
- `find e2e/ -name "*.spec.ts" 2>/dev/null | sort`
- `npx vitest run --reporter=verbose 2>/dev/null | tail -30`

Compter : N unit, M e2e, taux succès.

### Agent 2 — Couverture par fichier

Commande :
- `npx vitest run --coverage --reporter=json 2>/dev/null`

Parser `coverage/coverage-summary.json`. Lister tous fichiers < 80% couverture ligne avec %.

### Agent 3 — Zones critiques sans test

Identifier fichiers critiques (routes API, stores, lib core) sans `.test.*` adjacent.

Commandes :
- `find app/api -name "route.ts" | while read f; do base=$(dirname "$f"); if ! find . -path "*${base}*" -name "*.test.ts" 2>/dev/null | grep -q .; then echo "$f"; fi; done`
- `find lib/ -name "*.ts" -not -name "*.test.*" -not -name "*.d.ts" | while read f; do name=$(basename "$f" .ts); if ! grep -rq "$name" . --include="*.test.ts" --include="*.spec.ts" 2>/dev/null; then echo "$f"; fi; done`

Pour chaque fichier critique sans test, lister les cas manquants :
- Happy path
- Edge cases (limites, types inattendus, payloads vides)
- Erreurs 400/401/403/404/500 sur routes API
- Concurrence (double submit, races)
- Auth (sans session, expirée, perms insuffisantes)

## Génération de specs (top 5 gaps les plus critiques)

Pour chacun, produire la spec Vitest ou Playwright complète prête à coller. Format dans le rapport HTML : bloc `<pre>` avec TypeScript.

Priorité : routes API sans test > stores critiques > composants logique métier > UI pure.

## Agrégation → render-report

```json
{
  "title": "Couverture & gaps de tests",
  "scope": "<arg ou 'complet'>",
  "kpis": { "p0": N_zones_critiques_sans_test, "p1": N_low_coverage, "p2": N_e2e_manquants, "score": coverage_global_pct },
  "sections": [
    { "name": "Inventaire", "summary": "N unit · M e2e · X% pass", "findings": [...] },
    { "name": "Fichiers < 80% couverture", "findings": [...] },
    { "name": "Zones critiques sans test", "findings": [...] },
    { "name": "Specs générées (top 5)", "findings": [{ "title": "<fichier cible>", "suggested": "<spec complète>" }] }
  ],
  "plan": [
    { "name": "Batch 1 — Routes API sans test", "items": ["..."] },
    { "name": "Batch 2 — Stores critiques", "items": ["..."] },
    { "name": "Batch 3 — Composants logique", "items": ["..."] }
  ]
}
```

!node scripts/render-report.mjs --type=tests --data=/tmp/tests-data.json --open

## Réponse finale (5 lignes max)

```
Tests <scope> · Couverture X% · N unit · M e2e
Zones critiques sans test : K
Specs générées : 5 prêtes à coller
Rapport : docs/audit/tests-YYYY-MM-DD.html
```
