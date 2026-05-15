---
description: Audit transversal — sécurité, perf, architecture, dépendances. Sortie P0/P1/P2 + rapport HTML.
argument-hint: [security|perf|arch|deps] (vide = tous)
---

# /audit — Audit transversal

Audit multi-axe en read-only. Aucun fichier code n'est modifié. Sortie : rapport HTML via `scripts/render-report.mjs`.

## Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → écrire le rapport reste autorisé (audit only), pas de fix.

## Scope

`$ARGUMENTS` — axe ciblé : `security` | `perf` | `arch` | `deps` | vide = tous.

## Stratégie : 4 sous-agents en parallèle

Spawn 4 Agents dans **un seul message** (subagent_type: `Explore`) :

### Agent 1 — Sécurité (OWASP)

Vérifier :

- `process.env.*` exposé côté client sans `NEXT_PUBLIC_`
- `dangerouslySetInnerHTML` sans sanitisation
- `eval(` dans `app/` ou `lib/`
- Routes API `app/api/**` sans auth (`getServerSession`, `requireAuth`)
- Secrets en dur : `(password|secret|api_key|token)\s*=\s*["'][^"']{8,}`
- Inputs route handler sans validation zod

Commandes utiles :

- `grep -rn "process.env\." app/ --include="*.tsx" --include="*.ts" | grep -v NEXT_PUBLIC`
- `grep -rn "dangerouslySetInnerHTML" app/ --include="*.tsx"`
- `grep -rEn "eval\(" app/ lib/ --include="*.ts" --include="*.tsx"`

Livrable : `{ findings: [{ severity, path, line, rule, title, current, suggested, why }] }`.

### Agent 2 — Performance

Vérifier :

- Composants > 300 lignes (candidat découpe)
- `useEffect` sans tableau de deps explicite
- `<img>` sans `next/image`
- `JSON.parse`/`JSON.stringify` dans render
- Barrel imports tirant un module entier

Commandes utiles :

- `find app/ -name "*.tsx" -exec wc -l {} + | sort -rn | head -20`
- `grep -rn "<img " app/ --include="*.tsx" | grep -v "next/image"`

### Agent 3 — Architecture (ADD)

Vérifier :

- Modifs dans zones verrouillées sans spec correspondante (cf `docs/AGENT-DRIVEN-DEV.md`)
- Imports cross-feature qui violent isolation
- Stores Zustand avec état dupliqué
- Routes API sans typage entrée/sortie

Commandes utiles :

- `node scripts/list-stores.mjs 2>/dev/null`
- `node scripts/list-api-routes.mjs 2>/dev/null`
- Lire `docs/AGENT-DRIVEN-DEV.md`

### Agent 4 — Dépendances

Vérifier :

- `npm audit` vulnérabilités haute/critique
- `npx depcheck` deps inutilisées / manquantes
- Lockfile désynchro

Commandes utiles :

- `npm audit --json 2>/dev/null`
- `npx depcheck --json 2>/dev/null`

## Agrégation

Merger les 4 livrables JSON dans la structure attendue par `render-report.mjs` :

```json
{
  "title": "Audit transversal",
  "scope": "<axe ou 'complet'>",
  "kpis": { "p0": N, "p1": N, "p2": N },
  "sections": [
    { "name": "Sécurité", "agent": "OWASP", "findings": [...] },
    { "name": "Performance", "agent": "perf", "findings": [...] },
    { "name": "Architecture", "agent": "ADD", "findings": [...] },
    { "name": "Dépendances", "agent": "deps", "findings": [...] }
  ],
  "quickWins": [ { "title", "path?", "effort?" } ],
  "plan": [
    { "name": "P0 critiques", "items": ["..."] },
    { "name": "P1 cohérence", "items": ["..."] },
    { "name": "P2 dettes", "items": ["..."] }
  ]
}
```

Écrire dans `/tmp/audit-data.json`, puis :

!node scripts/render-report.mjs --type=audit --data=/tmp/audit-data.json --open

## Réponse finale (5 lignes max)

```
Audit <scope> · P0:N P1:N P2:N
Quick wins : <top 3 titres>
Rapport : docs/audit/audit-YYYY-MM-DD.html
```
