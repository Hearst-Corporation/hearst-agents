"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { toast } from "@/app/hooks/use-toast";
import { useConversationHistory } from "@/hooks/use-conversation-history";
import type { Message } from "@/lib/core/types";
import { getAllServices } from "@/lib/integrations/catalog";
import type { ServiceWithConnectionStatus } from "@/lib/integrations/types";
import { useChatContext } from "@/stores/chat-context";
import { useChatStageStore } from "@/stores/chat-stage";
import { useNavigationStore } from "@/stores/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useServicesStore } from "@/stores/services";
import { type StagePayload, useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { StageFooter } from "./_shell/StageFooter";
import { ChatInput } from "./ChatInput";

/**
 * Pousse un event SSE vers `useChatStageStore` en plus des écritures existantes
 * dans `useNavigationStore` / `useRuntimeStore`. Side-effect hors render, lookup
 * via `getState()` pour éviter de re-render ChatDock à chaque tick SSE.
 *
 * `assistantMessageId` est l'id stable du message assistant courant (créé au
 * début du run), utilisé pour concaténer les `text_delta` dans le même message.
 */
function pushSseEventToChatStage(
  event: {
    type?: string;
    delta?: string;
    step_id?: string;
    tool?: string;
    error?: string;
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  },
  assistantMessageId: string,
): void {
  const store = useChatStageStore.getState();
  switch (event.type) {
    case "text_delta": {
      if (typeof event.delta === "string" && event.delta.length > 0) {
        store.appendAssistantDelta(event.delta, assistantMessageId);
      }
      return;
    }
    case "tool_call_started": {
      if (event.step_id && event.tool) {
        store.addToolCall({
          id: event.step_id,
          name: event.tool,
          state: "running",
        });
      }
      return;
    }
    case "tool_call_completed": {
      if (event.step_id) {
        store.updateToolCall(event.step_id, {
          state: "done",
          endedAt: Date.now(),
        });
      }
      return;
    }
    case "tool_call_failed": {
      if (event.step_id) {
        store.updateToolCall(event.step_id, {
          state: "error",
          endedAt: Date.now(),
          error: event.error,
        });
      }
      return;
    }
    case "run_completed": {
      store.finalizeAssistantMessage(assistantMessageId);
      store.setRunState("done");
      return;
    }
    case "run_failed": {
      store.setRunState("error", event.error);
      return;
    }
    case "run_cost": {
      if (
        typeof event.input_tokens === "number" &&
        typeof event.output_tokens === "number" &&
        typeof event.cost_usd === "number"
      ) {
        store.setTokenEstimate({
          input: event.input_tokens,
          output: event.output_tokens,
          cost: event.cost_usd,
        });
      }
      return;
    }
    default:
      return;
  }
}

function trackAnalytics(
  type: "first_message_sent" | "run_completed" | "run_failed",
  properties?: Record<string, unknown>,
) {
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, properties }),
  }).catch((err) => {
    // Best-effort — on log en dev uniquement pour ne pas spammer Sentry/prod.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Analytics] Failed:", err);
    }
  });
}

const baseServices: ServiceWithConnectionStatus[] = getAllServices().map((s) => ({
  ...s,
  connectionStatus: "disconnected" as const,
}));

export function ChatDock() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const surface = useNavigationStore((s) => s.surface);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const messagesRaw = useNavigationStore((s) =>
    activeThreadId ? s.messages[activeThreadId] : undefined,
  );
  const messages = useMemo(() => messagesRaw ?? [], [messagesRaw]);
  const addMessageToThread = useNavigationStore((s) => s.addMessageToThread);
  const addThread = useNavigationStore((s) => s.addThread);
  const updateMessageInThread = useNavigationStore((s) => s.updateMessageInThread);
  const updateThreadName = useNavigationStore((s) => s.updateThreadName);

  useConversationHistory(activeThreadId);

  const addEvent = useRuntimeStore((s) => s.addEvent);
  const startRun = useRuntimeStore((s) => s.startRun);
  const setAbortController = useRuntimeStore((s) => s.setAbortController);

  const setStageMode = useStageStore((s) => s.setMode);
  const setStageModeFromTool = useStageStore((s) => s.setModeFromTool);
  const stageMode = useStageStore((s) => s.current.mode);
  const stageAssetId = useStageStore((s) =>
    s.current.mode === "asset" ? s.current.assetId : null,
  );
  const stageMissionId = useStageStore((s) =>
    s.current.mode === "mission" ? s.current.missionId : null,
  );

  const stageAssetTitle = useStageData((s) => s.asset.assetTitle);

  // Injection automatique du contexte Stage dans les chips du ChatDock.
  // Quand l'utilisateur switch vers un mode avec un objet focal (asset,
  // mission), on ajoute automatiquement le chip correspondant.
  //
  // Pour les assets : le titre (stageAssetTitle) est chargé de manière async
  // par AssetStage via setAsset. On re-exécute quand le titre arrive pour
  // remplacer le label générique par le vrai titre — removeChip puis addChip
  // pour contourner la dédup native (idempotente sur l'id).
  useEffect(() => {
    if (stageMode !== "asset" || !stageAssetId) return;
    const ctx = useChatContext.getState();
    const nextLabel = stageAssetTitle || "Asset";
    // Guard anti-flicker : si le chip existe déjà avec le bon label, on saute
    // le remove+add (qui sert uniquement à mettre à jour le label quand le
    // titre asynchrone remplace le générique "Asset").
    const existing = ctx.chips.find((c) => c.id === stageAssetId);
    if (existing?.label !== nextLabel) {
      ctx.removeChip(stageAssetId);
      ctx.addChip({
        id: stageAssetId,
        kind: "asset",
        label: nextLabel,
      });
    }
    // Cleanup au sortie de stage — sans ça le chip persiste après changement
    // de mode (ex: asset → cockpit) et injecte un faux contexte au prochain run.
    return () => {
      useChatContext.getState().removeChip(stageAssetId);
    };
  }, [stageMode, stageAssetId, stageAssetTitle]);

  useEffect(() => {
    if (stageMode !== "mission" || !stageMissionId) return;
    useChatContext.getState().addChip({
      id: stageMissionId,
      kind: "mission",
      label: "Mission",
    });
    return () => {
      useChatContext.getState().removeChip(stageMissionId);
    };
  }, [stageMode, stageMissionId]);

  const services = useServicesStore((s) => s.services);
  const setStoreServices = useServicesStore((s) => s.setServices);
  const setStoreLoaded = useServicesStore((s) => s.setLoaded);
  const connectedServices = useMemo(
    () => services.filter((s) => s.connectionStatus === "connected"),
    [services],
  );

  // Bootstrap services + handle ?connected= flow.
  useEffect(() => {
    if (services.length === 0) setStoreServices(baseServices);

    async function loadConnections() {
      try {
        const res = await fetch("/api/v2/user/connections", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.services && Array.isArray(data.services)) {
          setStoreServices(data.services as ServiceWithConnectionStatus[]);
        }
      } catch {
        /* non-fatal */
      } finally {
        setStoreLoaded(true);
      }
    }

    const justConnected = searchParams.get("connected");
    if (justConnected) {
      void fetch("/api/composio/invalidate-cache", { method: "POST", credentials: "include" })
        .catch(() => {})
        .finally(() => {
          loadConnections();
          const params = new URLSearchParams(searchParams.toString());
          params.delete("connected");
          const newUrl = pathname + (params.toString() ? `?${params.toString()}` : "");
          router.replace(newUrl);
          toast.success(`${justConnected} connecté`, "Vous pouvez relancer votre demande.");
        });
      return;
    }

    // Évite la double requête si HomePageClient a déjà chargé les connexions
    if (!useServicesStore.getState().loaded) {
      loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router.replace, setStoreServices, setStoreLoaded, services.length, pathname]);

  const assistantBufferRef = useRef<string>("");
  const currentAssistantIdRef = useRef<string | null>(null);

  // Garde-fou pour les setTimeout différés (setReconnectAnnouncement 3s après
  // la fin du retry) — évite un setState orphelin si l'utilisateur change de
  // page entre-temps.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // État visuel du backoff SSE : compteur visible pendant les retries +
  // détection offline. null = pas de retry en cours.
  const [reconnectInfo, setReconnectInfo] = useState<{
    attempt: number;
    total: number;
    secondsLeft: number;
    offline: boolean;
  } | null>(null);

  // Annonce SR séparée du countdown (qui spam chaque seconde). Mute uniquement
  // au démarrage du retry et à la fin → polite, sans bruit.
  const [reconnectAnnouncement, setReconnectAnnouncement] = useState<string>("");

  const handleSubmit = useCallback(
    async (message: string, opts?: { attachedAssetIds?: string[] }) => {
      // Si on n'est pas sur la page racine, on y revient pour que l'utilisateur
      // voie le Stage chat se mettre à jour avec ses messages.
      if (pathname !== "/") {
        router.push("/");
      }

      const threadId = activeThreadId ?? addThread("New", surface);
      const clientToken = `client-${Date.now()}`;
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
      };
      addMessageToThread(threadId, userMessage);

      if (stageMode === "cockpit") {
        setStageMode({ mode: "chat", threadId });
      }

      const currentMessages = useNavigationStore.getState().messages[threadId] ?? [];
      if (currentMessages.length <= 1) {
        trackAnalytics("first_message_sent", { threadId });
        const raw = message.slice(0, 50);
        const name =
          message.length > 40
            ? raw.lastIndexOf(" ") > 15
              ? raw.slice(0, raw.lastIndexOf(" "))
              : raw.slice(0, 40)
            : message;
        updateThreadName(threadId, name);
      }

      assistantBufferRef.current = "";
      currentAssistantIdRef.current = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: currentAssistantIdRef.current,
        role: "assistant",
        content: "",
      };
      addMessageToThread(threadId, assistantMessage);

      // Miroir vers useChatStageStore : reset + user message + état streaming.
      // Le runId canonique du serveur arrivera plus tard via run_started ;
      // on initialise avec clientToken pour ne pas perdre le tout début du run.
      const chatStage = useChatStageStore.getState();
      chatStage.resetForNewRun(clientToken);
      chatStage.appendUserMessage(message, userMessage.id);
      chatStage.setRunState("streaming");

      const recentMessages = messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      startRun(clientToken);
      const controller = new AbortController();
      setAbortController(controller);

      // SSE reconnect — backoff exponentiel en cas de déconnexion prématurée.
      // Max 3 tentatives supplémentaires (4 total). Chaque retry repart d'un
      // nouveau run LLM (le serveur ne peut pas reprendre un stream SSE).
      const MAX_RECONNECT_ATTEMPTS = 3;
      const BASE_RECONNECT_DELAY_MS = 1000;
      const requestBody = JSON.stringify({
        message,
        surface,
        thread_id: threadId,
        conversation_id: threadId,
        history: recentMessages,
        capability_mode: "general",
        ...(opts?.attachedAssetIds && opts.attachedAssetIds.length > 0
          ? { attached_asset_ids: opts.attachedAssetIds }
          : {}),
      });

      // Tente un fetch SSE. Retourne true si le run s'est complété normalement,
      // false si le stream s'est coupé prématurément (retry possible).
      const attemptStream = async (): Promise<boolean> => {
        let receivedCompletion = false;
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal: controller.signal,
        });
        if (!res.ok) {
          // Différenciation des statuts HTTP : message user-friendly + log
          // technique pour ne pas perdre le code HTTP côté observabilité.
          let msg: string;
          if (res.status === 401 || res.status === 403) {
            msg = "Session expirée, veuillez vous reconnecter.";
          } else if (res.status === 429) {
            msg = "Trop de requêtes — réessayez dans quelques secondes.";
          } else if (res.status >= 500) {
            msg = "Problème serveur — l'équipe a été notifiée.";
          } else {
            msg = `Erreur ${res.status}`;
          }
          toast.error("Échec de l'envoi", msg);
          addEvent({
            type: "run_failed",
            error: `HTTP ${res.status}: ${msg}`,
            run_id: clientToken,
            client_token: clientToken,
          });
          useChatStageStore.getState().setRunState("error", msg);
          return true; // Ne pas retry sur erreur HTTP (4xx/5xx)
        }
        const reader = res.body?.getReader();
        if (!reader) return true;
        const decoder = new TextDecoder();
        let buffer = "";
        let canonicalRunId: string | null = null;

        while (true) {
          if (controller.signal.aborted) return true; // Abandon user, pas de retry
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "run_started" && event.run_id) {
                canonicalRunId = event.run_id as string;
              }
              if (event.type === "run_completed" || event.type === "run_failed") {
                receivedCompletion = true;
              }
              if (event.type === "text_delta" && event.delta) {
                assistantBufferRef.current += event.delta;
                updateMessageInThread(
                  threadId,
                  currentAssistantIdRef.current!,
                  assistantBufferRef.current,
                );
              }
              if (event.type === "stage_request" && event.stage) {
                setStageModeFromTool(event.stage as StagePayload);
              }
              const eventRunId = (event.run_id as string) || canonicalRunId || clientToken;
              addEvent({ ...event, run_id: eventRunId });
              // Miroir vers useChatStageStore (additif, ne casse pas l'existant).
              // Couvre text_delta / tool_call_started / tool_call_completed /
              // run_completed / run_failed. Les autres types sont ignorés.
              if (currentAssistantIdRef.current) {
                pushSseEventToChatStage(event, currentAssistantIdRef.current);
              }
            } catch {}
          }
        }

        if (controller.signal.aborted) return true;

        if (receivedCompletion) {
          trackAnalytics("run_completed", {
            runId: canonicalRunId || clientToken,
            messageCount: messages.length,
          });
        }
        return receivedCompletion;
      };

      let didRetry = false;
      try {
        let completed = false;
        for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            // Backoff exponentiel : 1s, 2s, 4s
            const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);
            const totalSeconds = Math.ceil(delay / 1000);
            const offline = typeof navigator !== "undefined" && navigator.onLine === false;

            // Annonce SR unique au démarrage du retry (pas chaque tick).
            if (attempt === 1) {
              didRetry = true;
              setReconnectAnnouncement("Reconnexion en cours…");
            }

            addEvent({
              type: "orchestrator_log",
              run_id: clientToken,
              message: `Reconnexion SSE (tentative ${attempt}/${MAX_RECONNECT_ATTEMPTS})…`,
            });

            // Si offline, on attend le retour online plutôt que d'épuiser
            // bêtement les tentatives.
            if (offline) {
              setReconnectInfo({
                attempt,
                total: MAX_RECONNECT_ATTEMPTS,
                secondsLeft: totalSeconds,
                offline: true,
              });
              await new Promise<void>((resolve) => {
                let timeoutId: number | undefined;
                const cleanup = () => {
                  if (timeoutId !== undefined) window.clearTimeout(timeoutId);
                  window.removeEventListener("online", onOnline);
                  controller.signal.removeEventListener("abort", onAbort);
                  resolve();
                };
                const onOnline = () => cleanup();
                const onAbort = () => cleanup();
                if (typeof window !== "undefined") {
                  window.addEventListener("online", onOnline, { once: true });
                }
                controller.signal.addEventListener("abort", onAbort, { once: true });
                // Garde-fou : si l'event "online" ne firait jamais, on
                // débloque après le délai max + 10s. Le timeoutId est cleared
                // dans cleanup() pour éviter un leak quand online/abort fire.
                timeoutId = window.setTimeout(cleanup, delay + 10000);
              });
              if (controller.signal.aborted) break;
            }

            // Décompte visible (1s tick) plutôt qu'un setTimeout opaque.
            // Le sleep est abortable — si l'utilisateur abort pendant le
            // countdown, on quitte sans attendre la seconde restante.
            for (let s = totalSeconds; s > 0; s--) {
              if (controller.signal.aborted) break;
              setReconnectInfo({
                attempt,
                total: MAX_RECONNECT_ATTEMPTS,
                secondsLeft: s,
                offline: false,
              });
              await new Promise<void>((resolve) => {
                const t = setTimeout(resolve, 1000);
                controller.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(t);
                    resolve();
                  },
                  { once: true },
                );
              });
              if (controller.signal.aborted) break;
            }
            setReconnectInfo(null);
            if (controller.signal.aborted) break;
            // Reset le buffer pour le nouveau run (réponse repartira from scratch)
            assistantBufferRef.current = "";
          }

          completed = await attemptStream();
          if (completed || controller.signal.aborted) break;
        }

        // Annonce SR de fin de retry (uniquement si on est passé par la
        // branche reconnexion, càd au moins un attempt > 0).
        if (didRetry) {
          if (completed) {
            setReconnectAnnouncement("Connexion rétablie.");
          } else if (!controller.signal.aborted) {
            setReconnectAnnouncement("Connexion perdue après plusieurs tentatives.");
          }
        }

        if (!completed && !controller.signal.aborted) {
          // `navigator.onLine` est peu fiable (true sur captive portal). On
          // garde la branche offline pour un message utile, sans surpromettre
          // une reprise auto : l'écoute de l'event `online` se fait pendant
          // la boucle de retry, pas ici.
          const offline = typeof navigator !== "undefined" && navigator.onLine === false;
          const errorMsg = offline
            ? "Hors ligne — la reconnexion reprendra à votre retour."
            : "Connexion perdue après plusieurs tentatives. Réessaie.";
          toast.error("Connexion SSE perdue", errorMsg);
          addEvent({ type: "run_failed", error: errorMsg, run_id: clientToken });
          useChatStageStore.getState().setRunState("error", errorMsg);
          trackAnalytics("run_failed", { runId: clientToken, error: "sse_reconnect_exhausted" });
        }

        // Abort utilisateur : on retombe en idle côté chat-stage.
        if (controller.signal.aborted) {
          useChatStageStore.getState().setRunState("idle");
        }
      } catch (err) {
        const isAbort =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (isAbort) {
          useChatStageStore.getState().setRunState("idle");
          return;
        }

        const errorMsg = sanitizeApiError(err);
        toast.error("Erreur de connexion", errorMsg);
        addEvent({ type: "run_failed", error: errorMsg, run_id: clientToken });
        useChatStageStore.getState().setRunState("error", errorMsg);
        trackAnalytics("run_failed", { runId: clientToken, error: errorMsg });
      } finally {
        setAbortController(null);
        setReconnectInfo(null);
        // Laisser l'annonce SR visible un instant pour que le screen reader
        // la consomme, puis reset pour ne pas la rejouer plus tard.
        if (didRetry) {
          setTimeout(() => {
            if (mountedRef.current) setReconnectAnnouncement("");
          }, 3000);
        }
      }
    },
    [
      pathname,
      router,
      surface,
      activeThreadId,
      addThread,
      messages,
      addEvent,
      startRun,
      setAbortController,
      addMessageToThread,
      updateMessageInThread,
      updateThreadName,
      stageMode,
      setStageMode,
      setStageModeFromTool,
    ],
  );

  // Sortie explicite du Stage "chat" → repasse en cockpit. Le shell garde
  // la conversation accessible via la liste threads.
  const showCloseButton = stageMode === "chat";
  const handleCloseChat = useCallback(() => {
    setStageMode({ mode: "cockpit" });
  }, [setStageMode]);

  return (
    <div className="relative flex w-full items-center justify-center">
      {/* Indicateur visuel de reconnexion SSE.
          aria-hidden — le countdown 1s spam les SR en polite. L'annonce SR
          passe par <span class="sr-only" role="status"> ci-dessous, qui ne
          mute QU'au start et à la fin du retry. */}
      {reconnectInfo && (
        <div
          aria-hidden="true"
          className="t-11 font-light absolute"
          style={{
            top: "calc(-1 * var(--space-8))",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "var(--space-1-5) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            color: "var(--text-faint)",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {reconnectInfo.offline
            ? "Hors ligne — reprise auto dès retour réseau"
            : `Reconnexion dans ${reconnectInfo.secondsLeft}s… (tentative ${reconnectInfo.attempt}/${reconnectInfo.total})`}
        </div>
      )}

      {/* Annonce SR séparée — change uniquement au start et à la fin du retry,
          polite sans bruit chaque seconde. */}
      <span className="sr-only" role="status" aria-live="polite">
        {reconnectAnnouncement}
      </span>

      <StageFooter />
      <ChatInput onSubmit={handleSubmit} connectedServices={connectedServices} />

      {/* Bouton de fermeture explicite du chat (retour cockpit). */}
      {showCloseButton && (
        <button
          type="button"
          onClick={handleCloseChat}
          aria-label="Fermer le chat"
          title="Fermer le chat"
          className="absolute"
          style={{
            top: "calc(-1 * var(--space-10))",
            right: "var(--space-4)",
            width: "var(--space-7)",
            height: "var(--space-7)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            color: "var(--text-faint)",
            cursor: "pointer",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
