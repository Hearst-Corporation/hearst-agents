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

import { searchEmbeddings, type RetrievedEmbedding } from "@/lib/embeddings/store";
import { getRedis } from "@/lib/platform/redis/client";
import { fenceUntrusted } from "./untrusted-fence";

const MAX_TOTAL_CHARS = 1500;
const PER_ITEM_MAX = 220;
const CACHE_TTL_S = 60;
const DEFAULT_K = 5;

// Fallback in-process pour dev local / Redis absent
interface LocalEntry { text: string; expiresAt: number }
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

function labelFor(kind: RetrievedEmbedding["sourceKind"]): string {
  switch (kind) {
    case "message":    return "message";
    case "asset":      return "asset";
    case "briefing":   return "briefing";
    case "kg_node":    return "kg";
    case "transcript": return "transcript";
    default:           return "mem";
  }
}

function clampLine(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1) + "…";
}

export function formatRetrievedItems(items: RetrievedEmbedding[]): string {
  if (items.length === 0) return "";

  const sorted = [...items].sort((a, b) => b.similarity - a.similarity);

  const fencedItems: string[] = [];
  let total = 0;

  for (const item of sorted) {
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
    "Souvenirs pertinents (proches de la requête, ordonnés par similarité) :",
    ...fencedItems,
  ].join("\n");
}

async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try { return await redis.get(`ltm:${key}`); } catch { /* fall through */ }
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
    } catch { /* fall through to local */ }
  }
  localCache.set(key, { text, expiresAt: Date.now() + CACHE_TTL_S * 1000 });
}

/**
 * Récupère top-K embeddings pour le user et formate en bloc texte.
 * Retourne string vide si rien de pertinent ou si erreur.
 */
export async function getRetrievedMemoryForUser(
  params: RetrievedMemoryParams,
): Promise<string> {
  const { userId, tenantId, currentMessage, k = DEFAULT_K } = params;
  const trimmed = (currentMessage ?? "").trim();
  if (!trimmed || !userId) return "";

  const cacheKey = `${userId}::${tenantId}::${hashMessage(trimmed)}::k${k}`;

  const cached = await cacheGet(cacheKey);
  if (cached !== null) return cached;

  let text = "";
  try {
    const items = await searchEmbeddings({ userId, tenantId, queryText: trimmed, k });
    text = formatRetrievedItems(items);
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
