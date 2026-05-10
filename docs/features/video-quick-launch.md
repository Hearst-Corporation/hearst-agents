# Video Quick Launch — `video-quick-launch`

## Métadonnées

| Champ              | Valeur                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| **id**             | `video-quick-launch`                                                                |
| **statut**         | `in_progress`                                                                       |
| **owner**          | Adrien                                                                              |
| **dernière revue** | 2026-05-10                                                                          |
| **version spec**   | 1.0                                                                                 |
| **niveau**         | P1 — flow génération vidéo critique, hotkey global, batch jusqu'à 4 jobs parallèles |
| **livrée**         | Sprint 2 (S2-A) + Q3 (Q3-A batch mode)                                              |

## Description

Panel rapide pour lancer une génération vidéo Runway / fal sans passer par le builder mission complet. Ouvert via hotkey ⌘G, propose prompt + références image/vidéo, mode single ou batch (jusqu'à 4 variants), et stream le progress via SSE pendant la génération. Au terme, ouvre `AssetCompareStage` pour comparer les variants côte à côte.

Philosophie : **chemin court vers la vidéo** (≤ 30 secondes du désir au job lancé), feedback live (SSE + fallback poll), et conclusion en mode "compare" pour le mode batch.

## Surface publique

### Composants

- [app/(user)/components/VideoQuickLaunch.tsx](<../../app/(user)/components/VideoQuickLaunch.tsx>) — panel modal/sheet avec form prompt + uploads + bouton "Générer" / "Générer 4 variants"
- AssetCompareStage (cf [stage.md](stage.md)) — utilisé en post-génération pour le mode batch

### Endpoints API

- `GET /api/v2/jobs/[jobId]/progress` ([route.ts](../../app/api/v2/jobs/[jobId]/progress/route.ts))
  - **Auth** : `requireScope()` + ownership
  - **Output** : SSE stream `progress` events `{ pct, status, eta }` via QueueEvents Bull
  - **Fallback** : si SSE close prématuré, le client poll `/api/v2/jobs/[jobId]` toutes les 2s
- `POST /api/v2/assets/batch` ([route.ts](../../app/api/v2/assets/batch/route.ts))
  - **Auth** : `requireScope()`
  - **Input** : `{ prompt, references?, count: 1-4, model?, params? }`
  - **Output** : `{ jobIds: string[] }` — un job par variant

### Stores Zustand

- [stores/video-quick-launch.ts](../../stores/video-quick-launch.ts) — `useVideoQuickLaunchStore`
  - State : `isOpen`, `prompt`, `references`, `count`, `jobs[]`, `mode: "single" | "batch"`
  - Actions : `open()`, `close()`, `submit()`, `setProgress(jobId, pct)`, `reset()`

## Architecture interne

### Hotkey

- Enregistré dans `app/hooks/use-global-hotkeys.ts` : ⌘G (Mac) / Ctrl+G (Windows) → toggle panel
- ESC pour fermer le panel

### Flow batch

```
[User presse ⌘G]
   ↓ open panel
[User remplit prompt + count=4 + références]
   ↓ submit()
[POST /api/v2/assets/batch { count: 4 }]
   ↓ retourne 4 jobIds
[Pour chaque jobId : open SSE /api/v2/jobs/[jobId]/progress]
   ↓ stream pct + status
   ↓ fallback poll si SSE close
[Tous jobs done]
   ↓ navigate vers AssetCompareStage avec assetIds
```

### Dépendances externes

- BullMQ + QueueEvents — progress updates
- Runway / fal SDK — génération vidéo (côté worker)
- R2 — storage des assets résultants

## Data flow

```
[VideoQuickLaunch panel ouvert ⌘G]
   ↓ form submit (prompt, count, references)
[POST /api/v2/assets/batch]
   ↓ enqueue Bull jobs (1..4)
[SSE /api/v2/jobs/[jobId]/progress par job]
   ↓ event "progress" { pct, eta }
   ↓ store.setProgress(jobId, pct)
[All jobs reach pct=100]
   ↓ if mode=batch : navigate AssetCompareStage(assetIds)
   ↓ if mode=single : navigate AssetStage(assetId)
```

## Invariants verrouillés

### I-1. Hotkey ⌘G (Mac) / Ctrl+G (Windows) — toggle global

Enregistré dans `use-global-hotkeys.ts`. ESC pour fermer. Ne doit pas conflicter avec Cmd+K (commandeur), Cmd+/, ou autre hotkey OS.

### I-2. Max 4 variants par batch

Validation Zod côté endpoint `POST /api/v2/assets/batch` : `count` borné `[1, 4]`. Au-dessus = 400. Choix conscient pour ne pas saturer la queue Runway.

### I-3. SSE QueueEvents + fallback poll 2s

Le client tente d'abord SSE sur `/api/v2/jobs/[jobId]/progress`. Si le stream close avant `pct=100`, fallback poll `/api/v2/jobs/[jobId]` toutes les 2s. Pas de migration full-poll sans spec (perte de feedback live).

### I-4. AssetCompareStage en sortie batch

Si `mode === "batch"` et tous jobs réussis, navigation auto vers `AssetCompareStage` avec les assetIds. Pas de retour cockpit silencieux.

### I-5. Ownership obligatoire sur progress endpoint

`GET /api/v2/jobs/[jobId]/progress` vérifie `job.userId === scope.userId`. Pas de leak cross-user.

### I-6. Persistance store via session uniquement

`useVideoQuickLaunchStore` n'est **pas** persisté localStorage (state éphémère). Une fois la session fermée, l'historique des batchs est perdu (les assets eux sont persistés normalement).

## Évolutions autorisées sans spec

- Ajout de modèles vidéo (Runway, fal, ...)
- Polish UI panel (typo, spacing, animations)
- Nouveau type de référence (audio, brand kit)
- Ajout de presets de prompt
- Ajustement de la fréquence de poll fallback
- Ajout d'événements SSE (ex: "frame_ready", "thumbnail")

## Risques & modes de défaillance

| Risque                                | Impact                      | Mitigation actuelle                                 |
| ------------------------------------- | --------------------------- | --------------------------------------------------- |
| Queue Bull saturée (batch x N users)  | Latence élevée              | Cap count=4 + queue priorité                        |
| SSE close inopiné (proxy timeout)     | Progress figé               | Fallback poll 2s                                    |
| Runway quota dépassé                  | Job fail                    | Status surfaced dans `/api/v2/jobs/[jobId]`         |
| Hotkey conflit IME / éditeur Markdown | Panel s'ouvre dans textarea | À surveiller — exclude `<input>`/`<textarea>` focus |
| Batch partiel (3/4 réussis)           | UX ambigu                   | AssetCompareStage gère N assets variable            |

## Tests

### Manquants (gap)

- Test endpoint `POST /api/v2/assets/batch` count borné [1,4]
- Test SSE progress events ordering
- Test fallback poll après SSE close
- Test ownership leak `/progress`
- Test hotkey conflict (input focus → no toggle)
- E2E : ⌘G → fill → submit batch 4 → AssetCompareStage

## Notes & historique

- **Sprint 2 (S2-A)** — release initiale single mode + SSE
- **Q3 (Q3-A batch)** — ajout du mode batch jusqu'à 4 variants + AssetCompareStage en sortie
