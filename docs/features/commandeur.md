# Commandeur — `commandeur`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `commandeur` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P1 — routing central navigation + search hybrid |

## Description

Palette de commande globale (⌘K) cherchant across assets, threads, missions, runs, KG nodes. Mode hybrid : sémantique (embeddings OpenAI si dispo) + lexical (ILIKE) fusionnés, dédupliqués par ID, sémantique en tête. LRU cache 10 queries. Abort automatique de la fetch précédente à chaque nouvelle query.

Également point d'entrée pour les flows `setCommandeurOpen(open, { prefilledQuery })` (ex: MeetingStage → "Créer mission").

## Surface publique

- `GET /api/v2/search?q=<query>&limit=20` — hybrid search
- Composants : `Commandeur.tsx`, `CommandeurResultRow.tsx`
- Hook : `use-commandeur-data.ts` (debounce 200ms, LRU cache)
- Store : `useStageStore.setCommandeurOpen()`, `consumeCommandeurPrefilledQuery()`

## Types clés

```ts
interface SearchResult {
  assets: AssetItem[];      // max 5
  threads: ThreadItem[];    // max 5
  missions: MissionItem[];  // max 5
  runs: RunItem[];          // max 5
  kgNodes: KgNodeItem[];    // max 5
}
```

Pas de table dédiée (query multi-tables + embeddings store).

## Invariants verrouillés

### I-1. Query min 1 char, max 120 chars — Zod validation

### I-2. Debounce 200ms côté hook — pas de spam serveur

### I-3. LRU cache 10 queries (module scope, pas Zustand)

### I-4. Abort fetch précédente à chaque nouvelle query (AbortController)

### I-5. Hybrid = sémantique (tête) + lexical comble, dedup par ID
Sémantique priorisé si OPENAI_API_KEY présent. Sinon lexical seul.

### I-6. Fail-soft par source — une table KO ne casse pas le reste

### I-7. Cap 5 résultats par type de résultat

### I-8. Empty query → reset immédiat, aucune fetch

### I-9. `prefilledQuery` = pattern one-shot via `consumeCommandeurPrefilledQuery()` (read + clear)

### I-10. OPENAI_API_KEY absent → mode lexical uniquement (pas d'erreur)

## Tests

Existants : couverts via use-commandeur-data (test-library)

Manquants : dedup sémantique+lexical par ID, abort précédente fetch, LRU eviction 10, prefilled query consume pattern, fail-soft source KO.
