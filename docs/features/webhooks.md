# Webhooks Outbound — `webhooks`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `webhooks` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 — retry policy + fire-and-forget |

## Description

Webhooks custom déclenchés par événements produit. HMAC-SHA256 signing si secret configuré. Retry 2× sur 5xx/réseau, timeout 5s, fire-and-forget. 10 événements supportés.

## Surface publique

- `GET/POST /api/webhooks` — list + create
- `GET/PATCH/DELETE /api/webhooks/[id]` — CRUD
- `POST /api/webhooks/[id]/test` — test dispatch (event `test.ping`)

## Types clés

```ts
const WEBHOOK_EVENTS = [
  "report.generated", "report.exported", "report.shared",
  "mission.completed", "mission.failed", "signal.triggered",
  "asset.created", "asset.deleted", "comment.added", "auth.token_expiring",
] as const;

interface CustomWebhook {
  id, tenantId, name, url: string;
  secret?: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt, lastTriggeredAt?: string;
  lastStatus?: "success" | "failed";
}

interface WebhookPayload {
  v: 1;         // version figée
  emittedAt: number;
  tenantId, event: string;
  data: Record<string, unknown>;
}
```

Table `custom_webhooks` : indexes (tenant_id, active).

## Invariants verrouillés

### I-1. URL HTTPS obligatoire (sauf test NODE_ENV)
Zod `.refine(u => u.startsWith("https://"))`.

### I-2. `events` array min 1
Webhook sans événements = invalide Zod.

### I-3. HMAC-SHA256 si secret — header `X-Hearst-Signature: sha256=<hex>`
Absent si aucun secret. Jamais d'autre algorithme.

### I-4. HTTP timeout 5s strict via `AbortController`

### I-5. Retry : 1 initial + 2 retries sur 5xx/réseau — jamais sur 4xx

### I-6. Backoff constant 500ms entre retries (pas exponentiel)

### I-7. `dispatchWebhookEvent()` fire-and-forget — jamais throw, jamais await au caller

### I-8. `updateWebhookStatus()` best-effort — ne bloque pas le dispatch

### I-9. Test endpoint utilise event `test.ping` (distinct des vrais événements)

### I-10. Tenant isolation sur CRUD — update/delete vérifient tenantId owner

## Tests

Existants : `webhooks/store.test.ts`, `webhooks/dispatcher.test.ts`, `webhooks/events.test.ts`

Manquants : retry sur 5xx (2 retries), no-retry sur 4xx, HMAC header, timeout AbortController, fire-and-forget ne propage pas.
