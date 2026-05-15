# QA — Stage persistance dans l'URL — `qa-stage-persistance-url`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-stage-persistance-url`                                                                   |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — F5 / share URL / back-forward perdent le contexte stage                             |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Quand l'utilisateur change de Stage via Cmd+1..0 ou click LeftRail, l'URL reste figée sur `/cockpit-x`. Le mode du stage est uniquement persisté dans le store Zustand `useStageStore`, donc :
- F5 (refresh) renvoie au Stage Accueil par défaut
- Share URL ne reflète pas le stage actif
- Back-forward navigateur ne switch pas les stages
- Bookmark d'un stage spécifique impossible

## Findings source

- **F-008** (Zone 1) — Stage Chat (Cmd+2) ne met pas à jour l'URL
- **F-039** (Zone 1) — F5 sur `/cockpit-x` après Cmd+2 renvoie au stage Accueil
- **F-101** (Zone 2) — hotkeys observées cassées (séparé, voir `qa-shell-hotkeys`), mais même problème de persistance sous-jacent

## Surface concernée

- [stores/stage.ts](../../stores/stage.ts) — `useStageStore.setMode()` doit sync avec router
- [app/(user)/cockpit-x/page.tsx](<../../app/(user)/cockpit-x/page.tsx>) — read initial mode depuis `searchParams`
- [app/(user)/_shell/LeftRail.tsx](<../../app/(user)/_shell/LeftRail.tsx>) — click bouton → setMode + router.replace
- [app/hooks/use-global-hotkeys.ts](../../app/hooks/use-global-hotkeys.ts) — hotkey → setMode + router.replace

## Invariants verrouillés

### I-1. Format URL canonique : `/cockpit-x?stage={mode}`

Quand l'utilisateur active un stage, l'URL **doit** refléter le mode via un query param `stage`. Exemples :
- `/cockpit-x` ou `/cockpit-x?stage=cockpit` → mode cockpit (default)
- `/cockpit-x?stage=chat` → mode chat
- `/cockpit-x?stage=mission` → mode mission

Format alternatif accepté : `/c/{threadId}` pour le chat avec thread spécifique (déjà documenté dans memory). Le format est figé sur `?stage=<mode>` pour les modes sans contexte d'entité.

### I-2. `router.replace` (pas `router.push`) pour les switches stage

Switcher de stage **ne doit pas** ajouter une entry dans l'historique navigateur (sinon le bouton back force back stage par stage, expérience désagréable). Utiliser `router.replace()` ou équivalent Next.js shallow routing.

### I-3. F5 reprend le stage actif

Quand l'URL est `/cockpit-x?stage=chat`, F5 (refresh) **doit** réafficher le Stage Chat, pas le Cockpit par défaut.

L'initialisation du store doit lire `searchParams.get('stage')` au mount et appeler `setMode(value)` avant le premier render utile.

### I-4. Share URL fonctionnelle

Copier `/cockpit-x?stage=kg` et l'ouvrir dans un nouvel onglet **doit** charger directement le Stage KG.

### I-5. Mode inconnu → fallback cockpit

Si `?stage=invalid` est dans l'URL, le store fallback sur `mode: "cockpit"` (sans erreur). L'URL peut être normalisée silencieusement vers `/cockpit-x` (sans param) ou laissée telle quelle.

### I-6. Modes valides figés (12)

Liste : `cockpit`, `chat`, `asset`, `browser`, `meeting`, `kg`, `voice`, `simulation`, `mission`, `artifact`, `signal`, `asset_compare`.

Ajouter un mode = update spec.

## Critères d'acceptation testables

1. **URL sync click rail** : Cmd+2 → assert `page.url().endsWith('?stage=chat')`.
2. **F5 reprend stage** : navigate `/cockpit-x?stage=mission` + assert H1 contient "Mission".
3. **Share URL** : ouvrir `/cockpit-x?stage=kg` dans nouveau tab → Stage KG rendu.
4. **Back navigation** : naviguer cockpit → chat → kg → back → assert back ne refait pas chat → cockpit (replace, pas push).
5. **Fallback** : navigate `/cockpit-x?stage=foobar` → Stage cockpit rendu, console warn éventuelle mais pas d'erreur.

## Évolutions autorisées

- Ajouter un sous-paramètre (ex: `?stage=chat&thread=xyz`) sans casser I-1.
- Migrer vers une route segment (ex: `/cockpit-x/chat`) si Next.js le permet sans casser le shell global.
- Persister aussi dans localStorage en bonus pour les utilisateurs sans URL share.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Race condition mount → setMode      | Flash du Cockpit avant stage final     | Suspense ou setMode SSR-time |
| Trop de pushState                   | Historique pollué                       | I-2 replace         |
| Mode invalide en URL                | Erreur runtime                          | I-5 fallback        |
| Multi-tab desync                    | Stages différents par tab               | Acceptable, pas de mitigation |

## Tests à écrire

- E2E : `tests/e2e/stage-url-sync.spec.ts` — click rail → URL match
- E2E : `tests/e2e/stage-f5-restore.spec.ts` — navigate ?stage=mission + reload + assert mission
- Unit : `__tests__/stores/stage.test.ts` — readFromURL / writeToURL

## Notes & historique

- 2026-05-15 — Bug identifié Zone 1. Mode de stage non persisté.
- Lien avec spec `qa-shell-hotkeys` : la hotkey doit aussi mettre à jour l'URL (pas seulement le store).
