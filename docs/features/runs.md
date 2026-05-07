# Runs — `runs`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `runs` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P1 — canonical source runs + timeline normalize |

## Description

Historique structuré de toutes les exécutions IA utilisateur. Chaque run agrège input, metadata (surface, agentId, backend), timeline normalisée, assets générés (par référence), et métriques (tokens, coût, latence). Stockage hybride in-memory LRU (500 runs max) + Supabase canonical. Rerun = nouveau run.id avec même input.

## Surface publique

- `GET /api/v2/runs` — liste pagée (limit 50-200), scoped userId
- `GET /api/v2/runs/[id]` — détail + timeline normalisée
- `DELETE /api/v2/runs/[id]` — stub UI-side (pas de DELETE DB)
- `GET /api/v2/runs/[id]/export` — PDF/JSON
- `POST /api/v2/runs/[id]/rerun` — clone + nouveau run

## Types clés

```ts
type RunStatus = "running" | "completed" | "failed" | "awaiting_approval" | "awaiting_clarification";

interface RunRecord {
  id, tenantId, workspaceId, userId: string;
  input, surface?, executionMode?, agentId?, backend?, missionId?: string;
  createdAt, completedAt?: number;
  status: RunStatus;
  events: RunEvent[];
  assets: RunAssetRef[];   // refs seulement, pas de contenu
  metrics?: { tokensIn?, tokensOut?, costUsd?, latencyMs? };
}

type TimelineItemType =
  | "run_started" | "execution_mode" | "agent_selected" | "provider_check"
  | "capability_blocked" | "step_started" | "step_completed" | "step_failed"
  | "asset_generated" | "log" | "run_completed" | "run_failed";

interface TimelineItem {
  id, type: string; ts: number; title: string;
  description?, runId?, agentId?, backend?, provider?, assetId?, assetName?: string;
  severity: "info" | "success" | "warning" | "error";
}
```

Tables : `runs` (id, user_id, tenant_id, metrics jsonb), `run_events` (id, run_id, type, payload jsonb).

## Invariants verrouillés

### I-1. In-memory store max 500 runs — LRU eviction au dépassement

### I-2. Canonical source = Supabase — in-memory est fallback si Supabase vide

### I-3. `normalizeRunEventsToTimeline()` déterministe — mêmes events → même timeline

### I-4. Ownership check → 404 (pas 403) sur tous les endpoints `[id]`

### I-5. Status transitions valides — completed/failed → running invalide

### I-6. Assets stockés par référence uniquement (`RunAssetRef` : id, name, type, filePath)

### I-7. `DELETE /runs/[id]` = stub (retourne `{ ok: true }`) — aucun DELETE DB

### I-8. Rerun = nouveau run.id, même input, nouvelle exécution

### I-9. `TimelineItemType` — 12 valeurs figées

### I-10. `RunStatus` — 5 valeurs figées

## Tests

Existants : couverts indirectement via orchestrator tests

Manquants : LRU eviction à 500, ownership check 404, normalizeRunEventsToTimeline determinisme, delete stub, rerun flow.
