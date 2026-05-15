# QA — Stage Mission : cohérence label rail vs contenu — `qa-stage-mission-coherence`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-stage-mission-coherence`                                                                 |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P0** — confusion utilisateur immédiate, le label ne matche pas le contenu                  |
| **priorité**       | `P0`                                                                                         |
| **tag**            | `priorité-P0`, `qa-2026-05-15`                                                               |

## Description

Quand l'utilisateur active le Stage Mission (Cmd+9 ou click LeftRail "Mission (⌘9)"), le H1 rendu est "Variants en cours" — un titre qui appartient au Stage Asset Variants. Le label du bouton du rail dit "Mission", la hint Commandeur dit "Lancer une mission active", mais le contenu affiché parle de variantes d'assets.

Note : Zone 2 a observé un comportement différent — Stage Mission rend "Sélectionne une mission depuis la liste ou lance une commande." (empty state cohérent). Probablement deux composants candidats pour le mode "mission" dans le registry, ou un drift entre branches.

## Findings source

- **F-009** (Zone 1) — H1 Stage Mission = "Variants en cours" (incohérent)
- **F-026** (Zone 1) — Cmd+9 reproduit le même bug
- **S-09** (Zone 2) — Stage Mission empty state "Sélectionne une mission..." (cohérent)

Les deux observations sont contradictoires : à investiguer comme drift entre runs ou conflit de registry.

## Surface concernée

- [app/(user)/_stages/MissionStage.tsx](<../../app/(user)/_stages/MissionStage.tsx>) — composant attendu
- [app/(user)/_stages/registry.ts](<../../app/(user)/_stages/registry.ts>) — mapping mode → component
- [stores/stage.ts](../../stores/stage.ts) — `STAGE_HOTKEYS` mapping `9 → mission`
- [app/(user)/_shell/LeftRail.tsx](<../../app/(user)/_shell/LeftRail.tsx>) — label bouton "Mission (⌘9)"

## Invariants verrouillés

### I-1. Le mode `mission` rend `MissionStage.tsx`

Le registry `registry.ts` **doit** mapper `mode: "mission"` à un composant Stage dédié (`MissionStage.tsx`), et **pas** à `AssetCompareStage` ou `AssetStage` ou tout autre composant non-mission.

### I-2. H1 sémantiquement cohérent avec le label rail

Le composant `MissionStage` **doit** afficher un H1 dont le texte contient "Mission" ou un nom dérivé légitime (ex: "Studio Mission", "Missions actives", "Mission · {missionName}"). 

Interdit : H1 = "Variants en cours" ou tout titre qui ne fait pas référence aux missions.

### I-3. Cohérence label rail → label commandeur → label rail title → H1

Les 4 surfaces qui nomment le mode `mission` doivent rester alignées :
- Bouton LeftRail `aria-label="Mission (⌘9)"`
- Commandeur item label (ex: "Lancer une mission active")
- Rail droit title (ex: "Étapes")
- Stage H1

### I-4. Empty state explicite si pas de mission active

Si l'utilisateur ouvre Mission Stage sans mission sélectionnée, le contenu doit être un empty state avec :
- titre clair (ex: "Aucune mission active")
- CTA explicite (ex: bouton "Lancer une mission" ouvrant le Commandeur prefilledQuery)
- texte secondaire optionnel

Pas de matrice de 0 ou de placeholder "coming soon".

## Critères d'acceptation testables

1. **Mapping registry** : `import { STAGE_COMPONENTS } from 'app/(user)/_stages/registry'` → `STAGE_COMPONENTS.mission === MissionStage`.
2. **H1 cohérent** : navigate `/cockpit-x` + Cmd+9 + assert `document.querySelector('h1').textContent.toLowerCase().includes('mission')`.
3. **Pas de H1 "Variants en cours"** : assert `not(textContent.includes('Variants'))` sur le Stage Mission.
4. **Empty state CTA** : si aucune mission active, bouton "Lancer une mission" présent et cliquable.

## Évolutions autorisées

- Renommer "Mission" en "Missions" (pluriel) ou "Studio Mission" tant que I-3 reste aligné.
- Ajouter des sous-Stages (Mission > Détail, Mission > Logs) tant que le H1 racine reste cohérent.
- Modifier l'empty state copywriting.

## Risques & modes de défaillance

| Risque                                | Impact                                  | Mitigation actuelle |
| ------------------------------------- | --------------------------------------- | ------------------- |
| Drift registry après refactor         | Régression silencieuse de mapping      | Test E2E par mode   |
| Renommage label sans propagation      | Désynchronisation rail/commandeur/H1   | I-3 cohérence       |
| Confusion AssetVariants / Mission    | Bug observé Zone 1                     | Test sur 12 stages   |

## Tests à écrire

- E2E : `tests/e2e/stage-mission-h1.spec.ts` — Cmd+9 + assert H1 cohérent
- E2E : `tests/e2e/stage-registry-coherence.spec.ts` — pour chaque mode, H1 contient le nom du mode (avec mappage Mission, Voice, etc.)
- Unit : `__tests__/_stages/registry.test.ts` — type check du mapping mode → component

## Notes & historique

- 2026-05-15 — Zone 1 observe le bug en `/cockpit-x` après Cmd+9. Zone 2 observe l'empty state cohérent. Drift de session à reproduire en repro contrôlée.
