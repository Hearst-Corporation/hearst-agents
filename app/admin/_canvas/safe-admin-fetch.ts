"use client";

/**
 * Fetch JSON admin-safe : retourne null sur erreur réseau, non-200, ou timeout.
 * Cookies d'auth envoyés via "include". Un retry sur 5xx (backoff 300ms).
 */
export async function fetchAdminJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const opts: RequestInit = { credentials: "include", ...init };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(300);
      const res = await fetch(url, opts);
      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) continue;
        return null;
      }
      return (await res.json()) as T;
    } catch {
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
