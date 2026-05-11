/**
 * Embedding service — OpenAI text-embedding-3-small (1536 dim).
 *
 * Single entrée principale : `embedText(text)` → `number[]` de 1536 floats.
 * Cache LRU mémoire (200 entries) pour éviter de recalculer sur le même
 * input (souvent : la même query répétée, ou le même message déjà ingéré
 * via le auto-ingest avant le retrieval du tour suivant).
 *
 * Fail mode :
 * - OPENAI_API_KEY absent → throw `EmbeddingsUnavailableError`
 *   (les callers fail-soft : log warn + skip retrieval).
 *
 * Coût : $0.02 / 1M tokens. Cap d'entrée 8192 tokens (truncate brutal
 * au char count, ~4 chars / token : 32_000 chars max).
 */

import OpenAI from "openai";
import crypto from "crypto";

const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

// 8192 tokens × ~4 chars/token = 32_768 chars. On laisse une marge.
const MAX_INPUT_CHARS = 32_000;

const CACHE_MAX = 200;
// F-122: Cache keyed by SHA256 hash (not plaintext) to avoid PII exposure
const cache = new Map<string, number[]>();

/**
 * Hash une chaîne de texte via SHA256 pour usage comme clé de cache.
 * Évite de conserver le texte brut en mémoire (PII risk).
 */
function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

let _client: OpenAI | null = null;
let _booted = false;

export class EmbeddingsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingsUnavailableError";
  }
}

function getClient(): OpenAI {
  // Re-check la présence de la clé à chaque appel : permet aux tests de
  // basculer la variable d'env entre cas et garde le coût d'instantiation
  // négligeable (le `new OpenAI` reste mémoïsé).
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!_booted) {
      console.warn(
        "[embeddings] OPENAI_API_KEY absent — retrieval LTM désactivé. " +
          "Set OPENAI_API_KEY pour activer la mémoire sémantique.",
      );
      _booted = true;
    }
    throw new EmbeddingsUnavailableError("OPENAI_API_KEY not set");
  }
  if (_client) return _client;
  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Truncate à `MAX_INPUT_CHARS`. Le SDK OpenAI throw un 400 au-dessus de
 * 8192 tokens — mieux vaut couper côté nous que prendre l'erreur réseau.
 */
function truncate(text: string): string {
  if (text.length <= MAX_INPUT_CHARS) return text;
  return text.slice(0, MAX_INPUT_CHARS);
}

function touchCache(hashKey: string, vec: number[]): void {
  // LRU : remove + re-set pour mettre la clé en queue.
  cache.delete(hashKey);
  cache.set(hashKey, vec);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/**
 * Embed un texte → vecteur 1536-dim. Cache LRU local, indexed par hash (F-122).
 * Throw `EmbeddingsUnavailableError` si pas de clé OpenAI.
 */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    throw new Error("[embeddings] embedText requires non-empty text");
  }

  const input = truncate(trimmed);
  const hashKey = hashText(input); // F-122: Use hash as cache key, not plaintext
  const cached = cache.get(hashKey);
  if (cached) {
    // Re-touch pour conserver la fraîcheur LRU.
    touchCache(hashKey, cached);
    return cached;
  }

  const client = getClient();
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `[embeddings] OpenAI returned invalid embedding (length=${vec?.length ?? 0}, expected ${EMBEDDING_DIM})`,
    );
  }

  // F-122: Store in cache keyed by hash, never by plaintext
  touchCache(hashKey, vec);
  return vec;
}

/** Test-only : vide le cache pour isoler les cas. */
export function __clearEmbedCache(): void {
  cache.clear();
}

/** Indicateur de disponibilité (pour les routes API qui veulent 503-fail). */
export function isEmbeddingsAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
