---
description: Audit QA UI/UX ultra-détaillé — alignements, spacing, cohérence, états, responsive. 3 agents parallèles.
argument-hint: [chemin|module] (vide = app complète)
---

# /qa — Audit QA UI/UX

Audit manuel ultra-détaillé. Read-only sauf demande explicite de fix. Sortie : rapport HTML avec score /10.

## Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → audit autorisé, fixes non.

## Scope

`$ARGUMENTS` — module ciblé (ex: `app/(admin)`, `components/missions/`). Vide = app complète.

## Exclusions strictes

- `app/spatial-safe/**`, `components/spatial-safe/**`, `hooks/spatial-safe/**`, `lib/spatial-safe/**`, `styles/spatial-safe/**`, `providers/spatial-safe/**`
- `docs/spatial/_BACKUP_SPATIAL_WORKING_*/**`
- `app/spatial/**` (hors DS intentionnel)

## Stratégie : 3 sous-agents en parallèle

Spawn 3 Agents dans **un seul message** (subagent_type: `Explore`).

### Agent 1 — Layout & Alignment QA

Détecter alignements, spacing, tailles, grilles.

- Magic numbers spacing hors tokens (`px-[N]`, `py-[N]`, valeurs `style={{ padding: ... }}` brutes)
- Flex/grid incohérents
- Hauteurs/largeurs hardcodées
- Containers sans tokens `--space-*`

Commandes :
- `grep -rEn "(px|py|p|m|gap|w|h)-\[[0-9]+px\]" app/ components/ --include="*.tsx"`
- `grep -rn "style={{" app/ components/ --include="*.tsx" | grep -v "var(--"`

### Agent 2 — Interaction & States QA

Tester hover, focus, loading, modales, dropdowns, scrolls.

- États manquants (loading sans skeleton, error sans message, empty sans fallback)
- `hover:` / `focus-visible:` sur tous éléments interactifs
- Modales sans focus trap / sans Escape
- Scrolls imbriqués problématiques
- Transitions cohérentes (`transition-*`, `duration-*` via tokens)

Commandes :
- `grep -rn "loading\|isLoading\|isPending" app/ components/ --include="*.tsx"`
- `grep -rn "overflow" app/ components/ --include="*.tsx" --include="*.css"`
- `grep -rEn "position:\s*(absolute|fixed)" app/ components/ --include="*.tsx"`

### Agent 3 — Visual Consistency QA

Vérifier typographie, couleurs, cartes, boutons, shadows, radius.

- Comparer admin vs app principale
- Vérifier boutons tous issus de la même primitive
- Cohérence `--radius-*` sur cartes
- Shadows via `--shadow-card` / `--shadow-card-hover`
- Couleurs hardcodées hors palette `globals.css`

Commandes :
- `grep -rEn "#[0-9a-fA-F]{3,8}" app/ components/ --include="*.tsx"`
- `grep -rEn "rounded-\[" app/ components/ --include="*.tsx"`

## Format livrable agent

```json
{
  "findings": [
    {
      "severity": "P0|P1|P2",
      "path": "...",
      "line": N,
      "rule": "magic-spacing|missing-state|hardcoded-color|...",
      "title": "Description courte",
      "current": "<code>",
      "suggested": "<token DS>",
      "why": "Impact UX + raison"
    }
  ]
}
```

Sévérités :
- **P0** (critique) — chevauchement, illisible, crash visuel
- **P1** (moyen) — incohérence notable, impression non premium
- **P2** (mineur) — pixel off, détail imperceptible à froid

## Agrégation + score

Calculer score /10 :
- Base 10
- −2 par P0, −0.5 par P1, −0.1 par P2 (plancher à 0)

```json
{
  "title": "QA UI/UX",
  "scope": "<arg ou 'app complète'>",
  "kpis": { "p0": N, "p1": N, "p2": N, "score": X },
  "sections": [
    { "name": "Layout & Alignment", "agent": "agent-1", "findings": [...] },
    { "name": "Interaction & States", "agent": "agent-2", "findings": [...] },
    { "name": "Visual Consistency", "agent": "agent-3", "findings": [...] }
  ],
  "quickWins": [...],
  "plan": [
    { "name": "P0 — fixes critiques", "items": ["..."] },
    { "name": "P1 — cohérence DS", "items": ["..."] },
    { "name": "P2 — polish", "items": ["..."] }
  ]
}
```

!node scripts/render-report.mjs --type=qa --data=/tmp/qa-data.json --open

## Réponse finale (5 lignes max)

```
QA <scope> · Score N/10 · P0:N P1:N P2:N
Quick wins : <top 3>
Rapport : docs/audit/qa-YYYY-MM-DD.html
```
