# QA — ChatDock : affordance des boutons disabled — `qa-chat-affordance-disabled`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-chat-affordance-disabled`                                                                |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — boutons disabled sans explication, utilisateur ne sait pas pourquoi ni comment activer |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Le ChatDock expose plusieurs boutons feature-locked qui sont `disabled` au boot sans :
- tooltip explicatif
- texte de hint
- aria-describedby

Boutons concernés :
- "Synthétiser en audio"
- "Exécuter le code"
- "Générer une image"

Et un bouton zombie :
- "Retirer Mission" : affiché alors qu'aucune mission n'est ciblée

Conséquence : l'utilisateur voit 3 icônes grises non-fonctionnelles et ne sait ni pourquoi c'est disabled, ni comment activer.

## Findings source

- **F-031** (Zone 1) — 3 boutons disabled sans tooltip ni hint
- **F-122** (Zone 2) — même bug reproduit
- **C-008** (Zone 2) — Chat matrix C-008 : tooltip absent
- **F-114** (Zone 2) — bouton "Retirer Mission" zombie affiché sans mission ciblée

## Surface concernée

- [app/(user)/components/ChatDock.tsx](<../../app/(user)/components/ChatDock.tsx>) — boutons feature-locked
- Hook ou state de contexte (mission sélectionnée, fichier joint, etc.)

## Invariants verrouillés

### I-1. Tout bouton disabled a une raison textuelle

Pour chaque `<button disabled>` :
- `title` attribut avec une raison FR ("Sélectionne d'abord un fichier", "Disponible quand un thread est actif", etc.)
- OU `aria-describedby` pointant vers un texte visible/hidden
- OU tooltip natif au hover

L'utilisateur doit toujours comprendre **pourquoi** le bouton est disabled et **comment** l'activer.

### I-2. Tooltip apparaît au hover et au focus

Le tooltip doit apparaître :
- au hover souris (delay 500ms recommandé)
- au focus keyboard (Tab navigation)

Délai en deux mouvements pour ne pas spammer.

### I-3. Voix régulière FR pour les tooltips

Voix éditoriale CLAUDE.md :
- "Disponible une fois un fichier joint" (pas "FILE REQUIRED")
- "Disponible une fois la mission active" (pas "MISSION REQUIRED")
- "Disponible après ajout d'un contexte" (pas "CONTEXT REQUIRED")

### I-4. Bouton "Retirer Mission" conditionnel

Le bouton "Retirer Mission" **doit être rendu uniquement si** une mission est attachée au prompt courant. Sinon, **ne pas rendre du tout** (pas `disabled`, pas `display:none`).

Critère : `missionId !== null && missionId !== undefined`.

### I-5. Tooltips primitive DS

Si un composant `<Tooltip>` existe dans le DS, l'utiliser. Sinon créer la primitive dans `app/(user)/components/ui/` cf CLAUDE.md → "Primitives DS".

### I-6. Cohérence : disabled vs hidden

Règles pour décider :
- **Hidden** : le bouton n'a pas de sens dans ce contexte (ex: "Retirer Mission" sans mission)
- **Disabled** : le bouton a un sens mais nécessite une action préalable (ex: "Synthétiser en audio" sans texte)

### I-7. Pas de duplication mono caps

Aucun texte mono caps ("DISABLED", "LOCKED") dans les tooltips ni dans les boutons.

## Critères d'acceptation testables

1. **Tous disabled ont title** : `Array.from(document.querySelectorAll('button[disabled]')).every(b => b.getAttribute('title') || b.getAttribute('aria-describedby'))`.
2. **Tooltip visible au hover** : hover sur "Synthétiser en audio" disabled → tooltip apparaît dans 500ms.
3. **Voix FR** : aucun "REQUIRED", "DISABLED", "LOCKED" en mono caps dans le DOM.
4. **"Retirer Mission" conditionnel** : fresh Chat → `document.querySelector('button[aria-label="Retirer Mission"]')` retourne `null`.
5. **Avec mission attachée** : attacher une mission → bouton "Retirer Mission" apparaît + clickable.

## Évolutions autorisées

- Customisation du copywriting des tooltips.
- Choix entre Tooltip primitive DS et title natif.
- Ajout d'icônes contextuelles dans les tooltips.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Tooltips qui spamment au hover      | UX dégradée                             | Délai 500ms          |
| Tooltip natif (`title`) inaccessible mobile | UX mobile dégradée            | Préférer primitive DS |
| Bouton zombie persiste après refacto | Bug récurrent                          | I-4 + test E2E       |

## Tests à écrire

- E2E : `tests/e2e/chat-disabled-tooltips.spec.ts` — assert tooltips
- E2E : `tests/e2e/chat-retirer-mission-conditional.spec.ts` — bouton n'apparaît qu'avec mission
- Unit : `__tests__/_chat/ChatDock.test.tsx` — render conditionnel

## Notes & historique

- 2026-05-15 — Bug identifié Zone 1 + Zone 2 (même symptôme, observation indépendante).
- Lié au pivot voix éditoriale 2026-04-29 : retirer tous les mono caps.
