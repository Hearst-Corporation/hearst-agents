# Drift Detection — `drift-detection`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `drift-detection` |
| **statut** | `in_progress` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-10 |
| **version spec** | 1.0 |
| **niveau** | P2 — surface signal d'usure mission, fail-soft tolérant |
| **livrée** | Sprint 3 (S3-E) |

## Description

Détection automatique de "missions silencieuses" — celles dont les outputs n'évoluent quasiment plus run après run. Calcul d'un delta inter-runs (comparaison normalisée des derniers outputs), si N runs consécutifs sans mouvement (>threshold de similarité), notification de type `signal` subtype `mission_drift` est émise.

Philosophie : **détecter les missions qui tournent dans le vide** — elles consomment du quota sans produire de nouvelle valeur. L'utilisateur peut choisir de les ajuster, pauser ou supprimer.

## Surface publique

### Composants
Pas de composant dédié. Surface via :
- Notification `signal` (cf [notifications.md](notifications.md)) avec subtype `mission_drift`
- Whisper PulseBar (cf [signal-board.md](signal-board.md)) si activé
- Affichage badge "Drift détecté" dans `MissionStage` (cf [stage.md](stage.md))

### Pas d'endpoint dédié
Hook intégré au scheduler post-run (cf data flow).

## Architecture interne

### Librairies
- [lib/cockpit/drift-detection.ts](../../lib/cockpit/drift-detection.ts) :
  - `computeDelta(prev, current)` — normalize outputs (strip whitespace, dates, IDs volatils) puis Levenshtein/cosine ratio
  - `detectDrift(missionId, lastN)` — récupère les N derniers runs, compute deltas, retourne `{ isStale, deltas, staleSince }`
  - `notifyDriftIfNeeded(missionId)` — appelle `detectDrift`, émet notification si `isStale && cooldownExpired`

### Hook scheduler
- [lib/engine/runtime/missions/scheduler.ts](../../lib/engine/runtime/missions/scheduler.ts) — appel `notifyDriftIfNeeded()` en post-run (fire-and-forget)

### Cooldown storage
- `missions.actions.driftLastNotifiedAt: string | null` (ISO date) — empêche notif répétée

## Data flow

```
[Mission run termine avec output]
  ↓ post-run hook (scheduler.ts)
  ↓ fire-and-forget : notifyDriftIfNeeded(missionId)
[detectDrift(missionId, lastN=5)]
  ↓ load last 5 runs outputs
  ↓ normalize each (strip dates/IDs/whitespace)
  ↓ compute pairwise deltas
  ↓ if all deltas < threshold (5%) AND lastN >= minStaleRuns (3)
  ↓   → isStale=true, staleSince=oldestRunInStreak.created_at
[Si isStale && (now - driftLastNotifiedAt) > 24h]
  ↓ emit notification kind=signal subtype=mission_drift
  ↓ MAJ missions.actions.driftLastNotifiedAt = now
```

## Invariants verrouillés

### I-1. Threshold delta = 5%
Ratio de différence < 5% entre 2 runs consécutifs = considérés "identiques". Au-dessus = mission progresse encore. Choix conscient (sensible aux variations mineures sans flagger les microchangements).

### I-2. minStaleRuns = 3
Il faut **au moins 3 runs consécutifs** sans mouvement pour déclencher. Évite les false-positives sur missions weekly/monthly à output stable par nature (genre "rapport hebdo identique car semaine calme").

### I-3. Cooldown 24h
Une fois la notification émise pour une mission, pas de re-notif avant 24h. Évite le spam si l'utilisateur ne réagit pas immédiatement.

### I-4. Fail-soft outputs incompatibles
Si les outputs ne sont pas comparables (types différents, JSON corrompu, binary), `computeDelta` retourne `null` et la mission est considérée non-stale (pas de notif). Fail-soft : on ne crash pas, on skip.

### I-5. Hook post-run fire-and-forget
`notifyDriftIfNeeded()` est appelé après `updateMissionLastRun`, en fire-and-forget. Une erreur drift detection ne fail jamais la run.

### I-6. Notification kind = `signal`, subtype = `mission_drift`
Cohérent avec [notifications.md](notifications.md). Subtype `mission_drift` est figé. Sourd (severity `attention`, pas `warn` ni `danger`).

### I-7. Storage cooldown sur `missions.actions.driftLastNotifiedAt`
JSONB sur `missions.actions`. Pas de table séparée. Cohérent avec `autoExport`, `budgetUsd`, etc.

## Évolutions autorisées sans spec

- Ajustement du threshold (5% → 7%) si feedback
- Ajustement minStaleRuns (3 → 4) si trop bruité
- Cooldown ajustable (24h → 48h)
- Algorithme delta affiné (BLEU score, embedding cosine)
- Whitelist de patterns à ignorer (timestamps, IDs spécifiques)
- Action CTA dans la notification ("Pauser cette mission")
- Filter par mission frequency (skip pour daily/hourly)

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Output volatile (timestamps, IDs) | False positive (drift signalé alors que sémantique change) | Normalize step strip dates + IDs volatils |
| Output binary/large | computeDelta lent | Cap taille input + fail-soft null |
| Cooldown skip après éval | Pas de notif | Acceptable (24h grâce) |
| Mission daily 7 jours sans mouvement = vraiment ennuyante | Notif pertinente | C'est le but, pas un risque |
| Hook fail bloque run ? | Non — fire-and-forget | OK |

## Tests

### Manquants (gap)
- Test `computeDelta` types compatibles (text, JSON, list)
- Test `computeDelta` types incompatibles → null
- Test `detectDrift` lastN<minStaleRuns → false
- Test cooldown 24h respecte
- Test post-run hook fire-and-forget (erreur ne propage pas)
- Test threshold 5% boundary
- Test notification émise une seule fois dans la fenêtre cooldown

## Notes & historique

- **Sprint 3 (S3-E)** — release initiale, hook scheduler post-run + notification signal
