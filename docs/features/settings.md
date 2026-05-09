# Settings — `settings`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `settings` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

Système de configuration en trois couches (system → tenant → user) stocké dans la table Supabase `system_settings`. Expose des feature flags, seuils, limites et préférences utilisateur via une API publique `/api/v2/settings/*`. L'alerting (canaux webhook/slack/email) est délégué à `lib/notifications/` — voir `docs/features/notifications.md`.

## Surface publique

**Endpoints API**
- `GET /api/v2/settings/flags` — liste les feature flags de la catégorie `feature_flags` pour le scope courant (tenant-aware)
- `POST /api/v2/settings/flags` — active/désactive un flag (body: `{ key, enabled }`)
- `GET /api/v2/settings/preferences` — retourne `{ theme, locale, notifications }` de l'utilisateur courant
- `POST /api/v2/settings/preferences` — met à jour une clé de préférence utilisateur
- `GET /api/settings/alerting` — charge les préférences alerting du tenant
- `PUT /api/settings/alerting` — sauvegarde (validé par `alertingPreferencesSchema` Zod)
- `POST /api/settings/alerting/test` — envoie un signal de test sur `webhook | slack | email`

**Bibliothèque serveur**
- `lib/platform/settings/index.ts` — point d'entrée public (re-exports system + user + tenant)
- `lib/platform/settings/store.ts` — CRUD Supabase (`getSetting`, `setSetting`, `getAllSettings`)
- `lib/platform/settings/system.ts` — `getFeatureFlag`, `setFeatureFlag`, `getThreshold`, `getLimit`, `seedDefaults`
- `lib/platform/settings/user.ts` — `getUserPreference`, `setUserPreference`, `getUserLocale`, `getUserNotificationPrefs`
- `lib/platform/settings/tenant.ts` — `getTenantSetting`, `setTenantSetting`, `getTenantFeatureFlag`, `getTenantLimit`, `resetTenantSettings`

**Composant UI**
- `app/(user)/settings/alerting/page.tsx` → `<AlertingSettings />`

## Types clés

```ts
type SettingCategory = "feature_flags" | "thresholds" | "limits" | "integrations" | "ui" | "analytics";
type SettingValue = string | number | boolean | object;

interface SystemSetting {
  id: string;
  key: string;
  value: SettingValue;
  category: SettingCategory;
  isEncrypted: boolean;
  tenantId: string | null; // null = global default
  updatedAt: number;
  updatedBy?: string;
}

// Clés de préférence utilisateur (composite key: "user:{userId}:{key}")
// theme: string (défaut "dark")
// locale: string (défaut "fr")
// notifications: { email: boolean; push: boolean; slack: boolean }
```

## Invariants verrouillés

### I-1. Hiérarchie system < tenant < user
`getSetting(db, key, tenantId)` tente d'abord `tenant_id = tenantId`, puis fall-back sur `tenant_id IS NULL` (global). Ne jamais inverser cet ordre — un setting tenant doit toujours primer sur le global.

### I-2. Cache 60 s en mémoire côté serveur
`getSettingValue` maintient un `Map<cacheKey, {value, expiresAt}>` avec TTL 60 000 ms. Après tout `setSettingValue` la clé est invalidée (`cache.delete`). Ne jamais lire directement `store.getSetting` sans passer par `getSettingValue` si les performances importent.

### I-3. Clé composite user: `"user:{userId}:{key}"`
Les préférences utilisateur sont stockées dans `system_settings` avec une clé préfixée `user:{userId}:{key}` et `tenant_id = null`. Modifier ce format casse la lecture de toutes les préférences existantes en base.

### I-4. upsert sur conflit `(key, tenant_id)`
`setSetting` fait un `upsert` avec `onConflict: "key,tenant_id"`. L'index unique Supabase sur ces deux colonnes doit rester intact — toute migration qui le supprime ou le renomme casse les écritures.

### I-5. Valeurs sérialisées en JSON string
La colonne `value` est stockée en `TEXT` (JSON.stringify). `parseValue` tente `JSON.parse` et fall-back sur la chaîne brute. Changer le format de sérialisation sans migration casse les valeurs existantes (notamment les booléens et objets).

### I-6. `seedDefaults` est idempotent
`seedDefaults` vérifie si la valeur existe avant d'écrire. Ne doit pas écraser des valeurs modifiées en production. Ne jamais appeler `setSetting` directement depuis seed sans cette vérification.

### I-7. Feature flags : lecture tenant-aware
`getFeatureFlag(db, key, tenantId?)` passe `tenantId` pour que la couche store applique l'override tenant. Appeler `getFeatureFlag` sans `tenantId` retourne le flag global — intentionnel seulement pour les opérations système sans contexte tenant.

### I-8. Alerting délégué à `lib/notifications/`
La route `settings/alerting` ne contient aucune logique de dispatching — elle délègue à `loadAlertingPreferences` / `saveAlertingPreferences` / `alertingPreferencesSchema`. Ne pas inliner de logique de dispatching dans cette route.

### I-9. Validation Zod obligatoire sur PUT/POST
Tout endpoint d'écriture valide le body via Zod avant d'appeler la couche store. Supprimer la validation Zod casse la garantie de type à l'écriture.

## Tests

Existants : `__tests__/settings/` (à vérifier)

Manquants :
- Override tenant prime sur global (test d'intégration store)
- Cache invalidation après `setSettingValue`
- `seedDefaults` idempotence (2e appel ne modifie pas les valeurs existantes)
- Validation Zod sur `PUT /api/settings/alerting` avec body invalide → 422
