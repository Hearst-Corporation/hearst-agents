# Mission Budget — `mission-budget`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `mission-budget` |
| **statut** | `in_progress` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-10 |
| **version spec** | 1.0 |
| **niveau** | P1 — hard-stop budget protège le portefeuille user, fail-open si Supabase down |
| **livrée** | Sprint 3 (S3-D) |

## Description

Cap budget mensuel par mission, exprimé en USD. Le scheduler refuse de déclencher une mission si le cumul `costUsd` du mois en cours dépasse le `budgetUsd` configuré. Affichage d'un badge `MissionBudgetBadge` dans la liste des missions et sur le `MissionStage`. Reset implicite chaque 1er du mois (la fenêtre courante = mois civil UTC).

Philosophie : **garde-fou explicite** sur les missions coûteuses (vidéo Runway, recherche web extensive) + transparence sur la consommation.

## Surface publique

### Composants
- [app/(user)/components/cockpit/MissionBudgetBadge.tsx](../../app/(user)/components/cockpit/MissionBudgetBadge.tsx) — badge `<used> / <budget> $` avec couleur progressive (vert sourd → ambre → bloqué)

### Pas d'endpoint dédié
Configuration via `PATCH /api/v2/missions/[id]` (champ `actions.budgetUsd`). Lecture via le payload mission.

## Architecture interne

### Storage
- `missions.actions.budgetUsd: number | null` (JSONB) — cap mensuel en USD, `null` = pas de cap
- `missions.actions.budgetUsedThisMonth: number` (cache, MAJ à chaque run)
- `missions.actions.budgetMonth: string` (`YYYY-MM` du compteur courant)

### Librairies
- [lib/engine/runtime/missions/budget.ts](../../lib/engine/runtime/missions/budget.ts) — `checkBudget(mission)` retourne `{ allowed, used, budget, remaining }`
- [lib/engine/runtime/missions/scheduler.ts](../../lib/engine/runtime/missions/scheduler.ts) — Layer 2.5 (entre guards 2 et 3) : appel `checkBudget()` avant `tryAcquireMissionLease()`

### Layer scheduler étendu
```
[scheduler.ts tick]
  ↓
  Guard 1 : leader lease
  Guard 2 : triggeredThisMinute
  Layer 2.5 : checkBudget(mission)  ← nouveau
  Guard 3 : isMissionRunning (in-process)
  Guard 4 : tryAcquireMissionLease (distributed)
```

### Cache
- Per-mission cache 5min sur `checkBudget()` résultat (évite scan runs à chaque tick)
- Invalidation manuelle après chaque run réussi (cumul mis à jour)

## Data flow

```
[scheduler tick → mission ready]
  ↓ Layer 2.5 : checkBudget(mission)
  ↓   ├─ Si budgetUsd === null → allowed:true (pas de cap)
  ↓   ├─ Si budgetMonth !== YYYY-MM(now) → reset compteur
  ↓   ├─ Compute used = sum(runs.costUsd) ce mois
  ↓   └─ allowed = used < budgetUsd
  ↓ Si allowed=false → skip + log "budget exceeded"
  ↓ Si allowed=true → continue Guard 3+
[Run termine avec costUsd]
  ↓ MAJ missions.actions.budgetUsedThisMonth += costUsd
  ↓ invalidate cache
```

## Invariants verrouillés

### I-1. Storage JSONB sur `missions.actions`
Champs `budgetUsd`, `budgetUsedThisMonth`, `budgetMonth` stockés dans le JSONB `actions`. Pas de table séparée. Cohérent avec `autoExport`, `contextSummary`, etc.

### I-2. Cache 5min côté `checkBudget()`
Per-mission, in-process. Évite scan SQL sur la table runs à chaque tick scheduler. Invalidé manuellement après chaque run.

### I-3. Fail-open scheduler si Supabase down
Si `checkBudget()` throw / timeout sur lecture DB → retourne `{ allowed: true }` (autorise la run). Choix conscient cohérent avec [missions.md I-5](missions.md) : mieux vaut sur-dépenser une fois que tout bloquer en cas d'incident infra.

### I-4. Reset implicite mensuel UTC
Le compteur `budgetUsedThisMonth` se reset au prochain tick après changement de mois (`budgetMonth !== YYYY-MM(now)`). Pas de cron dédié reset. Mois civil UTC strict.

### I-5. Layer 2.5 dans scheduler — ordre figé
`checkBudget()` appelé **entre** Guard 2 (in-process minute dedup) et Guard 3 (in-process lease). Cohérent avec [missions.md I-4](missions.md) : 4 guards anti-double-exécution. Le budget check ne remplace aucun guard, il s'intercale.

### I-6. Currency = USD uniquement
`budgetUsd` est en dollars. Pas de support multi-devise. Si l'utilisateur travaille en EUR, conversion à sa charge côté UI.

### I-7. `null` = pas de cap (default)
Une mission sans `budgetUsd` configurée n'est jamais bloquée. Default = unconstrained. Opt-in budget par mission.

## Évolutions autorisées sans spec

- Polish UI `MissionBudgetBadge` (couleurs, transitions, mobile)
- Ajout d'un seuil "warning" (ex: 80% utilisé → couleur ambre)
- Notification push quand budget atteint
- Endpoint dédié `GET /api/v2/missions/[id]/budget` (si besoin)
- Ajout d'un budget global par tenant (en plus du per-mission)
- Reset opt-in via UI (forcer reset mid-month)

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Cumul `costUsd` mal renseigné par les runs | Budget flou | À surveiller — cohérence run.costUsd côté orchestrator |
| Cache 5min stale | Budget légèrement dépassé (delta 1 run) | Acceptable, fail-open philosophy |
| Supabase lent / down | Fail-open → cap ignoré ce tick | Acceptable cf I-3 |
| Mission sans `costUsd` calculé | Used=0, allowed=true toujours | À surveiller (orchestrator doit toujours setter) |
| Race entre 2 instances scheduler | Double dépense d'un run | Mitigé par leases distribués (cf [missions I-4](missions.md)) |

## Tests

### Manquants (gap)
- Test `checkBudget` allowed/blocked/null cases
- Test reset mensuel (mock Date Y/M)
- Test cache 5min invalidation post-run
- Test fail-open Supabase error
- Test Layer 2.5 placement dans scheduler tick
- Test UI badge couleurs progressives

## Notes & historique

- **Sprint 3 (S3-D)** — release initiale, hard-stop scheduler + UI badge
- Layer 2.5 placé en in-process pour éviter coût SQL à chaque tick
