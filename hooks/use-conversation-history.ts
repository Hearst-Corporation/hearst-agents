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
    // Ne charge pas si des messages sont déjà en mémoire
    if (messages && messages.length > 0) return;
    // Ne recharge pas un thread déjà tenté dans cette session
    if (loadedRef.current.has(threadId)) return;

    loadedRef.current.add(threadId);
    setLoading(true);
    setError(null);

    fetch(`/api/conversations/${threadId}/messages?limit=50`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) return { messages: [] };
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
          addMessageToThread(threadId, {
            id: msg.id,
            role: msg.role,
            content: msg.content,
          });
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [threadId, messages, addMessageToThread]);

  return { loading, error };
}
