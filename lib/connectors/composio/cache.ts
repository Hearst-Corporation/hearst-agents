/**
 * Composio Discovery Cache — extracted to break circular dependency.
 *
 * Both connections.ts and discovery.ts need to invalidate the discovery cache
 * when connections change. This module owns the cache state.
 */

interface CacheEntry {
  tools: unknown[];
  expiresAt: number;
}

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function resetDiscoveryCache(userId?: string): void {
  if (!userId) {
    cache.clear();
    return;
  }
  const prefix = `${userId}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateUserDiscovery(userId: string): void {
  resetDiscoveryCache(userId);
}

export function getCacheEntry(key: string): unknown[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt > Date.now()) return entry.tools;
  cache.delete(key);
  return null;
}

export function setCacheEntry(key: string, tools: unknown[]): void {
  cache.set(key, { tools, expiresAt: Date.now() + TTL_MS });
}
