/**
 * Navigation Store — Zustand
 *
 * Gère sidebar, threads, surface state.
 * Remplace : SidebarContext + SurfaceContext
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Surface = "home" | "inbox" | "calendar" | "files" | "tasks" | "apps" | "settings";

export interface MessageAssetRef {
  id: string;
  title: string;
  type: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  assetRef?: MessageAssetRef;
}

export interface Thread {
  id: string;
  name: string;
  surface: Surface;
  lastActivity: number;
  pinned?: boolean;
  archived?: boolean;
}

interface NavigationState {
  // Left rail collapse (desktop)
  leftCollapsed: boolean;
  toggleLeftCollapsed: () => void;

  // Left drawer (mobile only — volatile, not persisted)
  leftDrawerOpen: boolean;
  closeLeftDrawer: () => void;
  toggleLeftDrawer: () => void;

  // Surface
  surface: Surface;
  setSurface: (surface: Surface) => void;

  // Threads
  threads: Thread[];
  activeThreadId: string | null;
  addThread: (name: string, surface: Surface) => string;
  setActiveThread: (id: string | null) => void;
  updateThreadName: (id: string, name: string) => void;
  removeThread: (id: string) => void;
  togglePinned: (id: string) => void;
  toggleArchived: (id: string) => void;

  // Messages per thread
  messages: Record<string, Message[]>;
  addMessageToThread: (threadId: string, message: Message) => void;
  updateMessageInThread: (threadId: string, messageId: string, content: string) => void;
  attachAssetToLastAssistantMessage: (threadId: string, assetRef: MessageAssetRef) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set, get) => ({
      // Initial state
      leftCollapsed: false,
      leftDrawerOpen: false,
      surface: "home",
      threads: [],
      activeThreadId: null,
      messages: {},

      // Left rail collapse
      toggleLeftCollapsed: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),

      // Left drawer (mobile)
      closeLeftDrawer: () => set({ leftDrawerOpen: false }),
      toggleLeftDrawer: () => set((state) => ({ leftDrawerOpen: !state.leftDrawerOpen })),

      // Surface
      setSurface: (surface) => {
        set({ surface });
        // Update active thread surface
        const { activeThreadId } = get();
        if (activeThreadId) {
          set((state) => ({
            threads: state.threads.map((t) =>
              t.id === activeThreadId ? { ...t, surface, lastActivity: Date.now() } : t
            ),
          }));
        }
      },

      // Threads
      addThread: (name, surface) => {
        const id = `thread-${Date.now()}`;
        set((state) => ({
          threads: [
            { id, name, surface, lastActivity: Date.now() },
            ...state.threads,
          ],
          activeThreadId: id,
        }));
        return id;
      },

      setActiveThread: (id) => {
        // Sélectionner un thread ferme le drawer mobile (UX standard).
        set({ activeThreadId: id, leftDrawerOpen: false });
        if (id) {
          const thread = get().threads.find((t) => t.id === id);
          if (thread) {
            set({ surface: thread.surface });
          }
        }
      },

      updateThreadName: (id, name) =>
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === id ? { ...t, name, lastActivity: Date.now() } : t
          ),
        })),

      removeThread: (id) =>
        set((state) => {
          const newThreads = state.threads.filter((t) => t.id !== id);
          const newActiveId = state.activeThreadId === id
            ? newThreads[0]?.id || null
            : state.activeThreadId;
          // Also clean up messages for removed thread
          const { [id]: _, ...remainingMessages } = state.messages;
          return {
            threads: newThreads,
            activeThreadId: newActiveId,
            messages: remainingMessages
          };
        }),

      togglePinned: (id) =>
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === id ? { ...t, pinned: !t.pinned } : t
          ),
        })),

      toggleArchived: (id) =>
        set((state) => {
          const newThreads = state.threads.map((t) =>
            t.id === id ? { ...t, archived: !t.archived } : t
          );
          const target = newThreads.find((t) => t.id === id);
          const becameArchived = target?.archived === true;
          const newActiveId =
            becameArchived && state.activeThreadId === id ? null : state.activeThreadId;
          return { threads: newThreads, activeThreadId: newActiveId };
        }),

      // Messages per thread
      addMessageToThread: (threadId, message) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [threadId]: [...(state.messages[threadId] || []), message],
          },
        })),

      updateMessageInThread: (threadId, messageId, content) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [threadId]: (state.messages[threadId] || []).map((m) =>
              m.id === messageId ? { ...m, content } : m
            ),
          },
        })),

      attachAssetToLastAssistantMessage: (threadId, assetRef) =>
        set((state) => {
          const list = state.messages[threadId] || [];
          let lastAssistantIdx = -1;
          for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].role === "assistant") {
              lastAssistantIdx = i;
              break;
            }
          }
          if (lastAssistantIdx === -1) return state;
          const next = [...list];
          next[lastAssistantIdx] = { ...next[lastAssistantIdx], assetRef };
          return { messages: { ...state.messages, [threadId]: next } };
        }),

    }),
    {
      name: "hearst-navigation",
      version: 3, // Bump version pour F-077 : no message content in localStorage
      migrate: (persisted: unknown) => {
        const s = (persisted ?? {}) as Partial<NavigationState>;
        const cleaned = (s.threads ?? []).filter(
          (t) => !(t.id === "default" && t.name === "Accueil"),
        );
        return {
          ...s,
          threads: cleaned,
          activeThreadId:
            s.activeThreadId === "default" ? null : s.activeThreadId ?? null,
          messages: {}, // F-077: Reset all messages—never persist content in localStorage
        } as NavigationState;
      },
      partialize: (state) => {
        // F-077: Persist seulement les métadonnées de threads (id/name/surface),
        // jamais le contenu des messages (PII/secrets). Les messages sont
        // chargés depuis l'API à chaque session.
        const cleanedThreads = state.threads.map((t) => ({
          id: t.id,
          name: t.name,
          surface: t.surface,
          lastActivity: t.lastActivity,
          pinned: t.pinned,
          archived: t.archived,
        })) as NavigationState["threads"];

        return {
          threads: cleanedThreads,
          activeThreadId: state.activeThreadId,
          surface: state.surface,
          messages: {}, // Never persist — PII hazard
          leftCollapsed: state.leftCollapsed,
        } as NavigationState;
      },
    }
  )
);
