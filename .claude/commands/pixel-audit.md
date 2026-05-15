---
description: Audit pixel perfect + hardcode + stabilisation transversale. 10 sous-agents parallèles, rapport HTML.
---

# /pixel-audit — Audit pixel perfect (10 agents)

Audit DS exhaustif sur tout le projet. Read-only. Sortie : rapport HTML via `scripts/render-report.mjs`.

## Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → rapport autorisé (lecture seule), pas de fix.

## Périmètre

- **Inclus** : `app/(user)/**`, `app/(public)/**`, `components/**`, `app/globals.css`
- **Exclus stricts** :
  - `app/spatial-safe/**`, `components/spatial-safe/**`, `hooks/spatial-safe/**`,
    `lib/spatial-safe/**`, `styles/spatial-safe/**`, `providers/spatial-safe/**`
  - `docs/spatial/_BACKUP_SPATIAL_WORKING_*/**`
  - `app/spatial/**` (hors DS intentionnel)
- Référence canonique : [HEARST-OS-DESIGN-SYSTEM.html](HEARST-OS-DESIGN-SYSTEM.html),
  [app/globals.css](app/globals.css), [CLAUDE.md](CLAUDE.md) section "Voix éditoriale"

## Sévérités

- **P0** — casse visuelle, token absent, magic number sur path critique (cockpit, chat, dashboard)
- **P1** — incohérence DS, voix éditoriale, états manquants
- **P2** — dette mineure, propagation à faire, micro-écart

## Stratégie : 10 sous-agents en parallèle

Spawn 10 Agents dans **un seul message** (subagent_type: `Explore`).

Chaque agent reçoit : son scope + livrable JSON `{ findings: [...] }` + exclusions + consigne **NE FIX RIEN**.

### Agent 1 — Tokens & magic numbers

Grep tous `px-[`, `py-[`, `w-[`, `h-[`, `gap-[`, `m-[`, valeurs inline `px`/`rem` hors `var(--*)`. Reporter chaque occurrence non couverte par un token globals.css.

### Agent 2 — Typographie

Vérifier usage `.t-9` / `.t-13` / `.t-15` / `.t-28`. Détecter `text-[Npx]`, `font-size: Npx`, `text-xs/sm/base/lg/xl` non mappés sur tokens. Vérifier cohérence `font-weight`.

### Agent 3 — Spacing

Auditer paddings/margins/gaps. Confirmer que chaque utility Tailwind résout vers `--space-N`. Détecter inline styles spacing en `px`/`rem` brut.

### Agent 4 — Couleurs & palette

Grep `#[0-9a-fA-F]{3,8}`, `rgb(`, `rgba(`, `hsl(` hors globals.css. Lister chaque couleur en dur. Vérifier `--cykan` / `--accent-teal` / `--text-muted` / `--surface-*`.

### Agent 5 — Radius & shadows

Grep `border-radius:`, `rounded-[`, `box-shadow:`, `shadow-[` hors tokens `--radius-*` et `--shadow-*`.

### Agent 6 — Motion & easing

Grep `transition-duration`, `duration-[`, `ease-[`, `cubic-bezier(`, animations CSS custom. Vérifier mapping sur `--duration-*` et `--ease-*`.

### Agent 7 — Voix éditoriale & microcopy

Détecter `tracking-marquee`, `tracking-display`, `tracking-section`, `tracking-label` en JSX (pas commentaires). Détecter `uppercase` + mono caps hors DS. Détecter `halo-on-hover` sur chrome (boutons/inputs/liens). Détecter statuts EN ("OK"/"FAIL"/"RUN") qui devraient être FR.

### Agent 8 — Primitives DS

Pour chaque pattern dupliqué 3+ fois (rows, empty states, skeletons, section headers, actions), vérifier qu'il passe par `<Action>`, `<SectionHeader>`, `<RailSection>`, `<EmptyState>`, `<RowSkeleton>`, `<CardSkeleton>`. Lister call-sites qui réimplémentent localement.

### Agent 9 — États & a11y

Pour chaque écran cockpit (Cockpit, Stage variants, Dashboard, Chat, ContextRail), vérifier présence : empty / loading / error / hover / focus / active / disabled. Lister états manquants. Audit jsx-a11y (labels, alt, aria) ciblé.

### Agent 10 — Stabilité & cross-refs

Détecter imports cassés, exports orphelins, composants dupliqués (même nom dans 2 paths), fichiers `.tsx`/`.ts` non importés, deps circulaires. Vérifier que `database.types.ts` est à jour. Lister dettes lint préexistantes qui bloquent CI.

## Agrégation

Une fois les 10 livrables JSON reçus :

1. Merger tous les findings
2. Dédupliquer sur `path:line:rule`
3. Trier par sévérité puis par path
4. Compter par sévérité, par agent, par module (app vs components vs api)
5. Identifier **top 10 quick wins** (P0/P1 avec patch < 5 lignes)

## Render report

```json
{
  "title": "Pixel audit + hardcode + stabilisation",
  "scope": "transversal",
  "kpis": { "p0": N, "p1": N, "p2": N },
  "sections": [
    { "name": "Tokens & magic numbers", "agent": "agent-1", "findings": [...] },
    { "name": "Typographie", "agent": "agent-2", "findings": [...] },
    { "name": "Spacing", "agent": "agent-3", "findings": [...] },
    { "name": "Couleurs", "agent": "agent-4", "findings": [...] },
    { "name": "Radius & shadows", "agent": "agent-5", "findings": [...] },
    { "name": "Motion & easing", "agent": "agent-6", "findings": [...] },
    { "name": "Voix éditoriale", "agent": "agent-7", "findings": [...] },
    { "name": "Primitives DS", "agent": "agent-8", "findings": [...] },
    { "name": "États & a11y", "agent": "agent-9", "findings": [...] },
    { "name": "Stabilité & cross-refs", "agent": "agent-10", "findings": [...] }
  ],
  "quickWins": [...],
  "plan": [
    { "name": "Batch 1 — P0 critiques", "items": ["..."] },
    { "name": "Batch 2 — P1 cohérence DS", "items": ["..."] },
    { "name": "Batch 3 — P2 dettes & propagation", "items": ["..."] }
  ]
}
```

!node scripts/render-report.mjs --type=pixel-audit --data=/tmp/pixel-audit-data.json --open

## Réponse finale (5 lignes max)

```
Pixel audit · P0:N P1:N P2:N · 10 agents OK
Quick wins : <top 3>
Rapport : docs/audit/pixel-audit-YYYY-MM-DD.html
```
