/**
 * Retrieval-context — recherche sémantique top-K dans `embeddings` et
 * formate un bloc texte injectable dans le system prompt sous la balise
 * `<retrieved_memory>`.
 *
 * Cache 60s par (userId, tenantId, hash(message), k) :
 * - Upstash Redis si disponible (partagé entre instances serverless).
 * - Map in-process comme fallback (dev local / cold start sans Redis).
 *
 * Cap stricte 1500 chars (cf. budget cacheable Anthropic). Chaque ligne
 * préfixée par le source_kind pour que le modèle puisse pondérer.
 *
 * Fail-soft : retour string vide en cas d'erreur ou de OPENAI_API_KEY
 * absent. Le pipeline tourne sans retrieved memory.
 */

import { type RetrievedEmbedding, searchEmbeddings } from "@/lib/embeddings/store";
import { getRedis } from "@/lib/platform/redis/client";
import { searchCortexMemory } from "./cortex-client";
import { fenceUntrusted } from "./untrusted-fence";

const MAX_TOTAL_CHARS = 1500;
const PER_ITEM_MAX = 220;
const CACHE_TTL_S = 60;
const DEFAULT_K = 5;

// Fallback in-process pour dev local / Redis absent
interface LocalEntry {
  text: string;
  expiresAt: number;
}
const localCache = new Map<string, LocalEntry>();

export interface RetrievedMemoryParams {
  userId: string;
  tenantId: string;
  currentMessage: string;
  k?: number;
}

function hashMessage(s: string): string {
  // FNV-1a 32-bit — suffisant pour cache key
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

function clampLine(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function formatRetrievedItems(items: RetrievedEmbedding[]): string {
  if (items.length === 0) return "";

  // Préserve l'ordre fourni par l'appelant — trier EN AMONT si nécessaire
  // (cf. getRetrievedMemoryForUser qui fournit local puis cortex déjà ordonnés,
  //  et mission-context.ts qui trie avant l'appel pour sa source homogène).
  const fencedItems: string[] = [];
  let total = 0;

  for (const item of items) {
    const excerpt = clampLine(item.textExcerpt, PER_ITEM_MAX);
    const meta: Record<string, string> = {
      source: item.sourceKind,
      id: item.sourceId,
    };
    const role = (item.metadata as Record<string, unknown>)?.role;
    if (typeof role === "string") meta.role = role;
    const fenced = fenceUntrusted("memory", excerpt, meta);
    if (total + fenced.length + 1 > MAX_TOTAL_CHARS) break;
    fencedItems.push(fenced);
    total += fenced.length + 1;
  }

  if (fencedItems.length === 0) return "";
  return [
    "Souvenirs pertinents (proches de la requête, dans l'ordre fourni) :",
    ...fencedItems,
  ].join("\n");
}

async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get(`ltm:${key}`);
    } catch {
      /* fall through */
    }
  }
  const now = Date.now();
  const entry = localCache.get(key);
  if (entry && entry.expiresAt > now) return entry.text;
  return null;
}

async function cacheSet(key: string, text: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(`ltm:${key}`, CACHE_TTL_S, text);
      return;
    } catch {
      /* fall through to local */
    }
  }
  localCache.set(key, { text, expiresAt: Date.now() + CACHE_TTL_S * 1000 });
}

/**
 * Récupère top-K embeddings pour le user et formate en bloc texte.
 * Retourne string vide si rien de pertinent ou si erreur.
 */
export async function getRetrievedMemoryForUser(params: RetrievedMemoryParams): Promise<string> {
  const { userId, tenantId, currentMessage, k = DEFAULT_K } = params;
  const trimmed = (currentMessage ?? "").trim();
  if (!trimmed || !userId) return "";

  const cacheKey = `${userId}::${tenantId}::${hashMessage(trimmed)}::k${k}`;

  const cached = await cacheGet(cacheKey);
  if (cached !== null) return cached;

  let text = "";
  try {
    // Interrogation parallèle : mémoire locale Helm (Supabase 1536d) + Cortex LTM (BGE 384d).
    // Les vecteurs sont incompatibles → fédération PAR TEXTE (Cortex ré-embed côté serveur).
    const [localItems, cortexItems] = await Promise.all([
      searchEmbeddings({ userId, tenantId, queryText: trimmed, k }).catch(
        (): RetrievedEmbedding[] => [],
      ),
      searchCortexMemory({ query: trimmed, k }).catch((): RetrievedEmbedding[] => []),
    ]);

    // Quota par source : scores locaux (cosine ~0.7-0.95) et Cortex (RRF hybride, échelle différente)
    // ne sont PAS comparables — un tri brut écraserait systématiquement Cortex.
    // Quota = PLANCHER garanti (half local + (k-half) cortex) avec complétion croisée :
    // les slots inutilisés d'une source (ex: Cortex absent) sont ré-alloués à l'autre
    // jusqu'à k total. Ex : (5 local, 0 cortex, k=5) → 5 local ; (2 local, 5 cortex, k=5) → 2+3.
    const bySimilarityDesc = (a: RetrievedEmbedding, b: RetrievedEmbedding) =>
      b.similarity - a.similarity;
    const sortedLocal = [...localItems].sort(bySimilarityDesc);
    const sortedCortex = [...cortexItems].sort(bySimilarityDesc);
    const half = Math.ceil(k / 2);
    let nLocal = Math.min(half, sortedLocal.length);
    let nCortex = Math.min(k - half, sortedCortex.length);
    const spare = k - nLocal - nCortex;
    if (spare > 0) {
      nLocal += Math.min(spare, sortedLocal.length - nLocal);
      nCortex += Math.min(k - nLocal - nCortex, sortedCortex.length - nCortex);
    }
    const localSlice = sortedLocal.slice(0, nLocal);
    const cortexSlice = sortedCortex.slice(0, nCortex);
    // Interleave round-robin : le cap 1500 chars (formatRetrievedItems) ne sacrifie
    // plus systématiquement la source en fin de liste (Cortex). Préserve le quota.
    const merged: RetrievedEmbedding[] = [];
    for (let i = 0; i < Math.max(localSlice.length, cortexSlice.length); i++) {
      if (i < localSlice.length) merged.push(localSlice[i]);
      if (i < cortexSlice.length) merged.push(cortexSlice[i]);
    }

    text = formatRetrievedItems(merged);
  } catch (err) {
    console.warn("[retrieval-context] search failed:", err);
    text = "";
  }

  await cacheSet(cacheKey, text);
  return text;
}

/** Test-only : reset cache local. */
export function __clearRetrievalCache(): void {
  localCache.clear();
}
