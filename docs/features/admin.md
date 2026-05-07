# Admin — `admin`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `admin` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

Interface d'administration système (`/admin/*`) avec layout dédié : sidebar collapsible + topbar KPI. Expose un canvas pipeline temps-réel (SSE), métriques LLM, circuit breakers, audit logs, health checks et analytics d'usage par tenant. Distinct du cockpit utilisateur (`/(user)/`) mais partage la même session NextAuth.

## Surface publique

**Shell layout**
- `app/admin/_shell/AdminShell.tsx` — layout racine (sidebar + topbar + main)
- `app/admin/_shell/AdminTopbar.tsx` — breadcrumb `Admin / <page>` + KPI strip + badge env
- `app/admin/_shell/AdminTopbarKpis.tsx` — KPIs live (`runsPerMin`, `p95LatencyMs`, `errorRate`) refresh 5 s
- `app/admin/_canvas/CanvasShell.tsx` — canvas pipeline SSE / replay

**Pages**
- `/admin` — accueil liens
- `/admin/pipeline` — canvas SSE live + replay de runs
- `/admin/agents` — liste/création agents (Server Component, Supabase direct)
- `/admin/agents/[id]` — détail agent
- `/admin/metrics` — métriques LLM + circuit breakers + webhooks + Web Vitals (refresh 30 s)
- `/admin/health` — system health check (Server Component)
- `/admin/audit` — audit logs
- `/admin/analytics` — analytics usage par tenant
- `/admin/runs` — historique des runs
- `/admin/settings` — réglages admin

**Endpoints API**
- `GET /api/admin/metrics/live` — KPIs 1h : `runsPerMin`, `p95LatencyMs`, `errorRate`, `sampleSize`
- `GET /api/admin/health` — `{ health: HealthStatus }`, 503 si dégradé
- `GET /api/admin/audit` — logs avec filtres `action`, `userId`, `severity`, `limit`, `offset`
- `GET /api/admin/analytics/tenants` — top tenants par coût USD + drill-down `?tenantId=`
- `GET /api/admin/analytics/usage` — usage agrégé

**Auth**
- `app/api/admin/_helpers.ts` → `requireAdmin(context, permission)` : appelle `requireScope` (même NextAuth que user) puis `checkPermission(db, { userId, tenantId, resource, action })`. Retourne `{ scope, db }` ou `NextResponse` en cas de refus.
- Bypass dev : `HEARST_DEV_AUTH_BYPASS=1` saute le check Supabase.

## Types clés

```ts
// KPIs topbar (refresh 5s)
interface LiveMetrics {
  runsPerMin: number;
  p95LatencyMs: number | null;
  errorRate: number;       // 0–1
  sampleSize: number;
  windowSeconds: number;   // 3600
}

// Canvas pipeline
type CanvasMode = "live" | "idle";

// Health
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, boolean>;
  latency: Record<string, number>;
  details: Record<string, string>;
  timestamp: string;
  version: string;
}

// Circuit breaker
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
```

## Invariants verrouillés

### I-1. `requireAdmin` : même NextAuth, RBAC Supabase supplémentaire
L'admin n'a pas d'auth séparée. `requireAdmin` réutilise `requireScope` (NextAuth), puis vérifie `checkPermission` sur la table Supabase. Supprimer l'appel à `checkPermission` sans alternative équivalente ouvre l'API admin à tout utilisateur authentifié.

### I-2. Sidebar collapsible persistée dans localStorage
`AdminShell` lit/écrit `localStorage["admin-sidebar-collapsed"]` (`"1"` / `"0"`). L'état est initialisé en IIFE synchrone pour éviter le flash expanded→collapsed. Ne pas remplacer ce pattern par un état côté serveur ou cookie — ça introduirait un RTT et un flash.

### I-3. KPI topbar refresh 5 s, fenêtre 1 h, cap 1 000 rows
`AdminTopbarKpis` poll `/api/admin/metrics/live` toutes les 5 s. La route agrège sur les 3 600 dernières secondes, limitée à 1 000 rows. Ne pas descendre l'intervalle (saturation) ni élargir la fenêtre sans pagination.

### I-4. `/admin/metrics` refresh 30 s
La page métriques LLM se rafraîchit toutes les `30_000` ms via `setInterval`. Elle ne doit pas descendre sous 10 s (charge DB) ni monter au-dessus de 60 s (données trop stales pour le debugging).

### I-5. Canvas pipeline : modes `live` vs `replay` mutuellement exclusifs
`CanvasShell` a deux modes : `live` (SSE bus global) et `idle + selectedRunId` (replay d'un run persisté). Passer en live efface `selectedRunId` et reset le replay. Charger un run passe automatiquement en `idle`. Ne jamais avoir `mode === "live"` et `selectedRunId !== null` simultanément.

### I-6. Audit : permission `action: "admin"` sur resource `"settings"`
L'endpoint audit requiert explicitement `action: "admin"` (plus strict que `"read"`). Ne pas abaisser ce niveau — les audit logs contiennent des traces d'actions sensibles.

### I-7. Canvas requis desktop (≥ lg)
`CanvasShell` masque le canvas sous `lg` avec un message "Vue desktop requise". Ne pas retirer ce guard — le canvas SVG/flow n'est pas responsive.

### I-8. `/admin/health` retourne 503 si `status !== "healthy"`
`GET /api/admin/health` répond 503 (et non 200) si le système est dégradé ou unhealthy. Les healthchecks externes (Vercel, uptime monitors) se basent sur ce code HTTP.

### I-9. `HEARST_DEV_AUTH_BYPASS` ne doit jamais être activé en prod
La variable d'environnement court-circuite le RBAC entier. S'assurer qu'elle n'est pas dans les env vars Vercel de production.

### I-10. Analytics tenants : `limit` clampé 1–50
`GET /api/admin/analytics/tenants` clamp `limit` entre 1 et 50. Ne pas supprimer ce clamp — une limite arbitrairement haute ferait une requête non-paginée sur toute la table.

## Tests

Existants : `__tests__/admin/` (à vérifier)

Manquants :
- `requireAdmin` retourne 403 si `checkPermission` retourne false
- Canvas : passer en live efface `selectedRunId`
- `metrics/live` : `errorRate` = 0 si aucun run failed
- `/api/admin/health` retourne 503 si un check échoue
