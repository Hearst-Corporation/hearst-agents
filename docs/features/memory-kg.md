# Knowledge Graph & Memory — `memory-kg`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `memory-kg` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P1** — deux risques de régression silencieuse : backfill peut écraser des embeddings valides + RLS UUID peut exposer des rows cross-tenant si user_id legacy email |

## Description

Mémoire longue durée de Hearst OS en 3 couches :
1. **Court terme** : `chat_messages` (in-memory buffer + Redis WAL 1h + Supabase permanent), scope conversationId
2. **Moyen terme** : `mission_messages` + résumé glissant Redis (TTL 30j, compression Claude Haiku au-delà de 20 messages), scope missionId
3. **Long terme** : Knowledge Graph (`kg_nodes`/`kg_edges`) + embeddings pgvector 1536-dim, scope userId+tenantId

Alimentation : chaque tour de conversation est ingéré via `fireAndForgetIngestTurn()` → extraction entités+relations via Claude Haiku → UPSERT nodes/edges KG → auto-embed via OpenAI `text-embedding-3-small`. Retrieval : cosine similarity top-K via `match_embeddings` RPC pgvector + summary KG compact.

Injection dans le prompt système : blocs `<kg_context>` (1500 chars, cache 60s) + `<retrieved_memory>` (top-5, 1500 chars, cache 30s) + `<mission_context>` (pour les missions).

## Surface publique

### Composants UI
- [KgNodeDetail.tsx](../../app/(user)/components/kg/KgNodeDetail.tsx) — panneau détail node sélectionné dans Cytoscape (type, label, propriétés max 8, timeline à la demande)
- [KgQueryBar.tsx](../../app/(user)/components/kg/KgQueryBar.tsx) — recherche fuzzy labels
- [stages/KnowledgeStage.tsx](../../app/(user)/components/stages/KnowledgeStage.tsx) — stage KG avec Cytoscape (cf [stage.md](stage.md))

### Endpoints API

| Méthode + Route | Auth | Rôle |
|-----------------|------|------|
| `GET /api/v2/kg/graph` | `requireScope` | KG complet user-scoped (nodes + edges) |
| `POST /api/v2/kg/ingest` | `requireScope` | Extrait + persiste entités depuis texte |
| `POST /api/v2/kg/query` | `requireScope` | Recherche sémantique question → nodes+edges+narrative |
| `GET /api/v2/kg/search?q=` | `requireScope` | Fuzzy ILIKE sur labels |
| `GET /api/v2/kg/path?from=&to=&maxHops=` | `requireScope` | BFS plus court chemin (max 4 hops default, cap 6) |
| `GET /api/v2/kg/timeline?entityId=` | `requireScope` | Timeline edges in/out (limit 1-200, default 50) |
| `GET/POST /api/agents/[id]/memory` | `requireScope` | Legacy agent memory (coexiste avec KG) |
| `GET/POST /api/memory-policies` | `requireScope` | Politiques TTL/dedup/auto-summarize |

### Exports publics (`lib/memory/` + `lib/embeddings/`)

```ts
// kg-ingest-pipeline.ts
ingestConversationTurn(input): Promise<{ entitiesCreated, edgesCreated, skipped, reason? }>
fireAndForgetIngestTurn(input): void

// kg.ts
extractEntities(text): Promise<{ entities, relations }>
upsertNode(scope, node): Promise<string>  // retourne UUID
upsertEdge(scope, edge): Promise<string>
searchNodes(scope, q, limit?): Promise<KgNode[]>
findPath(scope, fromId, toId, maxHops?): Promise<{ nodes, edges, hops } | null>
getGraph(scope): Promise<{ nodes: KgNode[], edges: KgEdge[] }>

// kg-context.ts
getKgContextForUser(userId, tenantId, opts?): Promise<string | null>
__clearKgContextCache(): void  // test helper

// retrieval-context.ts
getRetrievedMemoryForUser(params): Promise<string>
__clearRetrievalCache(): void  // test helper

// conversation-summary.ts
appendToSummary(userId, role, content): Promise<void>
getSummary(userId): Promise<string>
clearSummary(userId): Promise<void>

// embeddings/embed.ts
embedText(text): Promise<number[]>  // throw EmbeddingsUnavailableError si pas de clé
isEmbeddingsAvailable(): boolean
EMBEDDING_MODEL: "text-embedding-3-small"
EMBEDDING_DIM: 1536

// embeddings/store.ts
upsertEmbedding(input: UpsertEmbeddingInput): Promise<boolean>
searchEmbeddings(input: SearchEmbeddingsInput): Promise<RetrievedEmbedding[]>
deleteEmbeddings(filter): Promise<void>
```

## Architecture interne

### Tables Supabase

#### `kg_nodes` (migration `0035`)

```sql
CREATE TABLE kg_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  tenant_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('person','company','project','decision','commitment','topic')),
  label text NOT NULL,
  properties jsonb DEFAULT '{}',
  created_at, updated_at timestamptz
);
UNIQUE (user_id, tenant_id, type, label)
CREATE INDEX idx_kg_nodes_user_type ON kg_nodes (user_id, type);
CREATE POLICY kg_nodes_user_isolation ON kg_nodes USING (user_id = current_setting('app.current_user_id'));
```

#### `kg_edges` (migration `0035`)

```sql
CREATE TABLE kg_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  tenant_id text NOT NULL,
  source_id uuid REFERENCES kg_nodes(id),
  target_id uuid REFERENCES kg_nodes(id),
  type text NOT NULL,
  weight float DEFAULT 1.0,
  created_at timestamptz
);
UNIQUE (user_id, tenant_id, source_id, target_id, type)
CREATE INDEX idx_kg_edges_user_source ON kg_edges (user_id, source_id);
CREATE INDEX idx_kg_edges_user_target ON kg_edges (user_id, target_id);
```

#### `embeddings` (migration `0046`)

```sql
CREATE TABLE embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  tenant_id text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('message','asset','briefing','kg_node','transcript')),
  source_id text NOT NULL,
  text_excerpt text NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at, updated_at timestamptz
);
UNIQUE (user_id, tenant_id, source_kind, source_id)
CREATE INDEX idx_embeddings_user_tenant ON embeddings (user_id, tenant_id);
CREATE INDEX idx_embeddings_source ON embeddings (source_kind, source_id);
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists=100);
-- RLS : Policy `embeddings_service_all` FOR ALL USING (true) → service_role bypass, user isolation côté app
```

#### `match_embeddings` RPC (migration `0047`)

```sql
CREATE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_user_id text,
  match_tenant_id text,
  match_count int DEFAULT 5,
  source_kinds text[] DEFAULT NULL
) RETURNS TABLE(id, source_kind, source_id, text_excerpt, metadata, similarity float, created_at)
LANGUAGE sql STABLE
GRANT EXECUTE ON FUNCTION match_embeddings TO service_role;
```

Similarity = `1 - (embedding <=> query_embedding)` (cosine).

### Modèles IA

| Usage | Modèle | Max tokens |
|-------|--------|------------|
| Extraction entités KG | `claude-haiku-4-5-20251001` | 2048 |
| Compression résumé conversation | `claude-haiku-4-5-20251001` | 250 |
| Résumé mission post-run | `claude-haiku-4-5-20251001` | 250 |
| Briefing matinal | `claude-haiku-4-5-20251001` | 500 |
| Embeddings | `text-embedding-3-small` (OpenAI) | — |
| Dimension vecteur | 1536 | — |

### KG ingest pipeline (`kg-ingest-pipeline.ts`)

```
[fireAndForgetIngestTurn(userMsg, assistantMsg)]
   ↓ concat user (≤3000) + assistant (≤3000) ≈ 6000 chars
   ↓ extractEntities(text) → claude-haiku (2048 tokens max)
   ↓ pour chaque entity :
       ├─ upsertNode(scope, { type, label, properties })
       │   UPSERT ON CONFLICT (user_id, tenant_id, type, label) DO UPDATE
       ├─ [fire-and-forget auto-embed]
       │   ├─ buildNodeExcerpt(node) → "type: label — k1: v1; k2: v2" (max 8 props)
       │   └─ upsertEmbedding({ source_kind: "kg_node", ... })
       │       ├─ embedText(excerpt) → vec 1536-dim (OpenAI)
       │       └─ UPSERT embeddings ON CONFLICT DO UPDATE
       └─ idByLabel[label] = nodeId
   ↓ pour chaque relation :
       ├─ resolve source+target via idByLabel
       ├─ skip silencieux si label inconnu
       └─ upsertEdge(scope, { source_id, target_id, type, weight++ })
   ↓ __clearKgContextCache() → invalide cache 60s
   ↓ retour { entitiesCreated, edgesCreated, skipped, reason? }
```

Fail-soft : extraction failure → `{ skipped: true, reason: "extraction_failed" }`. Node/edge failure → log warn + continue.

### Embeddings upsert + search

`upsertEmbedding(input: UpsertEmbeddingInput)` :
1. Clamp `textExcerpt` → 4000 chars
2. `embedText(text)` → `EmbeddingsUnavailableError` si `OPENAI_API_KEY` absent
3. Format vecteur pgvector `"[0.1,0.2,...]"`
4. UPSERT `embeddings ON CONFLICT (user_id, tenant_id, source_kind, source_id) DO UPDATE`
5. Retourne `boolean` (fail-soft : false si Supabase ou OpenAI down)

`searchEmbeddings(input)` :
1. k = clamp(k ?? 5, 1, 50)
2. `embedText(queryText)` → retourne `[]` si fail
3. Try RPC `match_embeddings(...)` → fallback JS scan (≤ 2000 rows)
4. Retourne `RetrievedEmbedding[]` scorés

### Retrieval context injection

`getRetrievedMemoryForUser(params)` :
- Cache key `${userId}::${tenantId}::${FNV1a(text)}::k${k}`, **TTL 30s**
- Format injection :
  ```
  Souvenirs pertinents (proches de la requête) :
  - [kg] <excerpt ≤220 chars>
  - [message] <excerpt ≤220 chars>
  ```
- **MAX_TOTAL_CHARS = 1500** (budget cache Anthropic)
- **PER_ITEM_MAX = 220** chars par item

`getKgContextForUser(userId, tenantId)` :
- **Cache TTL 60s** per (userId, tenantId)
- Format injection :
  ```
  Personnes : Adrien (founder), John (CFO ACME).
  Entreprises : ACME Corp.
  Projets : Hearst OS (en dev).
  Décisions : Migrer v2 le 15/05.
  ```
- MaxItems par catégorie : person 8, company 6, project 6, decision 5, commitment 5, topic 5
- Max total 1500 chars
- Invalidé via `__clearKgContextCache()` après chaque ingest

### Conversation summary (Redis)

- Clé Redis : `memory:summary:${userId}`
- **TTL 30 jours** (`2_592_000` seconds)
- **MAX_BUFFER = 20** messages avant compression
- Compression : Claude Haiku, 250 tokens max, 4 sections (Objectif, État, Décisions, Prochaine étape)
- Fail-soft : pas de Redis → log warn, retour vide

### Chat messages (store.ts)

- `MAX_MESSAGES_PER_CONVERSATION = 24` (hard cap)
- `MAX_BUFFERED_CONVERSATIONS = process.env.MEMORY_BUFFER_MAX_CONVERSATIONS ?? 1000`
- WAL Redis TTL = 3600s (1h) — synchrone (await)
- Persist Supabase — fire-and-forget (ne bloque pas SSE)

### Backfill script (`scripts/backfill-kg-embeddings.ts`)

One-shot pour re-vectoriser tous les `kg_nodes` existants :
1. `BATCH = 100`, `RATE_LIMIT_DELAY = 50ms` (OpenAI 3000 RPM)
2. SELECT kg_nodes ORDER BY created_at ASC, par batch de 100
3. `buildNodeExcerpt(node)` + `upsertEmbedding(...)` (UPSERT idempotent)
4. Exit 1 si `failed > 0`

**Guards présents** : env var checks (exit 1 si absent).
**Guards manquants** : pas de `--dry-run`, pas de `--skip-existing`, pas de confirmation.

### Variables d'env critiques

| Var | Required | Notes |
|-----|----------|-------|
| `OPENAI_API_KEY` | recommandé | Embeddings. Sans lui : auto-embed silencieux, retrieval vide |
| `ANTHROPIC_API_KEY` | ✅ | Extraction KG, résumés, briefing |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Tables KG + embeddings + chat_messages |
| `MEMORY_BUFFER_MAX_CONVERSATIONS` | optionnel | LRU buffer cap (default 1000) |
| Redis (voir `lib/platform/redis/client.ts`) | recommandé | WAL + summary. Sans Redis : dégradation silencieuse |

## Data flow

### Tour de conversation → long terme

```
[Chat turn terminé (user + assistant)]
   ↓ fireAndForgetIngestTurn (async, ne bloque pas la réponse)
   ├─ extractEntities → KG nodes + edges (UPSERT)
   ├─ auto-embed nodes (fire-and-forget)
   └─ __clearKgContextCache
   
[Prochain message user]
   ↓ ai-pipeline.buildAgentSystemPrompt()
   ├─ getKgContextForUser → <kg_context> (cache 60s)
   └─ getRetrievedMemoryForUser(userMsg, k=5) → <retrieved_memory> (cache 30s)
   ↓ streamText avec contexte enrichi
```

### Backfill (à exécuter manuellement)

```sh
OPENAI_API_KEY=sk-... \
NEXT_PUBLIC_SUPABASE_URL=https://... \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npx tsx scripts/backfill-kg-embeddings.ts
```

⚠ S'assurer que les nodes à backfiller ne sont pas déjà vectorisés (l'UPSERT rewrite le vecteur existant, ce qui est idempotent mais consomme des crédits OpenAI).

## Invariants verrouillés

### I-1. `KgNodeType` — 6 valeurs figées

`person | company | project | decision | commitment | topic`. Check constraint en DB.

Ajouter un type = update spec + migration ALTER TABLE (CHECK constraint) + sync `TYPE_COLOR` UI + sync extraction prompt.

### I-2. `kg_nodes` UNIQUE `(user_id, tenant_id, type, label)`

Garantit la déduplication par (scope utilisateur, type d'entité, libellé). L'UPSERT sur ce quadruplet est la déduplication cross-conversation.

Modifier la clé de conflit = update spec + plan de migration (possibles rows dupliquées).

### I-3. `kg_edges` UNIQUE `(user_id, tenant_id, source_id, target_id, type)`

Même logique. Le `weight` incrémente à chaque upsert (fréquence de la relation).

### I-4. Embedding model = `text-embedding-3-small`, dimension `1536`

`EMBEDDING_MODEL = "text-embedding-3-small"`, `EMBEDDING_DIM = 1536`.

Migration vers un autre modèle = update spec + migration ALTER TABLE dimension + re-vectorisation complète de tous les embeddings existants + régénération index ivfflat.

### I-5. Index ivfflat cosine_ops, lists=100

`USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)`.

Modifier les paramètres (HNSW, lists différent) = update spec + migration REINDEX. Impacte les performances ANN.

### I-6. `EmbeddingSourceKind` — 5 valeurs figées

`message | asset | briefing | kg_node | transcript`. CHECK constraint en DB.

Ajouter un kind = update spec + migration ALTER CHECK.

### I-7. `match_embeddings` RPC — signature figée

```sql
match_embeddings(
  query_embedding vector(1536),
  match_user_id text,
  match_tenant_id text,
  match_count int DEFAULT 5,
  source_kinds text[] DEFAULT NULL
)
```

Toute modification de signature = update spec + migration DROP/CREATE + sync `searchEmbeddings` caller.

### I-8. Extraction model = `claude-haiku-4-5-20251001`

`EXTRACTION_MODEL = "claude-haiku-4-5-20251001"`. Modèle frugal pour ingest fire-and-forget.

Migration vers autre modèle = update spec (impact coût + qualité extraction).

### I-9. Auto-embed fire-and-forget post-upsertNode

Chaque `upsertNode()` dans `ingestConversationTurn` déclenche un auto-embed fire-and-forget. Ce n'est pas synchrone (pas de await) pour ne pas bloquer le pipeline d'ingest.

Si tu synchronises l'embed = `ingestConversationTurn` devient lent (OpenAI latency) et bloque le chat. Update spec requise.

### I-10. Cache KG context 60s + invalidation post-ingest

`getKgContextForUser` cache 60s per `(userId, tenantId)`. Invalidé explicitement par `__clearKgContextCache()` à la fin de chaque `ingestConversationTurn`.

Supprimer l'invalidation = system prompt stale pendant 60s après ingest.

### I-11. Retrieval cache 30s, `MAX_TOTAL_CHARS = 1500`, `PER_ITEM_MAX = 220`

`getRetrievedMemoryForUser` cache 30s par clé hash-message.

`MAX_TOTAL_CHARS = 1500` — budget cache Anthropic (pas de dépassement).
`PER_ITEM_MAX = 220` — chaque item tronqué pour uniformité.

Augmenter = update spec (impact coût cache Anthropic).

### I-12. Conversation summary Redis TTL 30j, `MAX_BUFFER = 20`

Clé Redis `memory:summary:${userId}`, TTL `2_592_000s`.

`MAX_BUFFER = 20` messages avant compression Claude Haiku 250 tokens.

Modifier = update spec (TTL court → perte mémoire ; MAX_BUFFER grand → coût compression).

### I-13. `MAX_MESSAGES_PER_CONVERSATION = 24`

Hard cap in-memory + Supabase. Prévient les conversations interminables.

### I-14. WAL Redis synchrone, persist Supabase fire-and-forget

`appendMessage()` : WAL Redis = **await** (garantit pas de perte si process crash). Persist Supabase = fire-and-forget.

Inverser (Supabase synchrone + Redis fire-and-forget) = messages perdus si crash entre les deux.

### I-15. Backfill script — UPSERT idempotent (overwrite)

`upsertEmbedding` utilise `ON CONFLICT DO UPDATE` → re-run du backfill sur des nodes déjà vectorisés = vecteurs réécrits (même valeur si modèle inchangé) mais crédits OpenAI consommés.

À ne lancer qu'une fois ou sur des nodes non-encore vectorisés.

### I-16. `user_id` en `text` dans tables KG (pas `uuid`)

`kg_nodes.user_id` et `kg_edges.user_id` sont de type `text` (créées post-migration `0026` mais sans ALTER TYPE). Valeur attendue : UUID string au format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

Toute row avec email comme `user_id` = row isolable mais orpheline (RLS via session var `app.current_user_id`). Audit à faire si des rows legacy existent.

### I-17. Tenant isolation : filtrage explicite côté app (pas RLS `auth.uid()`)

KG tables + embeddings = filtrage `user_id` et `tenant_id` explicite dans le code (`scope` passé à chaque query). RLS sur `kg_nodes`/`kg_edges` utilise `current_setting('app.current_user_id')` (session var settée par le server), pas `auth.uid()`.

Toute query directe sans filtrage scope = cross-tenant leak possible.

### I-18. `EmbeddingsUnavailableError` ne propage pas vers l'utilisateur

Si `OPENAI_API_KEY` absent : `embedText()` throw `EmbeddingsUnavailableError`. Tous les callers (`upsertEmbedding`, `searchEmbeddings`) l'attrapent et retournent `false` / `[]`. **Jamais** propagé à l'UI ou au SSE chat.

## Évolutions autorisées sans spec

- Ajouter des propriétés aux nodes existants (jsonb flexible)
- Ajouter un `EmbeddingSourceKind` (requiert migration ALTER CHECK)
- Ajouter un KgNodeType (requiert migration + sync UI + extraction prompt)
- Ajouter des nodes dans `TYPE_COLOR` et maxItems par catégorie
- Ajuster `MAX_TOTAL_CHARS` ou `PER_ITEM_MAX` (update spec car impact cache Anthropic)
- Refactor interne des caches (clé, TTL) — sans modifier I-10/I-11
- Ajouter un `--dry-run` flag au backfill script (non bloquant, good practice)
- Ajouter un `--skip-existing` au backfill script
- Ajouter un startup check `OPENAI_API_KEY` (recommandé)
- Ajouter `__clearRetrievalCache()` dans ingestConversationTurn (recommandé, invariant I-10 étendu)
- Refactor BFS pathfinding (perf) tant que l'API reste identique

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| **Backfill sans dry-run** | Rewrite crédits OpenAI inutiles si nodes déjà vectorisés | UPSERT idempotent (vecteurs réécrits = identiques) ; coûts OpenAI = seul impact |
| **user_id legacy email dans kg_nodes** | Row orpheline (visible avec bon scope, invisible en RLS session) | Service role bypass mitige ; audit recommandé |
| **OPENAI_API_KEY absent** | Auto-embed échoue silencieusement → retrieval vide | EmbeddingsUnavailableError catchée partout. Pas d'alerte startup (gap) |
| **Redis down** | WAL fail → messages perdus au crash ; summary vide | Fail-soft log warn. WAL = await donc sync avant réponse au client |
| **ivfflat lists=100 petit pour large dataset** | ANN recall dégradé au-delà de ~1M vecteurs | À re-tuner si embedding store dépasse 500K rows |
| **Cache retrieval stale 30s** | Nouveau node ingesté non retrouvé pendant 30s | `__clearKgContextCache` post-ingest invalide KG cache. Retrieval cache non invalidé (gap) |
| **conversation_summary Redis TTL 30j** | Mémoire stale sur longue inactivité | TTL agressive mais acceptable : getSummary retourne vide après 30j d'inactivité |
| **match_embeddings fallback JS scan** | Scan 2000 rows max → résultats tronqués si dataset large | RPC préféré ; JS fallback = dégradation gracieuse Supabase RPC indisponible |
| **mission_messages accumulation** | Coût Supabase + perf listMissionMessages | ON DELETE CASCADE via missionId. Pas de TTL auto (gap) |
| **Extraction Claude rate-limit** | ingestConversationTurn skip → KG stale | fire-and-forget silencieux ; acceptable (prochaine conversation ingestera) |

## Tests

### Existants
- [`__tests__/memory/kg-ingest-pipeline.test.ts`](../../__tests__/memory/kg-ingest-pipeline.test.ts) — ingest, skip empty, extraction fail, relation label inconnu, fireAndForget
- [`__tests__/embeddings/embed.test.ts`](../../__tests__/embeddings/embed.test.ts) — vecteur 1536-dim, cache LRU, truncation, EmbeddingsUnavailableError
- [`__tests__/memory/kg-context.test.ts`](../../__tests__/memory/kg-context.test.ts) — cache, format, multi-catégories
- [`__tests__/memory/retrieval-context.test.ts`](../../__tests__/memory/retrieval-context.test.ts) — cache, format, MAX_TOTAL_CHARS
- [`__tests__/memory/mission-context.test.ts`](../../__tests__/memory/mission-context.test.ts) — append, list, format XML
- [`__tests__/memory/store-persistence.test.ts`](../../__tests__/memory/store-persistence.test.ts) — append, getRecent, WAL
- [`__tests__/memory/structured-messages.test.ts`](../../__tests__/memory/structured-messages.test.ts) — ModelMessage payload
- [`__tests__/memory/briefing-injection.test.ts`](../../__tests__/memory/briefing-injection.test.ts) — format, 3 sections
- [`__tests__/memory/kg-query.test.ts`](../../__tests__/memory/kg-query.test.ts) — query execution
- [`__tests__/memory/kg-routes.test.ts`](../../__tests__/memory/kg-routes.test.ts) — endpoints KG

### Manquants (gap moyen)

**Backfill** :
- Test backfill script --dry-run (à implémenter) ne modifie rien
- Test backfill skips already-up-to-date nodes (--skip-existing à implémenter)
- Test backfill exit code 1 si failed > 0

**Embeddings store** :
- Test `upsertEmbedding` clamp 4000 chars (text_excerpt tronqué)
- Test `searchEmbeddings` fallback JS scan (mock RPC fail)
- Test `deleteEmbeddings` par source_kind filter

**KG context** :
- Test maxItems par catégorie (person 8, company 6, etc.)
- Test coupe 1500 chars (catégories bas sacrifiées)
- Test invalidation cache post-ingest `__clearKgContextCache`

**Retrieval** :
- Test `__clearRetrievalCache` + `getRetrievedMemoryForUser` retourne frais post-clear
- Test PER_ITEM_MAX 220 chars troncature
- Test k clamp (0 → 1, 51 → 50)

**Conversation summary** :
- Test compression déclenchée à MAX_BUFFER (20) messages
- Test getSummary après Redis TTL expiry (retour vide gracieux)
- Test clearSummary + getSummary = vide

**Scope isolation** :
- Test `getGraph` user A ne voit pas nodes user B
- Test `searchEmbeddings` user_id filtering strict
- Test `findPath` retourne null si from/to appartiennent à users différents

**RLS / UUID** :
- Test `upsertNode` avec user_id UUID valide → success
- Test (si query directe SQL) row legacy email invisible avec session var UUID

**Misc** :
- Test `buildNodeExcerpt` : propriétés null skippées, max 8
- Test `formatMissionContextBlock` XML well-formed
- Test `appendToSummary` concurrent calls (Redis WATCH ?)

## Code orphelin

- **`api/agents/[id]/memory`** (ancien système memories par agent) — coexiste avec KG sans intégration. Legacy actif mais non migré vers KG.
- **`memory-policies` API** — retourne `{ policies: [] }` (liste vide). Non encore implémenté côté storage.

## Notes & historique

- **Migration `0035`** — création `kg_nodes` + `kg_edges`
- **Migration `0046`** — création `embeddings` table avec pgvector 1536-dim + ivfflat
- **Migration `0047`** — RPC `match_embeddings` (stable function, service_role)
- **Migration `0056`** — `mission_messages` (cf [missions.md](missions.md))
- **Migration `0026`** — UUID cleanup (cf [auth.md](auth.md)). KG tables créées APRÈS, mais `user_id` reste type `text` (UUID string). Audit recommandé.
- **Choix OpenAI embeddings** — `text-embedding-3-small` préféré à `text-embedding-ada-002` : même qualité, 5x moins cher ($0.02/1M vs $0.10/1M). Dimension 1536 identique pour compatibilité ANN.
- **Choix ivfflat vs HNSW** — ivfflat préféré à HNSW (pgvector <0.5) pour les petits datasets (<1M). Rebalancer vers HNSW si dataset dépasse 500K vecteurs.
- **fire-and-forget ingest** — choix conscient pour ne pas pénaliser la latence du chat. Conséquence : KG éventuellement cohérent avec ~1 message de retard.
- **Redis WAL synchrone** — choix conscient : WAL avant réponse client = garantie "si tu reçois la réponse, le message est persisté au moins dans Redis". Perte possible seulement si Redis ET serveur crashent simultanément.
- **`user_id text` dans KG tables** — pas encore migré vers `uuid` post-0026. Acceptable si tous les callers passent un UUID (requireScope garantit UUID). À migrer si besoin de type-safety DB.
