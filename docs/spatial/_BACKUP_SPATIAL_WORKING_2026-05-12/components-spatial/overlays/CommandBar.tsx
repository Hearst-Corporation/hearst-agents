"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence, useTransform } from "framer-motion";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";
import { SPATIAL_Z_LAYERS } from "@/lib/spatial/constants";
import { useRuntimeStore } from "@/stores/runtime";
import { useNavigationStore, type Message } from "@/stores/navigation";
import { parseSSEChunk } from "@/lib/spatial/sse";

interface CommandBarProps {
  show: boolean;
  /** Si true, force le focus à l'apparition */
  autoFocus?: boolean;
}

/**
 * Barre de commande utilisable.
 * - input réel, placeholder explicite
 * - bouton envoyer visible
 * - Enter déclenche un vrai run /api/orchestrate (pattern ChatDock)
 * - parallax doux via SpatialMouseContext (cohérent avec FloatingPanel)
 *
 * Branchée sur :
 *  - useNavigationStore : crée/récupère le thread, push messages user/assistant
 *  - useRuntimeStore : addEvent dispatch chaque SSE event vers le runtime
 *  - text_delta : update incrémentale du message assistant
 */
export function CommandBar({ show, autoFocus = true }: CommandBarProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const assistantBufferRef = useRef<string>("");
  const currentAssistantIdRef = useRef<string | null>(null);

  const { smoothX, smoothY } = useSpatialMouseContext();
  const rotateX = useTransform(smoothY, [-1, 1], [1.2, -1.2]);
  const rotateY = useTransform(smoothX, [-1, 1], [-1.2, 1.2]);

  const coreState = useRuntimeStore((s) => s.coreState);

  useEffect(() => {
    if (show && autoFocus && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 280);
      return () => clearTimeout(id);
    }
  }, [show, autoFocus]);

  const handleSubmit = useCallback(
    async (text: string) => {
      const runtime = useRuntimeStore.getState();
      const navigation = useNavigationStore.getState();

      // 1. Crée ou récupère un thread
      let threadId = navigation.activeThreadId;
      if (!threadId) {
        threadId = navigation.addThread(text.slice(0, 60), "home");
        navigation.setActiveThread(threadId);
      }

      // 2. Push message user
      const clientToken = `client-${Date.now()}`;
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };
      navigation.addMessageToThread(threadId, userMessage);

      // 3. Push placeholder assistant (sera updated par text_delta)
      assistantBufferRef.current = "";
      currentAssistantIdRef.current = `assistant-${Date.now()}`;
      navigation.addMessageToThread(threadId, {
        id: currentAssistantIdRef.current,
        role: "assistant",
        content: "",
      });

      // 4. Récupère history limité (10 dernières messages textuelles)
      const recentMessages = (navigation.messages[threadId] ?? [])
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0,
        )
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      // 5. Démarre le run + abort controller
      runtime.startRun(clientToken);
      const controller = new AbortController();
      runtime.setAbortController(controller);

      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            surface: "home",
            thread_id: threadId,
            conversation_id: threadId,
            history: recentMessages,
            capability_mode: "general",
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorMsg = `Erreur serveur: ${res.status}`;
          runtime.addEvent({
            type: "run_failed",
            error: errorMsg,
            run_id: clientToken,
            client_token: clientToken,
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";
        let canonicalRunId: string | null = null;

        while (true) {
          if (controller.signal.aborted) break;
          const { done, value: chunk } = await reader.read();
          if (done) break;
          buffer += decoder.decode(chunk, { stream: true });

          const { events, rest } = parseSSEChunk(buffer);
          buffer = rest;

          for (const event of events) {
            // Capture le run_id canonique (transition client- → run_)
            if (event.type === "run_started" && typeof event.run_id === "string") {
              canonicalRunId = event.run_id;
            }

            // Dispatch text_delta : update incrémentale du message assistant
            if (event.type === "text_delta" && typeof event.delta === "string") {
              assistantBufferRef.current += event.delta;
              const id = currentAssistantIdRef.current;
              if (id) {
                useNavigationStore
                  .getState()
                  .updateMessageInThread(threadId, id, assistantBufferRef.current);
              }
            }

            const eventRunId =
              (event.run_id as string | undefined) ?? canonicalRunId ?? clientToken;
            runtime.addEvent({ ...event, run_id: eventRunId });
          }
        }
      } catch (err) {
        const isAbort =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (isAbort) return;

        const errorMsg = err instanceof Error ? err.message : "Échec de la connexion";
        runtime.addEvent({ type: "run_failed", error: errorMsg, run_id: clientToken });
      } finally {
        useRuntimeStore.getState().setAbortController(null);
      }
    },
    [],
  );

  function onFormSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setValue("");
    void handleSubmit(text).finally(() => setSubmitting(false));
  }

  const canSubmit = value.trim().length > 0 && !submitting;
  const isRunning = coreState === "streaming" || coreState === "processing";

  return (
    <div
      className="absolute inset-x-0 bottom-8 flex items-center justify-center pointer-events-none md:[perspective:1400px]"
      style={{ zIndex: SPATIAL_Z_LAYERS.surface }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96, filter: "blur(14px)" }}
            animate={{
              opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
              transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.45 },
            }}
            exit={{
              opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)",
              transition: { duration: 0.6, ease: [0.4, 0, 1, 1] },
            }}
            style={{ rotateX, rotateY }}
            className="pointer-events-auto w-full max-w-[560px] px-6"
          >
            <form onSubmit={onFormSubmit} className="relative">
              <div
                className="relative flex items-center overflow-hidden rounded-[32px] transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(22px) saturate(130%)",
                  WebkitBackdropFilter: "blur(22px) saturate(130%)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px -16px rgba(0,0,0,0.5)",
                }}
              >
                {/* Glyphe gauche */}
                <div className="pl-7 pr-3 text-white/40 text-spatial-xl leading-none select-none">
                  ✦
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={isRunning ? "Hearst orchestre…" : "Demandez à Hearst…"}
                  aria-label="Demande à Hearst"
                  className="flex-1 bg-transparent border-none outline-none text-white/95 placeholder:text-white/35 py-5 text-spatial-xl font-light tracking-wide focus:ring-0"
                />

                <button
                  type="submit"
                  disabled={!canSubmit}
                  aria-label="Envoyer"
                  className="mr-3 my-2 rounded-[20px] px-5 py-2 text-spatial-base font-light uppercase tracking-[0.18em] transition-all duration-300 disabled:cursor-not-allowed"
                  style={
                    canSubmit
                      ? {
                          background: "rgba(255,255,255,0.12)",
                          color: "rgba(255,255,255,0.9)",
                          border: "1px solid rgba(255,255,255,0.16)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                >
                  {submitting ? "…" : "Envoyer"}
                </button>
              </div>

              {/* Hint Enter */}
              <div className="mt-3 flex items-center justify-center gap-2 text-white/30 text-spatial-sm tracking-[0.32em] uppercase font-light">
                <span>Entrée</span>
                <span className="opacity-60">pour orchestrer</span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
