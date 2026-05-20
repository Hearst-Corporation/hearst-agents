"use client";

/**
 * usePoll<T> — Hook générique de polling avec gestion d'unmount, AbortController,
 * pause via `enabled`, callbacks `onSuccess` et `onError`.
 *
 * Pourquoi : éviter de redéfinir la même mécanique `setTimeout` + cleanup + cancel
 * dans chaque hook qui doit poller une API (OAuth completion, variant generation,
 * status job, etc.).
 *
 * Garanties :
 *  - Le tick courant est annulable via AbortController (le fetch reçoit `signal`).
 *  - Si `enabled` passe à false en cours de tick, le résultat est ignoré.
 *  - Le timer suivant n'est planifié qu'après la résolution du tick courant
 *    (pas d'empilement même si un fetch dure plus longtemps que l'interval).
 *  - `refresh()` force un tick immédiat hors du cycle.
 *
 * Signature minimaliste : la logique métier (transitions, watchdogs, mémoire
 * d'état) reste à l'appelant. Ce hook ne fait que poller proprement.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePollOptions<T> {
  /** Fonction async à appeler à chaque tick. Reçoit un AbortSignal. */
  fn: (signal: AbortSignal) => Promise<T>;
  /** Intervalle entre deux ticks (ms). */
  intervalMs: number;
  /** Si false, pause le polling. true par défaut. */
  enabled?: boolean;
  /** Délai avant le PREMIER tick (ms). 0 = immédiat. */
  initialDelayMs?: number;
  /** Callback succès — appelé avec le résultat. */
  onSuccess?: (value: T) => void;
  /** Callback erreur — appelé avec l'erreur (hors AbortError). */
  onError?: (err: unknown) => void;
  /** Dépendances de re-arm du polling (redémarre le cycle si l'une change). */
  deps?: unknown[];
}

export interface UsePollResult<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  /** Force un tick immédiat hors du cycle. */
  refresh: () => Promise<void>;
}

export function usePoll<T>(options: UsePollOptions<T>): UsePollResult<T> {
  const {
    fn,
    intervalMs,
    enabled = true,
    initialDelayMs = 0,
    onSuccess,
    onError,
    deps = [],
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Stocker les callbacks dans des refs pour ne pas redéclencher le cycle
  // chaque fois que le parent recrée la closure.
  const fnRef = useRef(fn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    fnRef.current = fn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [fn, onSuccess, onError]);

  // AbortController du tick en cours, accessible aussi à `refresh`.
  const abortRef = useRef<AbortController | null>(null);

  const runTick = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const value = await fnRef.current(controller.signal);
      if (controller.signal.aborted) return;
      setData(value);
      setError(null);
      onSuccessRef.current?.(value);
    } catch (err) {
      if (controller.signal.aborted) return;
      // AbortError standard → silencieux (cycle suivant prendra le relais).
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err);
      onErrorRef.current?.(err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await runTick();
  }, [runTick]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cycle = async () => {
      if (cancelled) return;
      await runTick();
      if (cancelled) return;
      timer = setTimeout(cycle, intervalMs);
    };

    timer = setTimeout(cycle, initialDelayMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, initialDelayMs, runTick, ...deps]);

  return { data, loading, error, refresh };
}
