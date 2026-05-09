"use client";

/**
 * useOAuthExpiry — Hook partagé pour les connexions OAuth expirantes.
 *
 * Fetch /api/connections/expiring une fois par mount d'arbre, avec un
 * petit cache module-level (TTL 60s) pour dédupliquer entre consommateurs
 * (TimelineRail badge + OAuthExpiryBanner in-page sur /apps). Sans
 * polling — le backend décide de la fraîcheur, et le user reload la page
 * /apps quand il vient de reconnecter.
 *
 * Renvoie aussi un `severity` dérivé :
 *   - "expired" si au moins une connexion `status === "expired"`
 *   - "warn"    si au moins une `status === "expiring_soon"`
 *   - null      sinon (pas de badge)
 */

import { useEffect, useState } from "react";
import type { ExpiringConnection } from "@/lib/connections/oauth-constants";

type Severity = "error" | "warn" | null;

interface CacheEntry {
  connections: ExpiringConnection[];
  fetchedAt: number;
  inFlight: Promise<ExpiringConnection[]> | null;
}

const CACHE_TTL_MS = 60_000;

const cache: CacheEntry = {
  connections: [],
  fetchedAt: 0,
  inFlight: null,
};

const subscribers = new Set<(connections: ExpiringConnection[]) => void>();

function notify() {
  for (const fn of subscribers) fn(cache.connections);
}

async function fetchOnce(): Promise<ExpiringConnection[]> {
  const now = Date.now();
  if (now - cache.fetchedAt < CACHE_TTL_MS && cache.fetchedAt > 0) {
    return cache.connections;
  }
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = (async () => {
    try {
      const res = await fetch("/api/connections/expiring", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return cache.connections;
      const data: { connections?: ExpiringConnection[] } = await res.json();
      if (Array.isArray(data.connections)) {
        cache.connections = data.connections;
        cache.fetchedAt = Date.now();
        notify();
      }
      return cache.connections;
    } catch {
      return cache.connections;
    } finally {
      cache.inFlight = null;
    }
  })();

  return cache.inFlight;
}

export function useOAuthExpiry(): {
  connections: ExpiringConnection[];
  severity: Severity;
  loaded: boolean;
} {
  const [connections, setConnections] = useState<ExpiringConnection[]>(cache.connections);
  const [loaded, setLoaded] = useState(cache.fetchedAt > 0);

  useEffect(() => {
    let cancelled = false;
    const sub = (next: ExpiringConnection[]) => {
      if (!cancelled) setConnections(next);
    };
    subscribers.add(sub);

    void fetchOnce().then(() => {
      if (!cancelled) setLoaded(true);
    });

    return () => {
      cancelled = true;
      subscribers.delete(sub);
    };
  }, []);

  let severity: Severity = null;
  if (connections.some((c) => c.status === "expired")) severity = "error";
  else if (connections.some((c) => c.status === "expiring_soon")) severity = "warn";

  return { connections, severity, loaded };
}
