/**
 * F-113 — Protection slowloris : utilitaire de timeout pour tous les fetch() externes.
 *
 * Utilisation :
 *   import { fetchWithTimeout } from "@/lib/platform/fetch-timeout";
 *   const res = await fetchWithTimeout(url, { method: "POST", ... });
 *   // Par défaut : 30s. Surcharger : fetchWithTimeout(url, opts, 10_000)
 *
 * Note : si le fetch passe déjà un `signal`, il est combiné via AbortSignal.any()
 * (Node 20+). Sur Node < 20, le signal caller est ignoré et seul le timeout
 * est actif — acceptable car les connexions longues sont bloquées dans tous
 * les cas.
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 30_000; // 30s — suffisant pour APIs externes

/**
 * Wrapper autour de `fetch()` qui ajoute un AbortController timeout.
 * Compatible avec toute options passée à fetch natif.
 * Le signal de timeout est fusionné avec un éventuel signal existant via
 * `AbortSignal.any()` si disponible (Node 20+).
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(
    () => controller.abort(new Error(`fetch timeout after ${timeoutMs}ms`)),
    timeoutMs,
  );

  let signal: AbortSignal = controller.signal;

  // Fusionne avec un signal existant si AbortSignal.any() est disponible (Node 20+)
  if (init?.signal && typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    signal = (AbortSignal as { any: (signals: AbortSignal[]) => AbortSignal }).any([
      controller.signal,
      init.signal as AbortSignal,
    ]);
  }

  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(tid);
  }
}
