# Connections — `connections`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `connections` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P1** — write-guard est la **seule** protection contre actions destructives via IA. Régression = email mass-send, suppression bulk, leak cross-tenant |

## Description

Hub d'intégrations tierces de Hearst OS. Couvre :
- **Composio SDK** (~1500 actions, ~250 providers) avec OAuth, slug-aliasing pour hallucinations LLM, discovery cache
- **Google natif** (Gmail, Calendar, Drive) via `googleapis` + tokens NextAuth SSO (chemin alternatif sans OAuth additionnel)
- **Control-plane** : preflight checks, capabilities provider, registry connection records tenant-scoped
- **Write-guard** : pattern two-step `_preview: true` → user confirm → `_preview: false` qui sécurise toute action écriture passant par Composio
- **Preview formatters** : 25 actions top-10 avec rendu UX dédié (Gmail, Slack, Notion, Linear, Calendar, HubSpot, etc.) + fallback générique
- **Integrations** (legacy parallèle) : adapter pattern + executor Phase 1 read-only-only enforcement

Le **write-guard** ([lib/connectors/composio/write-guard.ts](../../lib/connectors/composio/write-guard.ts)) est l'invariant le plus critique : sans lui, un agent IA pourrait exécuter directement des actions destructives sans confirmation utilisateur (mass email, bulk delete, etc.).

## Surface publique

### Composants UI
- [ConnectionsHub.tsx](../../app/(user)/components/ConnectionsHub.tsx) — drawer + catalogue 1870 lignes : search, sections connectés/suggestions/wallpaper, drawer app-details, OAuth popup flow

### Stores
- [stores/services.ts](../../stores/services.ts) — Zustand `services` + `loaded` (consumed by TopBar, RightPanel, etc.)

### Endpoints API

| Méthode + Route | Auth | Rôle |
|-----------------|------|------|
| `POST /api/composio/connect` | `requireScope` | OAuth init `{ appName, redirectUri? }` → `{ redirectUrl?, connectionId? }` |
| `GET /api/composio/connections` | `requireScope` | List ConnectedAccount[] de l'utilisateur |
| `DELETE /api/composio/connections/[id]` | `requireScope` | Disconnect + `unregisterInboxRepeatable()` best-effort |
| `GET /api/composio/apps` | `requireScope` | List apps Composio (cache 30 min) |
| `GET /api/composio/app-actions?app=<slug>` | `requireScope` | Discovery actions disponibles AVANT connexion (cache 5 min) |
| `GET /api/composio/diagnose?app=<slug>` | `requireScope` | Debug "pourquoi connect rate ?" |
| `POST /api/composio/invalidate-cache` | `requireScope` | Wipe discovery cache 60s post-OAuth |
| `GET /api/connections/expiring` | `requireScope` | Tokens expirants (cf [auth.md](auth.md)) |
| `GET /api/connections/native` | `requireScope` | Native SSO connections (Google, Microsoft) |
| `GET /api/integrations` | `requireScope` | List integration_connections (legacy) |
| `POST /api/integrations/[id]/execute` | `requireScope` + RunTracer | Execute integration action (read-only Phase 1) |
| `GET /api/integrations/[id]/health` | `requireScope` | Health check connector |

### Types & exports publics (`lib/connectors/composio/`)

```ts
// client.ts
isComposioConfigured(): boolean
getComposio(): Promise<ComposioClient | null>
resetComposioClient(): void
executeComposioAction(call: ComposioCallParams): Promise<ComposioResult>

// connections.ts
listConnections(userId, opts?): Promise<ConnectedAccount[]>
initiateConnection(userId, appName, redirectUri?): Promise<InitiateConnectionResult>
disconnectAccount(userId, connectionId): Promise<{ ok, error? }>

// discovery.ts
getToolsForUser(userId, opts?): Promise<DiscoveredTool[]>
getToolsForApp(userId, app): Promise<DiscoveredTool[]>
toAnthropicTools(tools): AnthropicTool[]
toOpenAITools(tools): OpenAITool[]
invalidateUserDiscovery(userId): void

// write-guard.ts
isWriteAction(toolName): boolean
formatActionPreview(toolName, args): string
filterToolsByDomain(tools, domain): DiscoveredTool[]

// to-ai-tools.ts
toAiTools(tools, userId): AiToolMap

// preview-formatters/index.ts
getFormatterForAction(actionName): PreviewFormatter | null
```

## Architecture interne

### Write-guard (cœur sécurité)

[lib/connectors/composio/write-guard.ts](../../lib/connectors/composio/write-guard.ts)

#### Détection d'action écriture

```ts
const WRITE_SEGMENTS = [
  "_SEND_", "_CREATE_", "_DELETE_", "_UPDATE_", "_REPLY_",
  "_ARCHIVE_", "_MOVE_", "_POST_", "_PUBLISH_", "_REMOVE_",
  "_WRITE_", "_PATCH_", "_PUT_", "_SUBMIT_", "_FORWARD_",
  "_MARK_", "_UNSUBSCRIBE_", "_INVITE_", "_ASSIGN_",
] as const;

const WRITE_PREFIXES = [
  "SEND_", "CREATE_", "DELETE_", "UPDATE_", "POST_", "PUBLISH_",
] as const;

isWriteAction(toolName): boolean
  // caseless match WRITE_SEGMENTS (includes) OR WRITE_PREFIXES (startsWith)
```

#### Pattern two-step (preview → confirm)

[to-ai-tools.ts](../../lib/connectors/composio/to-ai-tools.ts) injecte `_preview: { type: "boolean", default: true }` dans le schema de toute write action. L'execute handler fait :

```ts
if (write) {
  const isPreview = args._preview !== false;
  const { _preview: _p, ...composioArgs } = args;  // strip internal
  if (isPreview) {
    const customFormatter = getFormatterForAction(t.name);
    return customFormatter ? customFormatter(composioArgs) : formatActionPreview(t.name, composioArgs);
  }
  return executeComposioAction({ action: t.name, entityId: userId, params: composioArgs });
}
// Read-only : execute direct (gate ignoré)
return executeComposioAction({ action: t.name, entityId: userId, params: args });
```

**Flow utilisateur** :
1. Agent appelle write tool (par défaut `_preview: true`) → retourne string draft formatée
2. UI affiche draft + "Réponds **confirmer** pour exécuter, ou **annuler** pour abandonner"
3. User dit "confirmer" → agent re-call avec `_preview: false` → exécution réelle Composio

**Pas de seuils bulk.** Détection par nom de tool uniquement. **Aucune whitelist d'auto-approbation** — tout write action exige confirmation explicite.

#### Domain allowlist + cap 40 tools

```ts
const DOMAIN_APP_ALLOWLIST: Record<string, string[]> = {
  communication: ["gmail", "slack", "outlook", "teams", "whatsapp", "telegram", "discord"],
  productivity:  ["googlecalendar", "google_calendar", "notion", "todoist", "asana", "trello", "airtable"],
  finance:       ["stripe", "quickbooks", "hubspot", "chargebee", "braintree"],
  developer:     ["github", "jira", "linear", "gitlab", "bitbucket", "sentry"],
  crm:           ["hubspot", "salesforce", "pipedrive", "close"],
  design:        ["figma"],
}
```

`filterToolsByDomain(tools, domain)` :
- Domaines `general` ou `research` ou inconnu → no-restriction
- Sinon → filtre par allowlist app
- **Cap global 40 tools max** (anti token budget explosion dans le prompt agent)

### Composio client (`client.ts`)

- `isComposioConfigured()` → `Boolean(process.env.COMPOSIO_API_KEY)`
- `getComposio()` lazy dynamic import `@composio/core` (peer dep). Cache `cachedClient` + `initFailed` (cache failures pour éviter retry boucle)
- `resetComposioClient()` exposé pour tests + after env reload

#### `executeComposioAction(call)` — never throws

Toujours retourne envelope :
```ts
{ ok: boolean, data?: unknown, error?: string, errorCode?: ComposioErrorCode }
```

`ComposioErrorCode` = `"NOT_CONFIGURED" | "SDK_NOT_INSTALLED" | "AUTH_REQUIRED" | "ACTION_FAILED" | "UNKNOWN_SLUG" | "UNKNOWN"`

#### Slug aliases (hallucinations LLM)

```ts
const SLUG_ALIASES: Record<string, string> = {
  GMAIL_GET_EMAILS: "GMAIL_FETCH_EMAILS",
  GMAIL_LIST_EMAILS: "GMAIL_FETCH_EMAILS",
  HUBSPOT_LIST_DEALS: "HUBSPOT_GET_ALL_DEALS",
  // ... extensible
};
```

Résolution + log warn `[Composio] Slug alias: ${call.action} → ${resolvedAction}`. Vu en prod dans les logs.

### Discovery (`discovery.ts`)

- `getToolsForUser(userId, opts?)` :
  - Source de vérité : `listConnections()` filtré ACTIVE
  - Fetch tools per toolkit en parallèle (25 tools/toolkit)
  - Cache key : `${userId}::${apps.sort().join(",")}`
  - **TTL 60s** (`TTL_MS = 60_000`)
  - **Don't cache empty results** (user mid-OAuth flow)
- `getToolsForApp(userId, app)` (catalogue editorial pré-connexion) :
  - Cache séparé `appCache`, **TTL 5 min**
  - Pas de filtre ACTIVE (montre actions disponibles avant connexion)

### Connections (`connections.ts`)

- `listConnections(userId, opts)` :
  - `userIds: [userId]` server-scoped
  - Default `statuses = ["ACTIVE", "INITIATED", "EXPIRED", "FAILED"]`
  - `includeInactive: true` override
  - **Pas de cache client-side** (cache vit dans discovery)
- `initiateConnection(userId, appName, redirectUri?)` → `composio.toolkits.authorize()` → `{ id, redirectUrl? }` + `invalidateUserDiscovery(userId)`
- Error mapping :
  - `"auth config not found"` → `NO_INTEGRATION`
  - `"missing scope"` → `AUTH_CONFIG_REQUIRED`
  - `"401|403|API key"` → `NOT_CONFIGURED`
  - défaut → `UPSTREAM_ERROR`

### Preview formatters (`preview-formatters/`)

Interface commune :
```ts
type PreviewFormatter = (args: Record<string, unknown>) => string
```

25 actions top-10 enregistrées (multiples alias canoniques par action — Composio change les noms parfois) :
- gmail (send, reply), slack (send_message), notion, linear, googlecalendar, hubspot, stripe, asana, trello, airtable, whatsapp

Helpers communs (`shared.ts`) :
```ts
header(app, action), line(label, value), footer(),
preview(text, max = 200), asArray(v), formatDateFR(value)
```

Format de sortie (exemple Slack) :
```
📋 Draft · SLACK · Envoyer

**Canal** : #dev
**Aperçu** : hello…

↩ Réponds **confirmer** pour exécuter, ou **annuler** pour abandonner.
```

Matching dans `getFormatterForAction()` :
1. Exact key match
2. Fragment match (même app + 2+ segments verbe/objet en commun)
3. Sinon `null` → fallback `formatActionPreview` générique

### Control-plane (`control-plane/`)

#### `ConnectorConnection` (registry record)

```ts
interface ConnectorConnection {
  id, provider, tenantId, workspaceId: string;
  userId?: string;
  capabilities: ConnectorCapability[];
  status: "connected" | "disconnected" | "degraded" | "error" | "pending_auth";
  displayName: string;
  connectionKey?: string;
  externalAccountId?: string;
  createdAt, updatedAt: number;
  lastCheckedAt?, lastError?: string;
}
```

#### Store (`store.ts`)

- Table : `integration_connections` + JSONB `config` pour scope tenant
- Memory fallback : `Map<key, ConnectorConnection>` (fastest path)
- Write : `upsertConnection()` → DB + memory
- Read : `getConnectionsByScope()`, `getConnectionByProvider()`

#### Preflight (`preflight.ts`)

```ts
preflightConnector(input: { provider, scope, userId? })
  → { ok, provider, status: ConnectorStatus, reason? }
```

Délègue à `isProviderConnected()` (unified reconciler) pour fusion truth auth + control-plane.

#### Capabilities (`provider-capabilities.ts`)

`getProviderCapabilities(provider)` → `ConnectorCapability[]`. Délègue à `lib/providers/registry.ts` (canonical).

#### Register (`register.ts`)

`registerProviderUsage({ provider, scope })` — appelé au login OAuth (cf [auth.md I-10](auth.md)) et après `executeComposioAction` réussi → upsert connection record `status: "connected"`.

### Unified reconciliation (`unified/reconcile.ts`)

Fusion `user_tokens` (V1) + control-plane (V2) :
- **Auth truth wins** : si `user_tokens` dit connected, on retourne connected même si CP record absent
- **Auto-heal** : CP record manquant + auth connected → crée CP record automatiquement

### Google native vs Composio

| Aspect | Native | Composio |
|--------|--------|----------|
| Auth | NextAuth SSO scopes (`gmail.send`, `calendar.events`, `drive.file`) | OAuth Composio par-dessus |
| SDK | `googleapis` | `@composio/core` (peer dep dynamic) |
| Tokens | `user_tokens` table (cf [auth.md](auth.md)) | Composio cloud |
| Refresh | `getGoogleAuth(userId)` (auto-refresh + failure tracking) | Composio gère |
| Conflict | Composio sur Google = 401 access_denied si SSO actif | — |
| UI dedup | ConnectionsHub merge + Composio wins (override) | — |

### Integrations (legacy parallèle)

Status : Phase 1 = read-only strict.

- `IntegrationAdapter` interface : `execute(opts) | healthCheck()`
- `executeIntegration(sb, opts)` :
  - Fetch connection
  - **Throw `RuntimeError("TOOL_RISK_NOT_ACCEPTED")` si `!actionDef.readonly`**
  - Retry max 1
  - RunTracer pour observability
  - Health tracking : `healthy | degraded | down`

### Variables d'env critiques

| Var | Required | Notes |
|-----|----------|-------|
| `COMPOSIO_API_KEY` | ✅ | SDK init. Sinon `isComposioConfigured() = false` → no tools |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | ✅ | Native SSO + OAuth refresh |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ✅ | DB store control-plane |
| `HEARST_TENANT_ID` + `HEARST_WORKSPACE_ID` | optionnels | Fallback dev mono-tenant |

## Data flow

### Write action via agent IA (cas critique)

```
[LLM décide d'envoyer email Gmail]
   ↓ tool call : GMAIL_SEND_EMAIL { to, subject, body }
   ↓ ai-pipeline tool execute (Vercel AI SDK)
[to-ai-tools.execute]
   ├─ isWriteAction("GMAIL_SEND_EMAIL") → true
   ├─ args._preview !== false → true (default = preview)
   ├─ getFormatterForAction("GMAIL_SEND_EMAIL") → formatGmailSendEmail
   └─ retourne string draft "📋 Draft · GMAIL · Envoyer\n**À** : x@y.com..."
[Agent répond au user avec la draft + "Réponds **confirmer**"]
   ↓
[User : "confirmer"]
   ↓
[LLM re-call : GMAIL_SEND_EMAIL { to, subject, body, _preview: false }]
[to-ai-tools.execute]
   ├─ isPreview = false
   ├─ strip _preview de args
   └─ executeComposioAction({ action: "GMAIL_SEND_EMAIL", entityId: userId, params })
       ↓ SDK Composio
       ↓ Gmail API
       ↓ retour { ok, data } ou { ok: false, errorCode: "AUTH_REQUIRED", error }
[LLM stream "✓ Email envoyé à x@y.com"]
```

### Discovery (au start de chaque chat)

```
[ai-pipeline.runAiPipeline début]
   ↓ getToolsForUser(userId)
[discovery.ts]
   ├─ check cache `${userId}::*` TTL 60s
   ├─ si miss : listConnections(userId) → ACTIVE toolkits
   ├─ pour chaque toolkit en parallèle : composio.tools.list({ toolkit, limit: 25 })
   ├─ map → DiscoveredTool[]
   └─ cache 60s (sauf si empty)
   ↓
[ai-pipeline]
   ├─ filterToolsByDomain(tools, domain) → cap 40
   └─ toAiTools(filtered, userId) → injecte _preview en write tools
```

### OAuth flow Composio

```
[User click "Connect Slack" dans ConnectionsHub]
   ↓ openOAuthPopup() IMMÉDIAT (anti popup-blocker browser)
   ↓ POST /api/composio/connect { appName: "slack" }
[Server : requireScope + initiateConnection(userId, "slack")]
   ↓ composio.toolkits.authorize → { id, redirectUrl }
   ↓ retour client
[Popup.location = redirectUrl]
   ↓ Composio OAuth UI
   ↓ user authorize
   ↓ Composio redirect popup → ?connected=slug
   ↓ popup postMessage à parent
[ConnectionsHub refreshAccounts()]
   ↓ listConnections() + invalidateUserDiscovery
   ↓ popup.close()
```

## Invariants verrouillés

Toute modification d'un point ci-dessous **exige une mise à jour de cette spec validée par Adrien**.

### I-1. Write-guard pattern two-step OBLIGATOIRE

Toute write action via Composio passe par `_preview: true` (default) → user confirm → `_preview: false`. **Aucun bypass admis.**

Bypass = exécution directe d'actions destructives par l'IA = bug critique (mass send, bulk delete, leak cross-tenant).

L'injection `_preview` se fait dans `toAiTools()` ([to-ai-tools.ts](../../lib/connectors/composio/to-ai-tools.ts)). Tout call qui contournerait `toAiTools` (par ex direct `executeComposioAction` depuis l'orchestrator pour une write action) = update spec.

### I-2. `WRITE_SEGMENTS` + `WRITE_PREFIXES` figés (extensibles)

Les 19 segments + 6 prefixes actuels sont l'allow-list **de détection write**. Tout retrait d'un segment = update spec (le nouveau write deviendrait silencieusement read et bypasserait le gate).

Ajouter un segment/prefixe = OK, mais doit être testé.

### I-3. Aucune whitelist d'auto-approbation

**Toute** write action exige confirmation utilisateur. Pas d'exception (même pour les actions "safe-looking"). Pas de seuil bulk.

Si tu veux un mode "trusted action" auto-approuvé : update spec + plan d'audit.

### I-4. `executeComposioAction` never throws

Retourne **toujours** `{ ok, data?, error?, errorCode? }`. `ComposioErrorCode` = `"NOT_CONFIGURED" | "SDK_NOT_INSTALLED" | "AUTH_REQUIRED" | "ACTION_FAILED" | "UNKNOWN_SLUG" | "UNKNOWN"`.

Migration vers throw = update spec + sync tous les callers (orchestrator, voice, missions, etc.).

### I-5. SDK Composio chargé en lazy dynamic import

`@composio/core` est peer dep, **dynamic import** dans `getComposio()`. Si non installé : `initFailed = { code: "SDK_NOT_INSTALLED" }` → `executeComposioAction` retourne erreur explicite.

Migration vers static import = update spec (impacte tree-shaking et déploiements sans Composio).

### I-6. `isComposioConfigured()` = présence de `COMPOSIO_API_KEY`

Pas d'autre source de configuration. Sans cette var, **tous les tools Composio sont désactivés** silencieusement.

### I-7. Slug aliases LLM hallucinations

`SLUG_ALIASES` est extensible. Logge un warn `[Composio] Slug alias: X → Y` à chaque résolution.

Toute migration vers une autre stratégie (LLM auto-correction, fuzzy match, etc.) = update spec.

### I-8. Discovery cache 60s, **don't cache empty**

TTL `TTL_MS = 60_000` (1 minute). Cache key `${userId}::${apps.sort().join(",")}`.

**Empty results NON cachés** — sinon user mid-OAuth verrait la liste vide pendant 60s après confirmation.

`getToolsForApp` (catalogue éditorial pré-connexion) : cache séparé, TTL 5 min, pas de filtre ACTIVE.

### I-9. Discovery limit 25 tools/toolkit

Limite Composio API par toolkit. Empêcher l'explosion en cas d'app avec 100+ tools. Pas de limit global tronquant (la troncature finale = `filterToolsByDomain` cap 40).

### I-10. Domain allowlist + cap 40 tools

`filterToolsByDomain(tools, domain)` réduit le pool de tools envoyés au prompt LLM :
- Domaines `general` et `research` → no restriction
- Autres domaines → allowlist par app
- **Cap global 40** (anti token budget explosion)

Modifier les listes par domaine = update spec.

### I-11. ConnectorConnection schema + statuts figés

Statuts : `connected | disconnected | degraded | error | pending_auth`. Migration vers d'autres statuts = update spec.

### I-12. Unified reconciliation : auth truth > control-plane

Si auth (`user_tokens`) dit connected mais CP record absent → on considère **connected** + auto-heal CP.

Inversion = update spec (peut bloquer des connections valides).

### I-13. Preview formatters interface figée

```ts
type PreviewFormatter = (args: Record<string, unknown>) => string
```

Synchrone, retourne string, pas d'async, pas de side-effect.

Migration vers async / streaming preview = update spec + sync `to-ai-tools` execute.

### I-14. Footer preview obligatoire

Toute preview formatter (custom ou générique) **doit** se terminer par :
```
↩ Réponds **confirmer** pour exécuter, ou **annuler** pour abandonner.
```

C'est ce qui déclenche le pattern "confirmer" (cf [chat.md](chat.md) ConfirmActionChips).

### I-15. Integrations Phase 1 = read-only strict

`executeIntegration` throw `RuntimeError("TOOL_RISK_NOT_ACCEPTED")` si `!actionDef.readonly`. Pas de write via cette voie tant que la spec n'est pas updatée.

(Composio reste le canal pour les writes, avec son propre write-guard).

### I-16. Native vs Composio dedup, Composio gagne en UI

Dans `ConnectionsHub.refreshAccounts()`, fusion Composio + native ; pour les apps Google/Microsoft : dedup par slug, **Composio override le native** dans la liste affichée.

Si tu veux inverser (native gagne) = update spec. Le LLM utilisera les tools du backend qui répond, ce n'est pas affecté.

### I-17. OAuth popup `window.open()` IMMÉDIAT au click

L'appel à `window.open()` doit se faire dans le **handler synchrone** du click (sinon Chrome/Safari bloquent le popup).

Toute migration vers async/await avant `window.open()` = popup bloquée.

### I-18. `invalidateUserDiscovery` après OAuth + après disconnect

Sans invalidation, le cache 60s renvoie l'ancienne liste pendant 1 min après changement. Toute écriture côté connections (`initiateConnection`, `disconnectAccount`) **doit** invalider.

## Évolutions autorisées sans spec

- Ajouter un slug alias dans `SLUG_ALIASES` (LLM hallucinations)
- Ajouter un preview formatter pour un nouveau service (ajouter dans le registry + créer fichier)
- Ajouter une app dans `DOMAIN_APP_ALLOWLIST`
- Ajouter un nouveau code d'erreur dans `ComposioErrorCode` (rétrocompatible)
- Polish UI sur `ConnectionsHub`
- Ajouter une intent keyword dans la search
- Refactor interne discovery (logique de prefetch, parallélisme)
- Ajouter un endpoint diagnostic
- Ajouter une test (tests existants couvrent write-guard, OK)
- Migrer une nouvelle app vers preview formatter custom (depuis le générique)
- Ajout d'un native connector (ex: Microsoft Graph)
- Ajout d'une capability dans `provider-capabilities`

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Bypass write-guard via direct `executeComposioAction` | Action destructive sans confirmation | Code review obligatoire ; lint à ajouter (gap) |
| Slug LLM-hallucinated non aliasée | `UNKNOWN_SLUG` retourné, action rate | Slug aliases extensibles ; log warn pour ajouter au map |
| `_preview` strippé incorrectement | Composio reçoit param invalide | Tests `to-ai-tools-write-guard.test.ts` couvrent |
| `WRITE_SEGMENTS` mismatch (nouveau segment Composio non listé) | Write action passe en read silencieusement | Détection : log audit ou alarm sur `_SEND_` etc. dans Composio non détectés |
| Composio SDK v0.6 limitations (refresh) | Tokens externes ne se rafraîchissent pas vraiment | Workaround `checkStatus()`, attente SDK v0.7 (cf [auth.md](auth.md)) |
| Composio cloud down | Tous les tools tiers indisponibles | Pas de fallback ; native (Google direct) reste OK pour Gmail/Calendar/Drive |
| Discovery cache 60s pendant OAuth | User voit ancienne liste 1 min | `invalidateUserDiscovery` post-OAuth + `don't cache empty` |
| Cap 40 tools tronque write tool important | LLM ne peut pas l'utiliser | Pas de mitigation : domain allowlist priorise les apps connectées |
| Composio API rate limit | Chat échoue partiellement | Discovery cache 60s + parallel toolkit fetch absorbent |
| Native + Composio collision (Gmail SSO + Composio Gmail) | Composio retourne 401 access_denied | Dedup UI + détection logs |
| Integrations Phase 1 retire l'enforcement read-only | Write via integrations sans gate | Code review + tests `executeIntegration` |
| User connecté à 50+ apps | Discovery lent (50 toolkits parallèles) | Acceptable v1 ; futur : pagination si besoin |
| Schema Composio change (parameters) | Tool LLM échoue | Composio versioned via `dangerouslySkipVersionCheck` ; à monitorer |
| Preview formatter throw | UI affiche erreur, écriture pas exécutée | Wrapper try/catch dans `to-ai-tools.execute` (gap : à ajouter) |

## Tests

### Existants
- [`__tests__/composio/write-guard.test.ts`](../../__tests__/composio/write-guard.test.ts) — 31 cases : `isWriteAction`, `formatActionPreview` (truncation, prominent keys), `filterToolsByDomain` (cap 40, allowlist)
- [`__tests__/composio/to-ai-tools-write-guard.test.ts`](../../__tests__/composio/to-ai-tools-write-guard.test.ts) — preview vs confirmed, `_preview` injection schema, read-only bypass
- [`__tests__/composio/discovery.test.ts`](../../__tests__/composio/discovery.test.ts) — cache TTL, parallel fetch, ACTIVE filter
- [`__tests__/composio/client.test.ts`](../../__tests__/composio/client.test.ts) — singleton, env vars, error codes
- [`__tests__/composio/connections.test.ts`](../../__tests__/composio/connections.test.ts) — listConnections, initiate, disconnect
- [`__tests__/composio/preview-formatters.test.ts`](../../__tests__/composio/preview-formatters.test.ts) — getFormatterForAction matching, helpers
- [`__tests__/composio/gmail.test.ts`](../../__tests__/composio/gmail.test.ts) — Gmail formatter spécifique
- [`__tests__/connections/oauth-refresh.test.ts`](../../__tests__/connections/oauth-refresh.test.ts) — OAuth refresh detection (cf [auth.md](auth.md))
- [`__tests__/composio/composio-bridge.test.ts`](../../__tests__/composio/composio-bridge.test.ts) — bridge voice tools
- [`__tests__/integrations/executor.test.ts`](../../__tests__/integrations/executor.test.ts) — read-only enforcement Phase 1

### Manquants (gap moyen)

**Write-guard edge cases** :
- Test : write tool sans `WRITE_SEGMENTS` ni `WRITE_PREFIXES` → considéré read (faux négatif possible)
- Test : audit log/alarm sur Composio actions non détectées comme write (proactive monitoring)
- Test : preview formatter qui throw → wrapper catch → fallback message
- Test : `_preview: "true"` (string) au lieu de boolean → strict comparison `!== false` (regression)

**Domain filter** :
- Test : nouveau domaine non-listé → fallback no-restriction + cap 40
- Test : 100 tools dans 1 app autorisée → tronqué à 40

**Discovery** :
- Test : invalidation cache après `disconnectAccount` immediate effect
- Test : `getToolsForApp` cache séparé (5 min) ne pollue pas `getToolsForUser` (60s)
- Test : empty result NON caché

**Composio client** :
- Test : `resetComposioClient()` après reset env var
- Test : `SDK_NOT_INSTALLED` cache failure (no retry boucle)
- Test : slug alias chain (alias1 → alias2 → canonical)

**OAuth flow E2E** :
- Test : popup blocked fallback → full-page redirect
- Test : OAuth retour `?connected=slug` parsé correctement
- Test : disconnect + reconnect = nouveau connectionId

**Native vs Composio** :
- Test : SSO Google actif + tentative Composio Gmail → access_denied detection
- Test : dedup UI Composio wins ne supprime pas le native du backend

**Preview formatters** :
- Test : action sans formatter custom → fallback générique
- Test : action avec multiple aliases → premier match wins
- Test : params truncation 200/300 chars
- Test : preview retourne string non vide (regression)

**Integrations** :
- Test : write action throw `TOOL_RISK_NOT_ACCEPTED`
- Test : retry 1 fois max
- Test : RunTracer events emitted

## Code orphelin (code-ready non câblé)

- **`actions/gmail.ts`** : helper actions Gmail (extension Composio). Présent mais peu utilisé en runtime — Composio raw actions privilégiées
- **Microsoft Graph native** : pas implémenté. ConnectionsHub note "outlook" et "teams" comme native potentiels, mais aucun connector
- **Integrations write phase 2** : Phase 1 = read-only strict. Phase 2 implementation TBD

## Notes & historique

- **Composio SDK v0.6.11** vs v0.8.1 dispo (cf [auth.md](auth.md)) — limitations connues sur `refresh()` et `expiresAt`
- **Slug aliases** ajoutés progressivement à mesure des hallucinations LLM observées en prod (`HUBSPOT_LIST_DEALS → HUBSPOT_GET_ALL_DEALS` vu dans logs)
- **`_preview: true` default** — choix conscient pour fail-safe (mieux preview une fois de trop que destructive accidentel)
- **Domain cap 40** — décidé après tests perf orchestrator (>40 tools = prompt explosion + LLM confusion)
- **Native vs Composio dedup** — Composio wins en UI car expose plus d'actions ; native reste fallback runtime
- **Phase 1 integrations read-only** — décidé après incident envoi mass via legacy adapter ; Composio reste seul canal write
- **Don't cache empty discovery** — fix après bug user mid-OAuth voyait liste vide 60s
- **Preview formatters footer figé** — coordonné avec `chat.md` ConfirmActionChips qui détecte le pattern `Réponds\s+\*\*confirmer\*\*`
