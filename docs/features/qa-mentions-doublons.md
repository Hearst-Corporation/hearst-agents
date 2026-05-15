# QA — ChatDock mentions doublonnées — `qa-mentions-doublons`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-mentions-doublons`                                                                       |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — confusion utilisateur sur les mentions disponibles, 2 boutons par provider          |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Le ChatDock affiche des boutons "Mentionner X" pour chaque app connectée. Pour certains providers, les aliases backend (slugs internes) cohabitent avec les noms display dans l'UI :

- `Mentionner Google Agenda` + `Mentionner googlecalendar` (2 boutons pour le même provider)
- `Mentionner Google Drive` + `Mentionner googledrive` (idem)

Conséquence : l'utilisateur voit 2 boutons identiques pour la même app, ne sait pas lequel utiliser, et confusion immédiate.

## Findings source

- **F-113** (Zone 2) — `Mentionner Google Agenda` + `Mentionner googlecalendar` + idem Drive
- **C-012** (Zone 2) — Chat matrix doublon mentions

## Surface concernée

- [app/(user)/components/ChatDock.tsx](<../../app/(user)/components/ChatDock.tsx>) — render des boutons mentions
- Hook ou liste source des apps mentionnables (probable `useConnections()` ou `app/(user)/_chat/mentions.ts`)
- Normalizer côté backend qui exposerait aliases (Composio ?)

## Invariants verrouillés

### I-1. 1 bouton mention par provider

Pour chaque provider connecté, **exactement 1 bouton** `Mentionner X` est rendu. Pas de doublon par alias.

### I-2. Display name canonique préféré au slug

Quand un provider a un display name (ex: "Google Agenda") et un slug (ex: "googlecalendar"), le bouton **doit** afficher le display name. Le slug est utilisé uniquement comme `data-provider-id` ou valeur interne.

### I-3. Normalisation côté frontend

La normalisation **doit** être faite côté frontend (ChatDock), pas dépendre du backend qui peut exposer des aliases pour compat. Dedup par identifiant canonique (probable `provider.id` ou `provider.slug` lowercase).

### I-4. Liste blanche des providers display names

Une map figée doit garantir l'affichage propre :
```ts
const PROVIDER_DISPLAY_NAMES = {
  googlecalendar: "Google Agenda",
  googledrive: "Google Drive",
  gmail: "Gmail",
  slack: "Slack",
  // etc.
};
```

Ajouter un provider → ajouter une entry. Pas d'affichage de slug raw dans l'UI.

### I-5. Ordre stable

L'ordre des boutons mentions doit être stable entre renders (probable tri alphabétique sur display name, ou ordre figé d'une liste).

## Critères d'acceptation testables

1. **Dedup** : `/cockpit-x` Stage Chat → assert `document.querySelectorAll('button[aria-label^="Mentionner "]').length` ≤ nombre de providers connectés uniques.
2. **Pas de slug raw** : aucun `aria-label="Mentionner googlecalendar"` ni "Mentionner googledrive" dans le DOM.
3. **Display names canoniques** : tous les boutons affichent un nom propre (capitalisé, avec espaces).
4. **Unicité** : `aria-labels` des boutons mentions tous distincts.

## Évolutions autorisées

- Ajout/retrait de providers tant que I-1 → I-4 tiennent.
- Refactor de la liste sources (Composio, native, custom) tant que le dedup reste effectif.
- Changement display name d'un provider (ex: "Google Calendar" plutôt que "Google Agenda").

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Backend ajoute alias non mappé       | Slug raw apparaît dans l'UI            | Fallback I-2 + warn |
| Map display names incomplète         | Slug visible                            | Test E2E + lint     |
| Tri instable                         | UX shuffle entre renders                | I-5 ordre stable    |

## Tests à écrire

- E2E : `tests/e2e/chat-mentions-no-duplicates.spec.ts` — dedup
- Unit : `__tests__/_chat/mentions.test.ts` — normalize function

## Notes & historique

- 2026-05-15 — Bug identifié Zone 2. Probablement la liste source est un union (display + slug) sans dedup.
