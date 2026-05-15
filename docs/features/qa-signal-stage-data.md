# QA — SignalStage : compteurs à 0 (data-bound ?) — `qa-signal-stage-data`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-signal-stage-data`                                                                       |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — SignalStage affiche matrice de 0 sur tous compteurs, soit polling absent soit empty state malformé |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Le SignalStage (`/cockpit-x` → click "Signaux") affiche :
> Cumul 0 signal sur la fenêtre. Répartition Échec mission 0 · Connexion 0 · Briefing 0 · Vidéo 0 · Silencieuse 0.

Deux interprétations possibles :
1. **Polling absent** : `GET /api/v2/cockpit/signals` n'est pas appelé (alors que la spec [signal-board.md](signal-board.md) existe et que l'endpoint devrait fournir des données).
2. **Vraiment 0 signal** : il n'y a effectivement aucun signal dans la fenêtre, mais l'empty state est rendu comme une matrice de 0 au lieu d'un message clair.

La feature [signal-board.md](signal-board.md) v1.0 est en `in_progress` (livrée Q3-B + S3-B). Cette spec QA complète l'invariant d'empty state.

## Findings source

- **F-117** (Zone 2) — Stage Signal : tous compteurs à 0
- Cross-ref : [signal-board.md](signal-board.md) v1.0

## Surface concernée

- [app/(user)/components/stages/SignalBoardStage.tsx](<../../app/(user)/components/stages/SignalBoardStage.tsx>)
- [app/api/v2/cockpit/signals/route.ts](../../app/api/v2/cockpit/signals/route.ts)
- [lib/cockpit/ambient-signals.ts](../../lib/cockpit/ambient-signals.ts) — 5 détecteurs
- Spec : [signal-board.md](signal-board.md)

## Invariants verrouillés

### I-1. Endpoint `/api/v2/cockpit/signals` polled au mount

SignalStage **doit** appeler `GET /api/v2/cockpit/signals` au mount, et toutes les 60s tant que le stage reste actif. Vérifier dans network log.

### I-2. Empty state explicite si 0 signal

Si la réponse est `{ signals: [], generatedAt: <timestamp> }` :
- Le stage **ne doit pas** afficher une matrice de 0.
- Empty state recommandé :
  > "Aucun signal sur la fenêtre. Hearst veille, mais rien ne ressort en ce moment. Reviens plus tard ou élargis la fenêtre."
- Optionnel : illustration sobre (icône bell sourd).

### I-3. Matrice détaillée seulement si > 0

La répartition `Échec mission X · Connexion Y · …` n'est rendue que si `signals.length > 0`. Sinon empty state I-2.

### I-4. Cohérence avec spec `signal-board.md`

Respect des invariants :
- I-1 signal-board : 5 kinds figés
- I-6 signal-board : whisper PulseBar uniquement (pas de toast)
- I-7 signal-board : voix régulière FR

Cette spec QA ne contredit pas la spec signal-board mais en complète l'invariant UX empty state.

### I-5. Filtre par fenêtre fonctionnel

Le sélecteur fenêtre (1h / 7j / 30j / Tout) doit déclencher une nouvelle fetch avec le paramètre query. Si tous les filtres retournent 0 → empty state global.

### I-6. Filtre par type fonctionnel

Le sélecteur type (Tous / Échec mission / Connexion / Briefing / Vidéo / Silencieuse) doit filtrer les signals affichés. Si un type spécifique retourne 0 mais d'autres types ont des signals → empty state local au filtre, pas global.

## Critères d'acceptation testables

1. **Polling actif** : navigate Stage Signal + capture network → `GET /api/v2/cockpit/signals` présent.
2. **Empty state propre** : mock retour 0 signal → DOM contient un message explicite, pas une matrice de 0.
3. **Filtre fenêtre** : changer fenêtre → nouvelle fetch déclenchée.
4. **Filtre type** : changer type → nouveau rendu cohérent.
5. **Conformité spec signal-board** : voix régulière FR, severity sourde.

## Évolutions autorisées

- Ajout de filtres supplémentaires (par severity, par entité).
- Pagination si > 50 signals.
- Action contextuelle par signal (dismiss, snooze).

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Polling absent oublié dans refacto  | Stage statique                          | Test E2E             |
| Matrice de 0 confuse                | UX dégradée                             | I-2 empty state      |
| Détecteur backend cassé             | Faux 0                                  | Tests détecteurs (cf signal-board.md) |

## Tests à écrire

- E2E : `tests/e2e/signal-stage-polling.spec.ts` — assert fetch + empty state
- E2E : `tests/e2e/signal-stage-filters.spec.ts` — filtre fenêtre + type
- Unit : `__tests__/_stages/SignalBoardStage.test.tsx`

## Notes & historique

- 2026-05-15 — Bug identifié Zone 2.
- Lié à la spec verrouillée [signal-board.md](signal-board.md) v1.0 — ne contredit aucun invariant.
