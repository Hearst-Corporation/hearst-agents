# Notifications — `notifications`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `notifications` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 — throttle flood + canaux best-effort |

## Description

Gère les notifications in-app et les alertes multi-canaux (webhook, Slack, email) déclenchées par les signaux business critiques/warning du pipeline reports. Transport Supabase Realtime avec fallback polling 60s. Throttle 4h par signal-type/tenant pour éviter le flood.

## Surface publique

- `GET /api/notifications` — liste notifications (params : `unreadOnly`, `limit`)
- `POST /api/notifications/read` — marque lue
- `POST /api/notifications/read-all` — marque tout lu
- `GET/POST /api/settings/alerting` — préférences alerting (webhooks, email, Slack)
- `POST /api/settings/alerting/test` — test envoi canal

Stores : `useNotificationsStore` (fetch, markRead, markAllRead, startRealtime, startPolling déprecié)

## Types clés

```ts
interface AppNotification {
  id, tenant_id: string;
  user_id: string | null;  // null = broadcast tenant
  kind: "signal" | "report_ready" | "export_done" | "share_viewed";
  severity: "info" | "warning" | "critical";
  title, body?: string;
  meta: Record<string, unknown> | null;  // signal_type, report_id, block_id, etc.
  read_at: string | null;
  created_at: string;
}

interface AlertWebhookPayload {
  v: 1;  // figé
  emittedAt, tenantId: string;
  report: { id, title };
  signal: { type, severity, message, blockId? };
}

interface ThrottleStore {
  getLast(key: string): number | null;
  markEmitted(key: string, now: number): void;
}
```

Table `in_app_notifications` : indexes (tenant_id, read_at, created_at DESC).

## Invariants verrouillés

### I-1. Throttle window = 4h, clé `${tenantId}:${signalType}`
`ALERT_THROTTLE_MS = 4 * 3600 * 1000`. Clé figée. Modifier = flood potentiel.

### I-2. Severity floor default = "critical" avant dispatch
Filtre appliqué **avant** throttle check. Floor séparé par channel possible.

### I-3. Canaux best-effort via `Promise.allSettled()`
Un canal qui échoue ne bloque pas les autres. Jamais `Promise.all()`.

### I-4. Signature HMAC absent si aucun secret configuré
Header `X-Hearst-Signature: sha256=<hex>` seulement si `webhook.secret` est présent.

### I-5. In-app auto-créé pour severity warning|critical
`createNotification()` appelé systématiquement. Jamais optionnel.

### I-6. Realtime Supabase avec fallback polling 60s
Sur `CHANNEL_ERROR` ou `TIMED_OUT` → switch auto polling 60s. Cleanup sur `SUBSCRIBED`.

### I-7. Email sender injectable, stub log par défaut
`setEmailSender(fn)`. Stub ne throw jamais. Migration Resend = update spec.

### I-8. Préférences via `getTenantSetting(category="integrations", key="alerting.preferences")`
Scope tenant. Structure `alertingPreferencesSchema` (Zod).

### I-9. `meta` JSON flexible (non typé strictement)
Contient `signal_type`, `report_id`, `block_id` (optionnel). Schema ouvert.

### I-10. `user_id null` = broadcast tenant entier
Row sans `user_id` → visible par tous les membres du tenant.

## Tests

Existants : `schema.test.ts`, `alert-dispatcher.test.ts`, `in-app.test.ts`, `notifications-store.test.ts`, `dispatcher-integration.test.ts`

Manquants : Realtime fallback polling, HMAC header présence/absence, throttle multi-tenant isolation.
