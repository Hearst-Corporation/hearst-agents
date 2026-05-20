"use client";

/**
 * useOAuthCompletionPoll — détecte la fin d'un flow OAuth Composio.
 *
 * Pourquoi un hook : Composio termine le flow OAuth sur leur propre page
 * `platform.composio.dev/redirect?status=success`, pas sur notre redirectUri.
 * Conséquence : la popup ne navigue jamais vers /apps?connected=<slug>, donc
 * notre callback `useEffect` ne s'exécute pas, et `postMessage` est bloqué
 * cross-origin (l'origin de la popup reste celui de Composio).
 *
 * Solution : pendant que le store OAuth est en `opening` ou `active`, on
 * poll `/api/composio/connections`. Dès que le slug visé apparaît avec
 * status ACTIVE (et n'y était pas au démarrage du flow), on déclenche le
 * callback `onSuccess`, on ferme la popup et on bascule le store en
 * `success`. Le polling s'arrête automatiquement quand le store sort de
 * l'état "en cours".
 *
 * Fréquence : 2 500 ms — suffisamment court pour que l'utilisateur voie
 * la confirmation rapidement après avoir cliqué "close" dans la popup
 * Composio, suffisamment long pour ne pas saturer l'API.
 *
 * Implémenté sur `usePoll<T>` (hooks/usePoll.ts) — gestion d'unmount,
 * AbortController et pause via `enabled` mutualisés.
 */

import { useCallback, useEffect, useRef } from "react";
import { usePoll } from "@/hooks/usePoll";
import { useOAuthStore } from "@/stores/oauth";

const POLL_INTERVAL_MS = 2500;

interface ComposioConnection {
  appName: string;
  status: string;
}

export function useOAuthCompletionPoll(onSuccess: (slug: string) => void) {
  const status = useOAuthStore((s) => s.status);
  const slug = useOAuthStore((s) => s.slug);

  // Baseline des slugs déjà actifs au démarrage — évite de re-déclencher
  // sur un slug qui était déjà ACTIVE avant le flow.
  const initialActiveSlugsRef = useRef<Set<string> | null>(null);

  // Capture la dernière référence du callback dans une ref.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const enabled = (status === "opening" || status === "active") && Boolean(slug);
  const slugLower = slug?.toLowerCase() ?? "";

  // Reset baseline quand on sort du flow.
  useEffect(() => {
    if (!enabled) {
      initialActiveSlugsRef.current = null;
    }
  }, [enabled]);

  const fetchConnections = useCallback(
    async (signal: AbortSignal): Promise<ComposioConnection[]> => {
      const res = await fetch("/api/composio/connections", {
        credentials: "include",
        signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { connections?: ComposioConnection[] };
      return data.connections ?? [];
    },
    [],
  );

  const handleSuccess = useCallback(
    (conns: ComposioConnection[]) => {
      if (!slug) return;

      // Premier tick : capture la baseline.
      if (initialActiveSlugsRef.current === null) {
        initialActiveSlugsRef.current = new Set(
          conns
            .filter((c) => c.status.toUpperCase() === "ACTIVE")
            .map((c) => c.appName.toLowerCase()),
        );
        return;
      }

      const isActiveNow = conns.some(
        (c) => c.appName.toLowerCase() === slugLower && c.status.toUpperCase() === "ACTIVE",
      );
      const wasActiveBefore = initialActiveSlugsRef.current.has(slugLower);

      if (isActiveNow && !wasActiveBefore) {
        const { popup } = useOAuthStore.getState();
        if (popup && !popup.closed) popup.close();
        useOAuthStore.getState().setStatus("success");
        onSuccessRef.current(slug);
      }
    },
    [slug, slugLower],
  );

  usePoll<ComposioConnection[]>({
    fn: fetchConnections,
    intervalMs: POLL_INTERVAL_MS,
    initialDelayMs: POLL_INTERVAL_MS,
    enabled,
    onSuccess: handleSuccess,
    deps: [slug, status],
  });
}
