# QA — Hotkeys globaux ⌘1..0 + ⌘K inopérants — `qa-shell-hotkeys`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-shell-hotkeys`                                                                           |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P0** — feature pivot shell visionOS (12 stages data-bound) inutilisable au clavier         |
| **priorité**       | `P0`                                                                                         |
| **tag**            | `priorité-P0`, `qa-2026-05-15`                                                               |

## Description

Les hotkeys ⌘1..⌘9, ⌘0, ⌘K, ⌘G (et présumés ⌘Shift+F pour Focus Mode) sont définis dans `stores/stage.ts:181-192` via `STAGE_HOTKEYS`. Le hook `useGlobalHotkeys` (`app/hooks/use-global-hotkeys.ts`) est référencé en docstring de `registry.ts:11` mais **n'est pas câblé dans le layout shell visionOS**.

Conséquence : pressing `Meta+2` depuis `/cockpit-x` ne change pas le mode du stage actif. `Meta+K` ne déclenche pas le Commandeur (et dérive même vers `/admin/themes` à cause de F-100/F-036 de la nav parasite).

Note : Zone 1 a observé Cmd+K et Cmd+1..0 fonctionnels ; Zone 2 a observé l'inverse. Probablement dépendant du focus actif et du timing — l'invariant est que les hotkeys doivent fonctionner **indépendamment du focus** (sauf modifier-less dans inputs cf qa-commandeur-a11y).

## Findings source

- **F-101** (Zone 2) — Meta+2, Meta+K inopérants depuis `/cockpit-x` ; dérive vers `/admin/themes`
- **F-046** (Zone 1) — useGlobalHotkeys confirmé Cmd+K, Cmd+1..0, Cmd+Shift+F (contradictoire avec Zone 2)
- **F-026** (Zone 1) — Cmd+9 fonctionne mais le contenu Stage est incohérent (voir spec `qa-stage-mission-coherence`)

## Surface concernée

- [stores/stage.ts](../../stores/stage.ts) — `STAGE_HOTKEYS` ligne 181-192
- [app/hooks/use-global-hotkeys.ts](../../app/hooks/use-global-hotkeys.ts) — hook clavier
- [app/(user)/layout.tsx](<../../app/(user)/layout.tsx>) — doit monter `useGlobalHotkeys()` au niveau racine du shell
- [app/(user)/components/Commandeur.tsx](<../../app/(user)/components/Commandeur.tsx>) — consumer du flag `commandeurOpen` du store

## Invariants verrouillés

### I-1. `useGlobalHotkeys()` monté au niveau racine `(user)/layout.tsx`

Le hook **doit** être appelé une seule fois, dans le layout shell visionOS, **après** le `<SessionProvider>` et **avant** les Stages. Pas dans un composant enfant qui peut être unmount/remount.

### I-2. Hotkeys ⌘1..⌘9, ⌘0 = stage switch

Pressing `Meta+1` (ou `Ctrl+1` sur Linux/Windows) **doit** appeler `useStageStore.setMode("cockpit")`, met le bouton LeftRail correspondant en `aria-current="page"`, et rend le Stage correspondant.

Mapping figé (cf `STAGE_HOTKEYS`) :
- ⌘1 → cockpit
- ⌘2 → chat
- ⌘3 → asset
- ⌘4 → browser
- ⌘5 → meeting
- ⌘6 → kg
- ⌘7 → voice
- ⌘8 → simulation
- ⌘9 → mission
- ⌘0 → artifact

### I-3. ⌘K toggle Commandeur

`Meta+K` **doit** toggler `setCommandeurOpen()`. Si Commandeur est fermé → ouvre. Si ouvert → ferme.

### I-4. ⌘G ouvre VideoQuickLaunch

`Meta+G` **doit** ouvrir le dialog VideoQuickLaunch. Voir spec `qa-commandeur-a11y` pour le focus transfer.

### I-5. ⌘Shift+F toggle Focus Mode

`Meta+Shift+F` **doit** activer/désactiver le Focus Mode (rail droit caché).

### I-6. Hotkeys avec modifier actives même dans un input

Une hotkey avec `Meta` ou `Ctrl` reste active même quand le focus est dans un textarea ou input. Seules les hotkeys lettre-seule (cas VideoQuickLaunch `g` dans Zone 1 F-033) sont filtrées par `isInInput()` (cf spec `qa-commandeur-a11y` I-3).

### I-7. preventDefault + stopPropagation sur match

Quand une hotkey match, l'event **doit** `preventDefault()` pour bloquer le comportement natif navigateur (ex: ⌘K = barre d'adresse Chrome) et `stopPropagation()` pour éviter le bubble.

## Critères d'acceptation testables

1. **Mount** : grep `useGlobalHotkeys()` dans `app/(user)/layout.tsx` → 1 occurrence.
2. **Stage switch ⌘1..0** : pour chaque hotkey 1..0, presser depuis `/cockpit-x` → assert le bon Stage rendu (h1, aria-current).
3. **⌘K toggle** : presser 2× → Commandeur ouvert puis fermé.
4. **⌘G ouvre VideoQuickLaunch** : presser → dialog présent dans DOM.
5. **⌘Shift+F focus mode** : presser → `aside[aria-label="Rail contextuel"]` caché (display: none).
6. **Modifier dans textarea** : focus ChatDock textarea, presser `Meta+2` → Stage Chat actif (la hotkey n'est pas absorbée par le textarea).
7. **Lettre seule dans textarea** : focus textarea, taper `g` → aucun VideoQuickLaunch ouvert (cf qa-commandeur-a11y I-3).

## Évolutions autorisées

- Ajout de nouvelles hotkeys (avec modifier) sans modifier les mappings existants.
- Refactor interne de `useGlobalHotkeys` tant que les invariants tiennent.
- Customisation utilisateur des hotkeys (feature future, optionnel).

## Risques & modes de défaillance

| Risque                                  | Impact                       | Mitigation actuelle |
| --------------------------------------- | ---------------------------- | ------------------- |
| Hook non monté après refactor layout    | Toutes hotkeys mortes        | I-1 + test E2E      |
| Conflit Meta+K avec barre adresse Chrome | UX dégradée                  | I-7 preventDefault  |
| Double mount HMR                        | Double dispatch d'une hotkey | Cleanup dans useEffect |
| Conflit avec dialogs ouverts            | Stage switch inattendu       | Filtrer si dialog ouvert (à valider) |

## Tests à écrire

- E2E : `tests/e2e/hotkeys-stage-switch.spec.ts` — 10 hotkeys × 1 stage chacune
- E2E : `tests/e2e/hotkeys-commandeur-toggle.spec.ts` — ⌘K toggle
- Unit : `__tests__/hooks/use-global-hotkeys.test.ts` — mapping + preventDefault
- Lint : grep `useGlobalHotkeys` dans `app/(user)/layout.tsx`

## Notes & historique

- 2026-05-15 — Bug identifié par Zone 2 (KO) ; Zone 1 a observé OK partiel (probable contexte focus différent).
- L'invariant minimal est que `useGlobalHotkeys()` soit monté et que les hotkeys avec modifier fonctionnent depuis n'importe quel focus.
