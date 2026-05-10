# Espaces — `spaces`

## Métadonnées

| Champ              | Valeur                                                         |
| ------------------ | -------------------------------------------------------------- |
| **id**             | `spaces`                                                       |
| **statut**         | `in_progress` (preview — Phases 1 & 2 livrées, Phase 3 à venir) |
| **owner**          | Adrien                                                         |
| **dernière revue** | 2026-05-10                                                     |
| **version spec**   | 1.1                                                            |

## Description

Les **Espaces** (ou _Spaces_) cloisonnent l'OS en silos logiques multi-projets à
l'intérieur d'un même workspace. L'utilisateur bascule entre `Perso`, `Side`,
`Venture` (defaults hardcodés) via un mini-selector dans la PulseBar — chaque
space portera à terme ses propres assets, missions, runs, reports, briefs,
watchlist. Aujourd'hui c'est une **foundation seulement** : le selector écrit
dans le store mais aucune query n'est encore filtrée.

## Surface publique

### Pages

- N/A — la feature vit dans le chrome (PulseBar) et est globale à l'app cockpit.

### Composants exportés

- [SpaceSelector.tsx](<../../app/(user)/components/SpaceSelector.tsx>) — 3 dots
  colorés (radio group) montés dans la zone gauche de la PulseBar. Pas de
  props : lit/écrit directement `useActiveSpace`.

### Endpoints API

- N/A côté HTTP. Phase 2 expose un helper server-side
  [`getActiveSpaceIdFromRequest()`](../../lib/multi-tenant/active-space.ts)
  qui lit le cookie `hearst-active-space-id` (synchronisé par le store
  client) — utilisable depuis RSC, route handlers et server actions.
  Phase 3 brancher ce helper dans les routes existantes pour filtrer
  les queries par `space_id`.

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
  `SpaceId = string`, la constante `DEFAULT_SPACE_ID = "personal"`, le champ
  optionnel `spaceId?` sur `TenantScope` / `ScopedMetadata`, et le helper
  `resolveSpaceId(scope)` qui retombe sur `DEFAULT_SPACE_ID`.
- [lib/multi-tenant/active-space.ts](../../lib/multi-tenant/active-space.ts)
  — helper server-side `getActiveSpaceIdFromRequest()` qui lit le cookie
  `hearst-active-space-id` (synchronisé par `stores/active-space.ts`) et
  retombe sur `DEFAULT_SPACE_ID` si absent. À consommer depuis RSC, route
  handlers et server actions (Phase 3).

### Dépendances externes (npm / services)

- `zustand` (déjà présent) — store + middleware `persist`.

## Data flow

```
[user clique un dot dans la PulseBar]
  ↓
[SpaceSelector.onClick → useActiveSpace.setActiveSpace(id)]
  ↓
[zustand persist → localStorage `hearst-active-space`]
[                ↘ subscription store → cookie `hearst-active-space-id`]
  ↓                                            ↓
[Phase 2 stop ici — colonne `space_id` posée   [getActiveSpaceIdFromRequest()
 sur les tables tenant-scoped, helper server-   lit le cookie côté server]
 side dispo ; aucun WHERE space_id encore      ]
 branché côté query]
  ↓
[Phase 3 future : queries asset/mission/run/report filtrent par spaceId
 via WHERE space_id = getActiveSpaceIdFromRequest()]
```

## Roadmap de migration

La feature est livrée en **3 phases** pour éviter une bascule big-bang risquée.

### Phase 1 — Foundation (LIVRÉE)

- Type `SpaceId` + champ optionnel `spaceId?` sur `TenantScope` / `ScopedMetadata`.
- Store `useActiveSpace` (3 spaces hardcodés : `personal` / `side-project` / `venture`).
- Composant `SpaceSelector` monté dans la PulseBar.
- Persistance localStorage.
- **Aucune query existante n'est modifiée.** Le selector est cosmétique.

### Phase 2 — Schéma DB + helper server-side (LIVRÉE)

Migration : [`supabase/migrations/0062_spaces_foundation.sql`](../../supabase/migrations/0062_spaces_foundation.sql).

Tables ayant reçu `space_id text NOT NULL DEFAULT 'personal'` :

| Table             | Index composite              | Notes                                   |
| ----------------- | ---------------------------- | --------------------------------------- |
| `assets`          | `(thread_id, space_id)`      | pas de tenant_id direct                 |
| `missions`        | `(user_id, space_id)`        | user-scoped                             |
| `mission_runs`    | `(mission_id, space_id)`     | dérivé de mission                       |
| `runs`            | `(tenant_id, space_id)`      | tenant_id posé en migration 0051        |
| `personas`        | `(tenant_id, space_id)`      | tenant_id posé en migration 0050/0052   |
| `report_versions` | `(tenant_id, space_id)`      | tenant_id posé en migration 0042        |

Volontairement exclus :

- `marketplace_*` — catalogue public, hors scope tenant.
- `audit_logs`, `usage_logs`, `credit_ledger` — télémétrie cross-space.
- `briefs`, `watchlist_items`, `inbox_briefs` — tables qui n'existent pas
  encore en DB ; à étendre quand elles seront créées.

Helper server-side livré :
[`lib/multi-tenant/active-space.ts`](../../lib/multi-tenant/active-space.ts)

- `getActiveSpaceIdFromRequest(): Promise<string>` — lit le cookie
  `hearst-active-space-id` via `next/headers#cookies()`, retombe sur
  `DEFAULT_SPACE_ID = "personal"` si absent.
- Cookie synchronisé côté client par [`stores/active-space.ts`](../../stores/active-space.ts)
  (subscription Zustand qui réécrit le cookie à chaque switch + au boot).

Backfill : implicite via `DEFAULT 'personal'` sur la colonne — pas de
script de backfill requis. Les rows existants reçoivent automatiquement
`space_id = 'personal'` au moment de l'`ALTER`.

Pas de table `spaces` séparée pour l'instant — defaults hardcodés dans
`DEFAULT_SPACES`. À introduire le jour où on ouvre les custom-spaces.

**Toujours pas de filtre côté query** — Phase 3 branche les `WHERE
space_id = ?` route par route.

### Phase 3 — Filtrage des queries (À VENIR)

Brancher `useActiveSpace().activeSpaceId` (côté client) ou le passer dans le
contexte `TenantScope` (côté serveur) puis filtrer toutes les routes/loaders
qui retournent des données scopées.

Estimation des fichiers à toucher (non exhaustif) :

| Domaine         | Fichiers approximatifs                                          | Notes                                      |
| --------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Assets          | `app/api/v2/assets/**`, `lib/assets/**`, `stores/asset-*`       | filtrer list + create                      |
| Missions        | `app/api/v2/missions/**`, `lib/missions/**`, `stores/missions*` | inclut runs liés                           |
| Runs            | `app/api/v2/runs/**`, `lib/runs/**`                             | dérivé de mission, propage automatiquement |
| Reports         | `app/api/v2/reports/**`, `lib/reports/**`                       | filtrer list                               |
| Briefs          | `app/api/v2/briefs/**`, `lib/briefs/**`                         | daily-brief par space                      |
| Watchlist       | `app/api/v2/watchlist/**`                                       | filtrer list + alertes                     |
| Personas        | `app/api/v2/personas/**`                                        | TBD : space-scoped ou workspace-scoped ?   |
| Cockpit signals | `app/api/v2/cockpit/signals/**`                                 | filtrer par activeSpaceId                  |
| TimelineRail    | `stores/timeline-*`, components rail                            | filtrer entries par space                  |
| Stage data      | `stores/stage-data.ts`                                          | bind par space                             |

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
4. Brancher de nouveaux call-sites sur `useActiveSpace()` qui _lisent_ l'id en
   readonly (logging, télémétrie) sans encore filtrer les queries.

## Risques & modes de défaillance

| Risque                                                                           | Impact                | Mitigation actuelle                                              |
| -------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| User switche un space en attendant Phase 3 → croit que les queries filtrent déjà | Confusion UX          | Tooltip simple, pas de promesse de filtrage. Doc preview claire. |
| `activeSpaceId` pointe vers un id absent (après edit manuel localStorage)        | Selector vide         | Garde-fou dans `setActiveSpace` (refuse ids inconnus)            |
| Suppression du dernier space                                                     | Plus de space actif   | `removeSpace` refuse si length ≤ 1                               |
| Migration Phase 2 oublie de backfill `space_id`                                  | Rows orphelines en DB | À couvrir dans la migration : `DEFAULT 'personal'` non-null      |

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
- **2026-05-10** — Phase 2 livrée : migration `0062_spaces_foundation.sql`
  (colonne `space_id` + index composites sur 6 tables), helper server-side
  `getActiveSpaceIdFromRequest()`, sync cookie côté `useActiveSpace` et
  helper `resolveSpaceId(scope)` côté `lib/multi-tenant/types.ts`. Migration
  pas encore appliquée — à faire au moment d'ouvrir Phase 3.
