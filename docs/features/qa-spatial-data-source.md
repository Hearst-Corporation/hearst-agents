# QA — `/spatial` vs `/spatial-rnd` : data source unifiée — `qa-spatial-data-source`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-spatial-data-source`                                                                     |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — données divergentes entre deux routes qui devraient consommer la même source        |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Les routes `/spatial` et `/spatial-rnd` affichent des données différentes pour le même contexte utilisateur :
- `/spatial` : "Aujourd'hui, vous avez un meeting à **22:00**"
- `/spatial-rnd` : "Aujourd'hui, vous avez un meeting à **14:00**"

Selon la mémoire ADD ([project_spatial_architecture.md](../../../.claude/memory/project_spatial_architecture.md)), les routes Spatial doivent consommer les **mêmes stores/services** que le dashboard normal. Cette divergence indique des mock data hardcodés différents par route, alors que `/spatial-rnd` est censé être la version R&D de `/spatial` (mêmes données, rendu différent).

Note : `/spatial-safe` reste **lecture seule** (voir CLAUDE.md INTERDICTION ABSOLUE). Cette spec ne touche pas `spatial-safe`.

## Findings source

- **F-111** (Zone 2) — divergence /spatial vs /spatial-rnd (heure meeting 22:00 vs 14:00)
- **F-123** (Zone 2) — pas de toggle 2D ⇄ Spatial depuis `/cockpit-x` (P2, voir aussi `qa-spatial-toggle`)
- **SP-002 / SP-006** (Zone 2) — divergence overlay HTML

## Surface concernée

- [app/spatial/page.tsx](../../app/spatial/page.tsx) — route principale
- [app/spatial-rnd/page.tsx](../../app/spatial-rnd/page.tsx) — route R&D
- [components/spatial/](../../components/spatial/) — composants partagés
- [components/spatial-rnd/](../../components/spatial-rnd/) — composants R&D (si fork)
- Hook source : `useCockpitToday()`, `useTodayBrief()` ou équivalent
- Endpoint commun : `GET /api/v2/cockpit/today`

**Zone EXCLUE** : `app/spatial-safe/**`, `components/spatial-safe/**` (LECTURE SEULE — voir CLAUDE.md).

## Invariants verrouillés

### I-1. `/spatial` et `/spatial-rnd` consomment la même data source

Les deux routes **doivent** appeler le même endpoint (`GET /api/v2/cockpit/today` ou équivalent) ET utiliser le même hook (`useCockpitToday()` ou équivalent).

Aucun mock data hardcodé dans les composants spatial. Si mocks pour dev, ils doivent être centralisés dans un seul fichier consommé par les deux routes.

### I-2. Aucune divergence de timestamp / contenu

Pour le même user / même session, à un instant T, `/spatial` et `/spatial-rnd` affichent **strictement les mêmes** :
- heure du meeting
- nom du meeting
- count missions / suggestions / agenda
- entités KG résumées

Si une route a un champ que l'autre n'a pas (extension R&D), c'est OK. Mais les champs partagés doivent être identiques.

### I-3. `/spatial-safe` reste isolé et figé

`spatial-safe` est la sauvegarde de référence figée au 2026-05-12. Cette spec ne touche **pas** `/spatial-safe`. Lecture seule pour tous les agents.

### I-4. Pas de fork de composant pour la R&D

Si `/spatial-rnd` a besoin de prototyper un composant spécifique (ex: nouveau type de panel), il doit être ajouté **dans `components/spatial/`** et activé via un feature flag ou un wrapper R&D, pas forké dans `components/spatial-rnd/`.

Évite la dette de double maintenance.

### I-5. Mêmes stores Zustand

Les deux routes utilisent les mêmes stores (`useFocalStore`, `useSelectionStore`, `useStageStore`, etc.). Aucun store dédié `spatial-rnd`.

## Critères d'acceptation testables

1. **Endpoint identique** : navigate `/spatial` + capture network → `GET /api/v2/cockpit/today`. Idem `/spatial-rnd` → même URL.
2. **Heure meeting identique** : `expect(spatialText.match(/(\d{2}):(\d{2})/)[0]).toBe(spatialRndText.match(/(\d{2}):(\d{2})/)[0])`.
3. **Count missions identique** : extraire `Missions 0X` des deux routes, assert égalité.
4. **Pas de mock hardcodé** : grep `22:00` ou `14:00` dans `components/spatial*/` → 0 occurrence (si mocks, dans un fichier dédié).
5. **`/spatial-safe` non touché** : `git diff --name-only` ne montre aucun fichier sous `spatial-safe/`.

## Évolutions autorisées

- Refactor pour partager les composants entre `/spatial` et `/spatial-rnd`.
- Ajout de nouvelles vues R&D dans `/spatial-rnd` tant qu'elles utilisent la même data source.
- Migration progressive de `/spatial-rnd` vers `/spatial` (R&D → prod).

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Touche accidentelle de `spatial-safe` | Backup cassé                            | I-3 + lint path     |
| Mocks divergents oubliés            | Régression silencieuse                  | Test E2E comparant les routes |
| Fork composants R&D non maîtrisé    | Dette double                            | I-4 + audit régulier |

## Tests à écrire

- E2E : `tests/e2e/spatial-data-parity.spec.ts` — heure / count / entités identiques
- Lint : grep `mock` ou timestamps hardcodés dans `components/spatial*/`

## Notes & historique

- 2026-05-15 — Bug identifié Zone 2 lors de la comparaison overlay HTML.
- Le bug est probablement dû à des mocks dev hardcodés différents dans `/spatial-rnd` qui n'ont pas suivi `/spatial`.
- **CRITIQUE** : ne JAMAIS toucher `/spatial-safe` (voir CLAUDE.md, project_spatial_safe_backup.md).
