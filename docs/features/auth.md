# Auth & Session — `auth`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `auth` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-03 |
| **version spec** | 1.0 |
| **niveau** | **P0** — régression = app inaccessible pour tous les utilisateurs |

## Description

Système d'authentification et de session de Hearst OS. Trois providers côté NextAuth (Google, Azure AD, Dev Bypass), un flow OAuth secondaire Slack en PKCE pour les apps connectées, stockage chiffré AES-256-GCM des tokens externes en Supabase, résolution canonique du scope `{userId, tenantId, workspaceId}` pour isoler les données par API route, et hygiène automatique des tokens (expiry detection, auto-revoke après 5 échecs).

Strict post-migration `0026` : **aucun fallback email autorisé** comme identifiant — un userId est toujours un UUID résolu via `public.users`.

## Surface publique

### Pages
- [app/login/page.tsx](../../app/login/page.tsx) — page custom signIn (boutons Google, Azure AD, gestion erreur OAuthCallback, callbackUrl)

### Endpoints API
- `GET|POST /api/auth/[...nextauth]` ([route.ts](../../app/api/auth/[...nextauth]/route.ts)) — handler unique NextAuth
- `GET /api/auth/slack` ([route.ts](../../app/api/auth/slack/route.ts)) — initiation Slack OAuth (PKCE S256)
- `GET /api/auth/callback/slack` ([route.ts](../../app/api/auth/callback/slack/route.ts)) — callback Slack, échange code → token, save chiffré
- `GET /api/auth/dev-login` ([route.ts](../../app/api/auth/dev-login/route.ts)) — auto-login Electron (HTML+script). **403 si `HEARST_DEV_AUTH_BYPASS !== "1"`**

### Composants UI
- [use-oauth-expiry.ts](../../app/hooks/use-oauth-expiry.ts) — hook partagé qui fetch `/api/connections/expiring` (cache 60s) et dérive une `severity` (`error` / `warn` / `null`). Consommé par `TimelineRail` pour le badge dot sur l'item Apps. Pivot 2026-05-10 : remplace l'ancien `OAuthExpiryBanner` global qui mangeait 48 px en haut de chaque page.
- [use-oauth-completion-poll.ts](../../app/hooks/use-oauth-completion-poll.ts) — hook pour détecter fin OAuth Composio (popup polling 2.5s)

### Stores
- [stores/oauth.ts](../../stores/oauth.ts) — état du flow OAuth en cours (popup management, status `idle|opening|active|success|error|cancelled`)

### Helpers serveur (consommés par le reste de l'app)
- `requireScope({ context })` ([scope.ts](../../lib/platform/auth/scope.ts)) — résolution `CanonicalScope` avec dev fallback contrôlé, retourne 401 si non authentifié
- `getUserId()` ([get-user-id.ts](../../lib/platform/auth/get-user-id.ts)) — UUID strict, jamais email
- `getHearstSession() / requireAuth()` ([session.ts](../../lib/platform/auth/session.ts)) — wrappers `getServerSession`
- `saveTokens / getTokens / revokeToken / recordAuthFailure` ([tokens.ts](../../lib/platform/auth/tokens.ts)) — lifecycle tokens chiffrés

## Architecture interne

### Providers NextAuth

Configurés dans [options.ts](../../lib/platform/auth/options.ts) :

| Provider | ID | Activation | Scopes |
|----------|----|------------|--------|
| Google | `google` | `GOOGLE_CLIENT_ID/SECRET` | openid, email, profile, gmail.modify, gmail.send, calendar.events, drive.file (+ `access_type: "offline"`, `prompt: "consent"`) |
| Azure AD | `azure-ad` | `AZURE_AD_CLIENT_ID/SECRET` (tenant default `"common"`) | openid, email, profile, offline_access, Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, Files.ReadWrite |
| Dev Bypass | `dev-bypass` | `HEARST_DEV_AUTH_BYPASS === "1"` | N/A — retourne user hardcodé |

**User dev bypass** (hardcodé) :
```
{
  id:    "36914162-75f9-4c27-b38b-bb050f51d52b",
  name:  "Adrien (dev)",
  email: "adriennejkovic@gmail.com"
}
```

### Callbacks NextAuth

**`jwt({ token, account, profile, user })`** :
- Dev bypass → `token.userId = user.id`
- Google/Azure → `resolveOrCreateUserUuid(email)` → UPSERT `public.users(email)` → UUID
- Si résolution UUID échoue : `token.userId = undefined` (échec strict, pas de fallback email)
- `saveTokens(uuid, { accessToken, refreshToken, expiresAt }, providerName)`
- `registerProviderUsage({ provider, scope: { tenantId, workspaceId, userId } })`
- Expose `accessToken`, `refreshToken`, `expiresAt`, `userId`, `email` sur le token

**`session({ session, token })`** :
- `session.accessToken = token.accessToken`
- `session.userId = token.userId`
- `session.user.id = token.userId` (exposé au frontend pour useSession)

**Pages override** : `signIn: "/login"` (uniquement)

### Stockage tokens (Supabase `user_tokens`)

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | **uuid** post-migration `0026` (était `text`/email avant) |
| `provider` | text | `google`, `azure-ad`, `slack`, etc. |
| `access_token_enc` | text | AES-256-GCM `iv:tag:cipher` (hex-encoded) |
| `refresh_token_enc` | text | idem |
| `expires_at` | bigint | UNIX seconds |
| `last_used_at` | timestamptz | maj via `touchLastUsed()` |
| `auth_failure_count` | integer | max 5 puis auto-revoke |
| `revoked_at` | timestamptz | NULL = actif |
| `refresh_rotated_at` | timestamptz | rotation tous les 7j |
| `created_at`, `updated_at` | timestamptz | |

**Index** `(user_id, provider)` UNIQUE. **RLS** activée, `service_role` full access.

**Fallback in-memory** : si `NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` absents, tout va dans une `Map` éphémère (dev only).

### Chiffrement tokens

- Algo : `AES-256-GCM`
- IV : 16 bytes random par enregistrement
- Auth tag : vérifié au déchiffrement (intégrité)
- Format ciphertext : `iv_hex:authTag_hex:encrypted_hex`
- Clé : `TOKEN_ENCRYPTION_KEY` (64-char hex = 256 bits), via `EnvKeyProvider`
- `setKeyProvider()` exposé pour swap KMS sans modifier l'appel des consommateurs

**Constantes** :
- `MAX_AUTH_FAILURES = 5`
- `REFRESH_ROTATION_INTERVAL_MS = 7j`

### Scope canonique

[scope.ts](../../lib/platform/auth/scope.ts) garantit qu'aucune API route ne lit/écrit sans tenant + workspace résolus.

```ts
type CanonicalScope = { userId: string; tenantId: string; workspaceId: string; isDevFallback: boolean }
```

`requireScope({ context })` :
1. `getUserId()` → si null → `{ scope: null, error: { status: 401, message: "not_authenticated" } }`
2. Lit `HEARST_TENANT_ID` / `HEARST_WORKSPACE_ID` dans l'env
3. Si manquants et `requireTenant`/`requireWorkspace` non strict → fallback `"dev-tenant"` / `"dev-workspace"`, `isDevFallback = true`, log warn
4. Retour `{ scope, error: null }`

### Slack OAuth (PKCE)

Distinct du flow NextAuth. Stocke aussi via `saveTokens()` mais avec `provider="slack"` + `tenantId=teamId`.

- PKCE : `verifier = randomBytes(32).base64url`, `challenge = sha256(verifier).base64url`
- State payload base64url JSON : `{ v: verifier, u: userId, t: tenantId, w: workspaceId }`
- Scopes : `channels:read channels:history im:read im:history users:read groups:read groups:history mpim:read mpim:history`
- Callback : POST `slack.com/api/oauth.v2.access`, extract `authed_user.access_token` (préféré) ou `access_token` (bot)
- Redirect final : `/apps?slack=connected` ou `/apps?slack=error`

### OAuth refresh / hygiène

[oauth-refresh.ts](../../lib/connections/oauth-refresh.ts) gère la détection des tokens expirants côté Composio :

- `checkExpiringTokens({ userId, tenantId })` → `ExpiringConnection[]` (Zod-validated)
- Estimation expiry : `ACTIVE → updatedAt + 90j`, `EXPIRED/FAILED → 0j`
- Filtre : `daysLeft ∈ [1,7]` (expiring_soon) ou `≤ 0` (expired)
- `refreshOAuthToken()` : workaround SDK Composio v0.6 (pas de `refresh()` natif), retourne `{ ok, outcome: "refreshed" | "revoked" | "unavailable" }`
- `scheduleTokenRefresh()` : queue à venir (SDK v0.7)

**Constantes** : `AUTH_EXPIRING_DAYS_THRESHOLD = 7`, `AUTH_CRITICAL_DAYS_THRESHOLD = 3`, `TYPICAL_OAUTH_LIFETIME_DAYS = 90`

### Arcjet (sécurité globale)

[arcjet.ts](../../lib/security/arcjet.ts) expose `aj` configuré avec :

- `shield({ mode })` — DDoS shield
- `detectBot({ mode, allow: ["SEARCH_ENGINE", "MONITOR", "PREVIEW"] })`
- `tokenBucket({ refillRate: 60, interval: 60, capacity: 100 })` — 100 req/min/IP

**Mode** : `DRY_RUN` (dev, log only) ou `LIVE` (prod, blocking). `isArcjetEnabled()` retourne false si `ARCJET_KEY` absent (no-op total).

⚠ **Pas de `middleware.ts` racine** câblant Arcjet aux routes auth pour le moment — Arcjet est exporté mais doit être appelé manuellement par les routes consommatrices.

### Dépendances externes

- `next-auth@4.24.x` — config + callbacks
- `@arcjet/next@1.4.x` — rate limit / bot / shield
- `@supabase/supabase-js@2.x` — stockage tokens chiffrés + `public.users`
- `crypto` (Node.js) — AES-256-GCM
- `zod@4.x` — validation `ExpiringConnectionSchema`

### Dépendances internes

- [lib/platform/db/supabase.ts](../../lib/platform/db/supabase.ts) — singleton Supabase service role
- [lib/connectors/control-plane/register.ts](../../lib/connectors/control-plane/register.ts) — `registerProviderUsage()`
- [lib/connectors/composio/connections.ts](../../lib/connectors/composio/connections.ts) + [client.ts](../../lib/connectors/composio/client.ts) — `listConnections`, `isComposioConfigured`
- [lib/oauth/popup.ts](../../lib/oauth/popup.ts) — `PopupHandle` type pour le store oauth

## Data flow

### Login Google/Azure AD

```
[/login]
  ↓ signIn("google" | "azure-ad", { callbackUrl })
[Provider OAuth consent screen]
  ↓
[/api/auth/callback/<provider>]
  ↓ NextAuth jwt() callback
     ├─ resolveOrCreateUserUuid(email) → public.users UPSERT
     ├─ saveTokens(uuid, tokens, provider)  [AES-256-GCM → user_tokens]
     └─ registerProviderUsage({...})
  ↓ NextAuth session() callback
     └─ session.user.id = token.userId
[redirect callbackUrl]
```

### Slack OAuth (apps connectées)

```
[/apps] → "Connect Slack"
  ↓ GET /api/auth/slack (requireUserId — 401 si null)
     ├─ génère PKCE verifier+challenge
     └─ encode state = { v, u, t, w } (base64url)
[slack.com/oauth/v2/authorize]
  ↓
[GET /api/auth/callback/slack?code=...&state=...]
  ↓ POST slack.com/api/oauth.v2.access (code + verifier)
  ↓ saveTokens(userId, tokens, "slack", { tenantId: teamId })
[/apps?slack=connected | error]
```

### Scope resolution (toutes les API routes protégées)

```
[GET /api/<n>/<resource>]
  ↓ const { scope, error } = await requireScope({ context: "<route>" })
     ├─ getUserId() → UUID | null
     │   └─ null → return 401 "not_authenticated"
     └─ tenantId/workspaceId → env ou fallback dev
  ↓ utilise scope.userId / scope.tenantId / scope.workspaceId pour query
```

## Invariants verrouillés

Toute modification d'un point ci-dessous **exige une mise à jour de cette spec validée par Adrien**.

### I-1. Email comme identifiant — INTERDIT

`getUserId()` **doit** retourner un UUID issu de `public.users`, jamais un email. Aucun fallback email autorisé en lecture/écriture (post-migration `0026`).

Surveille : [get-user-id.ts](../../lib/platform/auth/get-user-id.ts), [user-resolver.ts](../../lib/platform/auth/user-resolver.ts), tous les `users.id` JOIN.

### I-2. Dev bypass — guard production obligatoire

[dev-login/route.ts](../../app/api/auth/dev-login/route.ts) **doit** retourner 403 si `HEARST_DEV_AUTH_BYPASS !== "1"`.

Le provider `dev-bypass` dans [options.ts](../../lib/platform/auth/options.ts) **doit** rester conditionné par le même flag (spread conditionnel).

UUID dev bypass **doit** rester `36914162-75f9-4c27-b38b-bb050f51d52b` tant que la row Supabase associée n'est pas migrée — sinon les rows existantes deviennent orphelines.

### I-3. Chiffrement tokens

- Algorithme : `AES-256-GCM` (jamais downgrade vers AES-CBC ou autre)
- Format ciphertext : `iv_hex:authTag_hex:encrypted_hex` — toute migration de format casse le déchiffrement de l'existant
- Auth tag vérifié au déchiffrement (intégrité requise)
- Clé via `KeyProvider` interface (l'`EnvKeyProvider` peut être remplacé par KMS sans toucher les consommateurs)

### I-4. Auto-revoke après échecs

`MAX_AUTH_FAILURES = 5` — au 5ème échec consécutif, `recordAuthFailure()` doit `revoked_at = now()`. Tout ajustement (palier, désactivation) = update spec.

### I-5. Scope canonique

`requireScope()` **doit** toujours retourner soit `{ scope, error: null }` soit `{ scope: null, error: { status: 401 } }` — pas d'autre forme.

Le dev fallback `"dev-tenant"` / `"dev-workspace"` est conservé tant que l'app n'a pas de vrai onboarding tenant/workspace, mais marque `isDevFallback: true` (visible dans `/api/v2/cockpit/today` et autres endpoints qui le propagent).

### I-6. Schéma Supabase `user_tokens`

- `user_id` reste de type `uuid` (post-migration `0026`)
- `UNIQUE(user_id, provider)` reste actif
- RLS activée, seul `service_role` peut lire/écrire (Hearst utilisateurs ne font jamais de SELECT direct sur cette table)
- Toute nouvelle colonne = OK ; rename ou drop = update spec

### I-7. Slack OAuth — PKCE S256 obligatoire

- Verifier 32 bytes random base64url
- Challenge = `sha256(verifier).base64url`
- `code_challenge_method: "S256"` (jamais `plain`)
- State payload = `{ v, u, t, w }` base64url JSON — schema figé

### I-8. JWT strategy

NextAuth en stratégie `jwt` (stateless, pas de DB session). Migration vers `database` strategy = update spec.

### I-9. Variables d'env critiques

Ces variables sont **mandatoires en prod** :

- `NEXTAUTH_SECRET` — toute rotation invalide toutes les sessions actives
- `TOKEN_ENCRYPTION_KEY` — toute rotation rend les tokens existants illisibles (besoin de migration scriptée)
- `GOOGLE_CLIENT_ID/SECRET` — au moins un provider OAuth doit exister
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — sinon `user_tokens` tombe en in-memory (perte au redémarrage)

### I-10. `registerProviderUsage()` au signIn

Au callback `jwt()` après login OAuth réussi, `registerProviderUsage({ provider, scope })` **doit** être appelé. C'est ce qui alimente le control-plane (preflight, capabilities, providers state).

## Évolutions autorisées sans spec

- Ajout d'un nouveau provider NextAuth (ex: GitHub, Microsoft personal) à condition que les callbacks `jwt`/`session` restent identiques (résolution UUID + saveTokens)
- Ajout d'un scope OAuth supplémentaire pour Google/Azure
- Ajout de colonnes à `user_tokens` (sans drop ni rename des existantes)
- Refactor interne de [tokens.ts](../../lib/platform/auth/tokens.ts) tant que les exports listés restent stables
- Ajout d'un nouveau test
- Polish UI sur `/login` ou sur le badge OAuth (TimelineRail item Apps)
- Branchement Arcjet sur de nouvelles routes
- Implémentation `scheduleTokenRefresh()` (queue Composio) quand SDK v0.7 dispo

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Fuite `HEARST_DEV_AUTH_BYPASS=1` en prod | Bypass total auth | Guard 403 dans dev-login + provider conditionnel ; mais env var leak = compromis |
| Rotation `TOKEN_ENCRYPTION_KEY` sans migration | Tous tokens illisibles | Aucune actuellement — runbook nécessaire |
| Rotation `NEXTAUTH_SECRET` | Toutes sessions invalidées (re-login forcé) | Acceptable, pas de mitigation |
| Supabase down | Login échoue (resolveOrCreateUserUuid) | Strict fail, pas de fallback — choix conscient |
| `public.users` table corrompue | Personne ne peut se logger | Aucune sauvegarde côté NextAuth — dépend de Supabase backups |
| Composio SDK v0.6 limitation refresh | Tokens externes ne se rafraîchissent pas vraiment | Workaround `checkStatus()`, attente SDK v0.7 |
| Arcjet non câblé en middleware | Pas de rate limit global sur routes auth | À câbler ; pour l'instant doit être appelé manuellement |
| Migration `0026` rollback | RLS UUID bloque les rows email legacy | Pas de path de rollback — migration one-way |
| `TOKEN_ENCRYPTION_KEY` < 64 chars hex | `createCipheriv` throw au démarrage | Validation à l'init recommandée (gap actuel) |

## Tests

### Existants
- [`__tests__/platform/auth/scope.test.ts`](../../__tests__/platform/auth/scope.test.ts) — `requireScope()` strict no-email-fallback
- [`__tests__/platform/auth/get-user-id.test.ts`](../../__tests__/platform/auth/get-user-id.test.ts) — dev bypass, session.user.id, session.userId legacy, null si non résolu
- [`__tests__/connections/oauth-refresh.test.ts`](../../__tests__/connections/oauth-refresh.test.ts) — `checkExpiringTokens` filtres, `refreshOAuthToken` outcomes, `scheduleTokenRefresh` delegation

### Manquants (gap)
- **E2E login Google/Azure AD** : aucun test e2e Playwright simulant un vrai flow OAuth provider
- **E2E Slack OAuth callback** : aucun test du callback `/api/auth/callback/slack` (state decode, token exchange, save)
- **Tokens encryption roundtrip** : aucun test sur [tokens.ts](../../lib/platform/auth/tokens.ts) `saveTokens` → `getTokens` (chiffrement / déchiffrement)
- **Auto-revoke 5 échecs** : aucun test que `recordAuthFailure()` flippe `revoked_at` à count=5
- **Refresh rotation 7j** : aucun test sur `refresh_rotated_at`
- **Dev bypass guard prod** : aucun test que `dev-login` retourne 403 si flag absent
- **Dev bypass UUID match** : aucun test que l'UUID de [options.ts](../../lib/platform/auth/options.ts) `dev-bypass` provider == celui de [get-user-id.ts](../../lib/platform/auth/get-user-id.ts) (drift silencieux possible)
- **`resolveOrCreateUserUuid` UPSERT** : aucun test de la résolution email → UUID (mocké Supabase)
- **`session()` callback exposure** : aucun test que `session.user.id`, `session.userId`, `session.accessToken` sont bien posés
- **Multi-tenant scope isolation** : aucun test qu'une route avec `tenantId=A` ne lit pas les données de `tenantId=B`
- **`useOAuthExpiry`** : aucun test hook (cache TTL 60s, severity dérivée, invalidate after reconnect)
- **`useOAuthCompletionPoll`** : aucun test hook (polling, popup close, success callback)
- **Arcjet rules** : aucun test que `tokenBucket(100/min)` bloque réellement la 101ème req
- **Arcjet bot detection** : aucun test que les User-Agents légitimes (Googlebot) passent
- **`registerProviderUsage` au signIn** : aucun test d'intégration vérifiant l'appel après jwt callback
- **`TOKEN_ENCRYPTION_KEY` validation** : aucun test que clé invalide (≠ 64 hex) throw clairement au boot

## Code orphelin (code-ready non câblé)

- **`middleware.ts` racine absent** — Arcjet est configuré mais aucun middleware Next.js global ne l'applique. Soit les routes individuelles l'appellent (à vérifier), soit le rate limit n'est pas réellement actif. Ce n'est pas un orphelin au sens strict, mais une intention non câblée.
- **`scheduleTokenRefresh()`** — fonction présente mais ne queue rien (attend SDK Composio v0.7). À garder en l'état tant que Composio n'expose pas `refresh()`.

## Notes & historique

- **Migration `0011`** (2025) — création table `user_tokens`
- **Migration `0012`** (2025) — colonnes sécurité (`auth_failure_count`, `revoked_at`, `last_used_at`, `refresh_rotated_at`)
- **Migration `0026`** (Phase 2, 2026) — UUID cleanup : 277 rows email legacy backfillées en UUID, `user_id` ALTER TYPE `uuid`, RLS UUID enforcement (12 tables au total). One-way, pas de rollback.
- **Phase 2 banished email fallback** — `getUserId()` retourne null strict si UUID non résolu, plus jamais d'email comme identifiant
- **SDK Composio v0.6.11** vs v0.8.1 dispo — limitations connues sur `refresh()` et `expiresAt`. Workarounds en place. Update SDK = update spec (changements de comportement attendus sur expiry detection)
- **Pas de middleware.ts** — Arcjet est exporté mais pas wired globalement. Décision en suspens (perf vs garanties)

## Variables d'environnement (référence rapide)

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `NEXTAUTH_SECRET` | ✅ | — | JWT signing |
| `NEXTAUTH_URL` | recommandé | `http://localhost:9000` | Base OAuth callbacks |
| `TOKEN_ENCRYPTION_KEY` | ✅ | — | 64-char hex (256 bits) |
| `GOOGLE_CLIENT_ID` | ✅ (au moins un provider) | — | |
| `GOOGLE_CLIENT_SECRET` | ✅ (idem) | — | |
| `AZURE_AD_CLIENT_ID` | optionnel | — | |
| `AZURE_AD_CLIENT_SECRET` | optionnel | — | |
| `AZURE_AD_TENANT_ID` | optionnel | `"common"` | |
| `SLACK_CLIENT_ID` | optionnel | — | Requis si flow Slack actif |
| `SLACK_CLIENT_SECRET` | optionnel | — | idem |
| `SLACK_REDIRECT_URI` | optionnel | computed depuis `NEXTAUTH_URL` | |
| `HEARST_DEV_AUTH_BYPASS` | optionnel | unset | `"1"` active dev bypass — **ne jamais set en prod** |
| `HEARST_TENANT_ID` | optionnel | `"dev-tenant"` | |
| `HEARST_WORKSPACE_ID` | optionnel | `"dev-workspace"` | |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | |
| `ARCJET_KEY` | optionnel | — | No-op si absent |
