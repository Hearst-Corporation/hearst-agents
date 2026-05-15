/**
 * Chat Stage Store — Zustand (VOLATILE)
 *
 * État du run conversationnel courant pour le Stage Chat du shell visionOS.
 * - Lu par `app/(user)/_stages/ChatStage.tsx` (pilote data-bound)
 * - Écrit par `app/(user)/components/ChatDock.tsx` à chaque event SSE
 *   reçu de `/api/orchestrate`.
 *
 * VOLATILE : pas de `persist`, pas de localStorage. Le run vit le temps
 * de la session courante, puis disparaît. Aucune fuite de PII via stockage
 * navigateur (cf. F-077 sur le store navigation).
 */

import { create } from "zustand";

export type ToolCallState = "pending" | "running" | "done" | "error";
export type RunState = "idle" | "streaming" | "done" | "error";

export interface ToolCall {
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  state: ToolCallState;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

export interface StreamingMessage {
  id: string;
  role: "user" | "assistant";
  /** Texte accumulé en streaming (concaténation des deltas). */
  content: string;
  isStreaming: boolean;
}

export interface TokenEstimate {
  input: number;
  output: number;
  cost: number;
}

interface ChatStageState {
  messages: StreamingMessage[];
  toolCalls: ToolCall[];
  runState: RunState;
  runError?: string;
  tokenEstimate?: TokenEstimate;
  currentRunId?: string;

  // Actions
  resetForNewRun: (runId: string) => void;
  appendUserMessage: (content: string, id?: string) => void;
  appendAssistantDelta: (delta: string, messageId?: string) => void;
  finalizeAssistantMessage: (messageId: string) => void;
  addToolCall: (tc: Omit<ToolCall, "startedAt" | "state"> & { state?: ToolCallState }) => void;
  updateToolCall: (id: string, patch: Partial<ToolCall>) => void;
  setRunState: (state: RunState, error?: string) => void;
  setTokenEstimate: (e: TokenEstimate) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  messages: [] as StreamingMessage[],
  toolCalls: [] as ToolCall[],
  runState: "idle" as RunState,
  runError: undefined as string | undefined,
  tokenEstimate: undefined as TokenEstimate | undefined,
  currentRunId: undefined as string | undefined,
};

/**
 * Génère un id côté client. `crypto.randomUUID()` est dispo en runtime
 * navigateur moderne et côté Node 18+. Fallback Math.random pour les
 * environnements de test exotiques.
 */
function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export const useChatStageStore = create<ChatStageState>()((set) => ({
  ...INITIAL_STATE,

  resetForNewRun: (runId) =>
    set({
      ...INITIAL_STATE,
      runState: "streaming",
      currentRunId: runId,
    }),

  appendUserMessage: (content, id) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: id ?? genId(),
          role: "user",
          content,
          isStreaming: false,
        },
      ],
    })),

  appendAssistantDelta: (delta, messageId) =>
    set((state) => {
      // Cas 1 : un messageId explicite est fourni ET existe déjà → concat
      if (messageId) {
        const existing = state.messages.find((m) => m.id === messageId);
        if (existing) {
          return {
            messages: state.messages.map((m) =>
              m.id === messageId ? { ...m, content: m.content + delta } : m,
            ),
          };
        }
        // Cas 2 : messageId fourni mais inexistant → on crée avec cet id
        return {
          messages: [
            ...state.messages,
            {
              id: messageId,
              role: "assistant",
              content: delta,
              isStreaming: true,
            },
          ],
        };
      }
      // Cas 3 : pas de messageId → crée un nouveau message assistant
      return {
        messages: [
          ...state.messages,
          {
            id: genId(),
            role: "assistant",
            content: delta,
            isStreaming: true,
          },
        ],
      };
    }),

  finalizeAssistantMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, isStreaming: false } : m)),
    })),

  addToolCall: (tc) =>
    set((state) => ({
      toolCalls: [
        ...state.toolCalls,
        {
          id: tc.id,
          name: tc.name,
          input: tc.input,
          output: tc.output,
          error: tc.error,
          endedAt: tc.endedAt,
          state: tc.state ?? "pending",
          startedAt: Date.now(),
        },
      ],
    })),

  updateToolCall: (id, patch) =>
    set((state) => ({
      toolCalls: state.toolCalls.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)),
    })),

  setRunState: (runState, error) =>
    set({
      runState,
      runError: runState === "error" ? error : undefined,
    }),

  setTokenEstimate: (e) => set({ tokenEstimate: e }),

  reset: () => set({ ...INITIAL_STATE }),
}));
