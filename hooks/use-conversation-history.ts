"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigationStore } from "@/stores/navigation";

/**
 * Charge l'historique d'un thread depuis l'API si les messages en mémoire
 * sont vides (messages volatils non persistés dans le store Zustand).
 *
 * - Ne charge qu'une seule fois par thread par session (loadedRef)
 * - 403 / 404 → silencieux (conversation vide ou inaccessible)
 * - Le hook hydrate le store via addMessageToThread (loop sur les messages)
 */
export function useConversationHistory(threadId: string | null) {
  const messages = useNavigationStore((s) => (threadId ? s.messages[threadId] : undefined));
  const addMessageToThread = useNavigationStore((s) => s.addMessageToThread);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!threadId) return;
    if (messages && messages.length > 0) return;
    if (loadedRef.current.has(threadId)) return;

    loadedRef.current.add(threadId);
    setLoading(true);
    setError(null);

    const capturedThreadId = threadId;
    const controller = new AbortController();

    fetch(`/api/conversations/${capturedThreadId}/messages?limit=50`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 404)
            return {
              messages: [] as Array<{
                id: string;
                role: "user" | "assistant";
                content: string;
                createdAt: string;
              }>,
            };
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<{
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            createdAt: string;
          }>;
        }>;
      })
      .then(({ messages: loaded }) => {
        for (const msg of loaded) {
          addMessageToThread(capturedThreadId, {
            id: msg.id,
            role: msg.role,
            content: msg.content,
          });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") {
          loadedRef.current.delete(capturedThreadId);
          return;
        }
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [threadId, messages, addMessageToThread]);

  return { loading, error };
}
