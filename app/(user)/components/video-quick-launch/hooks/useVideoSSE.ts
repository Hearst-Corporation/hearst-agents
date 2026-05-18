"use client";

/**
 * useVideoSSE — hook SSE pour la génération vidéo single (mode S2-A).
 *
 * Encapsule l'EventSource ouvert sur `/api/v2/jobs/[jobId]/progress` :
 * gère les events `progress`, `completed`, `failed`, `not_found`, et
 * close/cleanup automatique au unmount.
 *
 * Retourne `{ phase, progress, errorMsg, subscribe, reset, close }` —
 * l'appelant gère le reste du flow (création asset, enqueue variant).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Provider, SinglePhase } from "../types";

export interface UseVideoSSEResult {
  phase: SinglePhase;
  setPhase: (p: SinglePhase) => void;
  progress: number;
  setProgress: (p: number) => void;
  errorMsg: string | null;
  setErrorMsg: (m: string | null) => void;
  subscribe: (jobId: string, providerUsed: Provider) => void;
  reset: () => void;
  close: () => void;
}

export function useVideoSSE(): UseVideoSSEResult {
  const [phase, setPhase] = useState<SinglePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setErrorMsg(null);
    close();
  }, [close]);

  const subscribe = useCallback((jobId: string, _providerUsed: Provider) => {
    const url = `/api/v2/jobs/${encodeURIComponent(jobId)}/progress?kind=video-gen`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;
    setPhase("running");

    es.addEventListener("progress", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data) as {
          progress: number;
          label?: string | null;
        };
        if (typeof data.progress === "number") {
          setProgress(data.progress);
        }
      } catch {
        /* payload malformé — ignore */
      }
    });

    es.addEventListener("completed", () => {
      setProgress(100);
      setPhase("done");
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener("failed", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data) as {
          reason?: string;
        };
        setErrorMsg(data.reason ?? "Échec de la génération vidéo");
      } catch {
        setErrorMsg("Échec de la génération vidéo");
      }
      setPhase("error");
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener("not_found", () => {
      setErrorMsg("Job introuvable côté queue.");
      setPhase("error");
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener("session_expired", () => {
      es.close();
      eventSourceRef.current = null;
      // Session expirée côté serveur — rechargement pour déclencher le flow
      // d'authentification NextAuth.
      window.location.reload();
    });

    es.onerror = () => {
      // EventSource retry automatiquement.
    };
  }, []);

  // Cleanup au unmount.
  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return {
    phase,
    setPhase,
    progress,
    setProgress,
    errorMsg,
    setErrorMsg,
    subscribe,
    reset,
    close,
  };
}
