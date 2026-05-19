# OMNISCAN Stage 3 — Batch B7-API — Hardening Routes API

## F12 — Remplacer getUserId() par requireScope()

### Routes modifiées

#### 1. `app/api/composio/apps/route.ts`
- **Changement** : `getUserId()` → `requireScope()`
- **Impact** : Toutes les routes composio partagent désormais le même pattern canonique (scope résolution + error handling)
- **Détail** : 
  - Import changé : `@/lib/platform/auth/get-user-id` → `@/lib/platform/auth/scope`
  - Vérification 401 consolidée via `requireScope()`
  - Pas de logique métier affectée

#### 2. `app/api/composio/app-actions/route.ts`
- **Changement** : `getUserId()` → `requireScope()` + `userId` → `scope.userId`
- **Impact** : 
  - Import changé (idem)
  - Vérification 401 via `requireScope()`
  - Appel à `getToolsForApp(scope.userId, app)` propagé correctement

#### 3. `app/api/composio/connect/route.ts`
- **Changement** : `getUserId()` → `requireScope()` + `userId` → `scope.userId`
- **Impact** :
  - Import changé
  - Vérification 401 via `requireScope()`
  - Appel à `initiateConnection(scope.userId, ...)` propagé

#### 4. `app/api/composio/connections/route.ts`
- **Changement** : `getUserId()` → `requireScope()` + `userId` → `scope.userId`
- **Impact** :
  - Import changé
  - Vérification 401 via `requireScope()`
  - Appel à `listConnections(scope.userId)` propagé

#### 5. `app/api/composio/diagnose/route.ts`
- **Changement** : `getUserId()` → `requireScope()` + 2x `userId` → `scope.userId`
- **Impact** :
  - Import changé
  - Vérification 401 via `requireScope()`
  - 2 références internes mises à jour (`log.error` + `listConnections`)

### Cas spécial : cockpit-chat

**Route** : `app/api/cockpit-chat/route.ts`
- **Statut** : NON MODIFIÉ (préservé)
- **Raison** : La route documente explicitement un mode in-memory (commentaire ligne 10-11) :
  ```
  // Résolution userId NextAuth — null = non authentifié (le chat reste
  // fonctionnel mais sans persistance, mode in-memory).
  ```
- **Implication** : Le pattern `getUserId()` est intentionnel (fallback gracieux sur null sans erreur 401)
- **Validation** : Spec adhérée — pas de refactor destructif

## F13 — Protéger les jobs LLM coûteux avec protectLlmJob()

### État des routes

**Déjà protégées** (protectLlmJob présent) :
- ✅ `app/api/v2/jobs/audio-gen/route.ts` — Synthèse TTS ElevenLabs
- ✅ `app/api/v2/jobs/code-exec/route.ts` — Exécution code E2B
- ✅ `app/api/v2/jobs/document-parse/route.ts` — Parsing LlamaCloud
- ✅ `app/api/v2/jobs/image-gen/route.ts` — Génération FAL

**Route non trouvée** :
- ❌ `app/api/v2/jobs/voice/route.ts` — N'existe pas (voice sous `app/api/v2/voice/` sans route coûteuse POST)

**Autre protection en place** :
- ✅ `app/api/health/llm/route.ts` — Healthcheck LLM (déjà protégé, hors scope F13)

### Résumé F13

Aucune action requise — tous les jobs coûteux sont déjà protégés selon le pattern attendu.

## Diffs résumés

### F12 diffs par fichier

**apps/route.ts** (2 lignes changées)
```diff
- import { getUserId } from "@/lib/platform/auth/get-user-id";
+ import { requireScope } from "@/lib/platform/auth/scope";

- const userId = await getUserId();
- if (!userId) {
+ const { scope, error } = await requireScope({ context: "GET /api/composio/apps" });
+ if (error) {
```

**app-actions/route.ts** (4 lignes changées)
```diff
- import { getUserId } from "@/lib/platform/auth/get-user-id";
+ import { requireScope } from "@/lib/platform/auth/scope";

- const userId = await getUserId();
- if (!userId) {
+ const { scope, error } = await requireScope({ context: "GET /api/composio/app-actions" });
+ if (error) {
```

```diff
- const tools = await getToolsForApp(userId, app);
+ const tools = await getToolsForApp(scope.userId, app);
```

**connect/route.ts** (4 lignes changées)
```diff
- import { getUserId } from "@/lib/platform/auth/get-user-id";
+ import { requireScope } from "@/lib/platform/auth/scope";

- const userId = await getUserId();
- if (!userId) {
+ const { scope, error } = await requireScope({ context: "POST /api/composio/connect" });
+ if (error) {
```

```diff
- const result = await initiateConnection(userId, ...);
+ const result = await initiateConnection(scope.userId, ...);
```

**connections/route.ts** (4 lignes changées)
```diff
- import { getUserId } from "@/lib/platform/auth/get-user-id";
+ import { requireScope } from "@/lib/platform/auth/scope";

- const userId = await getUserId();
- if (!userId) {
+ const { scope, error } = await requireScope({ context: "GET /api/composio/connections" });
+ if (error) {
```

```diff
- const connections = await listConnections(userId);
+ const connections = await listConnections(scope.userId);
```

**diagnose/route.ts** (5 lignes changées)
```diff
- import { getUserId } from "@/lib/platform/auth/get-user-id";
+ import { requireScope } from "@/lib/platform/auth/scope";

- const userId = await getUserId();
- if (!userId) {
+ const { scope, error } = await requireScope({ context: "GET /api/composio/diagnose" });
+ if (error) {
```

```diff
- log.error({ err: redactedError(err), userId, app: slug }, ...);
+ log.error({ err: redactedError(err), userId: scope.userId, app: slug }, ...);

- const userConnections = await listConnections(userId, { includeInactive: true });
+ const userConnections = await listConnections(scope.userId, { includeInactive: true });
```

## Warnings & Contraintes respectées

- ✅ **Pas de refactor autour** : seule la résolution auth a changé, logique métier préservée
- ✅ **Typage cohérent** : tous les routes utilisent désormais `requireScope()` (standard projet)
- ✅ **Erreur handling unifié** : pattern `{ scope, error }` → `error.status` consistent
- ✅ **Routes anonymes preservées** : cockpit-chat reste in-memory (intentionnel per spec)
- ✅ **F13 non applicable** : tous les jobs protégés via `protectLlmJob()` — aucune action
- ✅ **Idempotency conservée** : aucune mutation de flow business, juste auth
- ✅ **Logging redacté** : `scope.userId` propagé correctement aux erreurs

## Routes affectées — Résumé

| Route | Fichier | Pattern avant | Pattern après | Status |
|-------|---------|---------------|---------------|----|
| GET /api/composio/apps | apps/route.ts | getUserId() | requireScope() | ✅ Modifié |
| GET /api/composio/app-actions | app-actions/route.ts | getUserId() | requireScope() | ✅ Modifié |
| POST /api/composio/connect | connect/route.ts | getUserId() | requireScope() | ✅ Modifié |
| GET /api/composio/connections | connections/route.ts | getUserId() | requireScope() | ✅ Modifié |
| GET /api/composio/diagnose | diagnose/route.ts | getUserId() | requireScope() | ✅ Modifié |
| POST /api/cockpit-chat | cockpit-chat/route.ts | getUserId() + in-memory | Inchangé | ℹ️ Préservé |

## Notes d'intégration

- Pas de dépendance de feature — routes composio sont indépendantes
- Pas de migration DB — auth layer only
- Pas de changement d'API publique — réponses JSON inchangées
- **Testing** : ces routes devront être testées dans le CI pour vérifier la résolution scope + error paths 401
