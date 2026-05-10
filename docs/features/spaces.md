# Espaces — `spaces`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `spaces` |
| **statut** | `in_progress` (preview — Phase 1 livrée, Phases 2 & 3 à venir) |
| **owner** | Adrien |
| **dernière revue** | 2026-05-10 |
| **version spec** | 1.0 |

## Description

Les **Espaces** (ou *Spaces*) cloisonnent l'OS en silos logiques multi-projets à
l'intérieur d'un même workspace. L'utilisateur bascule entre `Perso`, `Side`,
`Venture` (defaults hardcodés) via un mini-selector dans la PulseBar — chaque
space portera à terme ses propres assets, missions, runs, reports, briefs,
watchlist. Aujourd'hui c'est une **foundation seulement** : le selector écrit
dans le store mais aucune query n'est encore filtrée.

## Surface publique

### Pages
- N/A — la feature vit dans le chrome (PulseBar) et est globale à l'app cockpit.

### Composants exportés
- [SpaceSelector.tsx](../../app/(user)/components/SpaceSelector.tsx) — 3 dots
  colorés (radio group) montés dans la zone gauche de la PulseBar. Pas de
  props : lit/écrit directement `useActiveSpace`.

### Endpoints API
- N/A en Phase 1. Phase 2 ajoutera les colonnes côté Supabase, Phase 3 les
  filtres dans les routes existantes.

## Architecture interne

### Stores Zustand
- [`useActiveSpace`](../../stores/active-space.ts) — selectors :
  - `activeSpaceId: string` — id du space en cours.
  - `spaces: SpaceConfig[]` — liste des spaces (3 defaults seedés).
  - `setActiveSpace(id)` — switch silencieux (refuse les ids inconnus).
  - `addSpace(space)` / `removeSpace(id)` — gestion future (refuse de supprimer
    le dernier space, idempotent sur add).
  - Persistance : clé `hearst-active-space`, version 1.

### Librairies internes
- [lib/multi-tenant/types.ts](../../lib/multi-tenant/types.ts) — expose le type
  `SpaceId = string` et le champ optionnel `spaceId?` sur `TenantScope` /
  `ScopedMetadata` (foundation seulement, non lu côté query).

### Dépendances externes (npm / services)
- `zustand` (déjà présent) — store + middleware `persist`.

## Data flow

```
[user clique un dot dans la PulseBar]
  ↓
[SpaceSelector.onClick → useActiveSpace.setActiveSpace(id)]
  ↓
[zustand persist → localStorage `hearst-active-space`]
  ↓
[Phase 1 stop ici — aucune query downstream ne consomme encore activeSpaceId]
  ↓
[Phase 3 future : queries asset/mission/run/report/brief filtrent par spaceId]
```

## Roadmap de migration

La feature est livrée en **3 phases** pour éviter une bascule big-bang risquée.

### Phase 1 — Foundation (LIVRÉE)

- Type `SpaceId` + champ optionnel `spaceId?` sur `TenantScope` / `ScopedMetadata`.
- Store `useActiveSpace` (3 spaces hardcodés : `personal` / `side-project` / `venture`).
- Composant `SpaceSelector` monté dans la PulseBar.
- Persistance localStorage.
- **Aucune query existante n'est modifiée.** Le selector est cosmétique.

### Phase 2 — Schéma DB (À VENIR)

- Ajouter une colonne `space_id text NOT NULL DEFAULT 'personal'` sur :
  - `assets`
  - `missions`
  - `runs`
  - `reports`
  - `briefs`
  - `watchlist_items`
  - (à confirmer) `personas`, `meetings`, `datasets`, `notebooks`
- Créer une table `spaces` (id, label, color, workspace_id, created_at) si on
  veut sortir des defaults hardcodés et permettre custom spaces par utilisateur.
- Migration Supabase + backfill des rows existantes vers `space_id = 'personal'`.
- Mettre à jour les types générés (`lib/db/types.ts` ou équivalent).
- **Toujours pas de filtre côté query** — on prépare juste la donnée.

### Phase 3 — Filtrage des queries (À VENIR)

Brancher `useActiveSpace().activeSpaceId` (côté client) ou le passer dans le
contexte `TenantScope` (côté serveur) puis filtrer toutes les routes/loaders
qui retournent des données scopées.

Estimation des fichiers à toucher (non exhaustif) :

| Domaine | Fichiers approximatifs | Notes |
|---------|-------------------------|-------|
| Assets | `app/api/v2/assets/**`, `lib/assets/**`, `stores/asset-*` | filtrer list + create |
| Missions | `app/api/v2/missions/**`, `lib/missions/**`, `stores/missions*` | inclut runs liés |
| Runs | `app/api/v2/runs/**`, `lib/runs/**` | dérivé de mission, propage automatiquement |
| Reports | `app/api/v2/reports/**`, `lib/reports/**` | filtrer list |
| Briefs | `app/api/v2/briefs/**`, `lib/briefs/**` | daily-brief par space |
| Watchlist | `app/api/v2/watchlist/**` | filtrer list + alertes |
| Personas | `app/api/v2/personas/**` | TBD : space-scoped ou workspace-scoped ? |
| Cockpit signals | `app/api/v2/cockpit/signals/**` | filtrer par activeSpaceId |
| TimelineRail | `stores/timeline-*`, components rail | filtrer entries par space |
| Stage data | `stores/stage-data.ts` | bind par space |

Ordre suggéré : assets → missions → runs → reports → briefs → watchlist →
cockpit signals → timeline → personas. Chaque step = une PR séparée avec tests
e2e dédié (`Playwright e2e/spaces-*.spec.ts`).

## Invariants verrouillés

Tant que la feature reste en preview (Phase 3 non livrée) :

1. **Le selector reste cosmétique côté queries.** Aucun filtre `WHERE space_id = ?`
   ne doit être ajouté tant que la Phase 2 (migration DB) n'a pas posé la colonne
   et le default `personal` partout.
2. **Defaults hardcodés.** `DEFAULT_SPACES` (3 entrées) reste la source — pas
   d'API custom-spaces tant que Phase 2 n'est pas finie.
3. **Style "silent luxury".** Le selector ne crie pas : 3 dots de 6px, gap 4px,
   tooltip simple, pas de label texte ni de badge "preview" bruyant.
4. **Persistance par utilisateur (localStorage), pas par device-account.**
   Phase 2 pourra synchroniser côté Supabase si besoin.

## Évolutions autorisées sans spec

1. Ajouter / retirer des spaces dans `DEFAULT_SPACES` (couleur, label).
2. Modifier le style visuel du selector (taille, gap, animation) tant que la
   voix "silent luxury" est respectée.
3. Renommer les ids des spaces (mais alors prévoir une migration localStorage).
4. Brancher de nouveaux call-sites sur `useActiveSpace()` qui *lisent* l'id en
   readonly (logging, télémétrie) sans encore filtrer les queries.

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| User switche un space en attendant Phase 3 → croit que les queries filtrent déjà | Confusion UX | Tooltip simple, pas de promesse de filtrage. Doc preview claire. |
| `activeSpaceId` pointe vers un id absent (après edit manuel localStorage) | Selector vide | Garde-fou dans `setActiveSpace` (refuse ids inconnus) |
| Suppression du dernier space | Plus de space actif | `removeSpace` refuse si length ≤ 1 |
| Migration Phase 2 oublie de backfill `space_id` | Rows orphelines en DB | À couvrir dans la migration : `DEFAULT 'personal'` non-null |

## Tests

### Existants
- N/A en Phase 1.

### Manquants (gap)
- Vitest sur `useActiveSpace` (set/add/remove edge cases).
- Playwright e2e : clic sur SpaceSelector → store updated, persistance reload.
- Tests Phase 2/3 : à définir au moment de la migration DB.

## Code orphelin (code-ready non câblé)

- Le champ `TenantScope.spaceId?` est posé mais aucun consumer ne le lit. C'est
  intentionnel jusqu'à Phase 3.

## Notes & historique

- **2026-05-10** — Phase 1 livrée : `useActiveSpace` + `SpaceSelector` + types
  étendus. Aucune query existante touchée.
