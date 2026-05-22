"use client";

/**
 * ChatStage — consumer passif data-bound du run conversationnel.
 *
 * Lit `useChatStageStore` (messages, toolCalls, runState) et pousse les
 * tool calls vers `useStageData.shellData` pour alimenter le ContextRail.
 *
 * Pas de mockup : si le store est vide, on affiche l'empty state.
 * Source de vérité : ChatDock écrit dans le store à chaque event SSE.
 */

import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useMemo, useRef } from "react";
import { EmptyState, StageErrorBanner } from "@/app/(user)/components/ui";
import { type StreamingMessage, type ToolCall, useChatStageStore } from "@/stores/chat-stage";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: VISION_EASE },
  },
};

const BUBBLE_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: (idx: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: VISION_EASE, delay: Math.min(idx, 6) * 0.05 },
  }),
};

const TOOLCARD_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: VISION_EASE } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extrait un mono code 2 lettres depuis `gmail.search_threads` → "GM". */
function monoCode(name: string): string {
  const first = name.split(/[._\-/]/)[0] ?? name;
  return first.slice(0, 2).toUpperCase();
}

/** Étiquette FR honnête pour l'état d'un tool call. */
function toolStateLabel(state: ToolCall["state"]): string {
  switch (state) {
    case "running":
      return "en cours";
    case "done":
      return "terminé";
    case "error":
      return "échec";
    case "pending":
    default:
      return "en attente";
  }
}

/** Sub-line : input résumé ou état si pas d'input. */
function toolSubLine(tc: ToolCall): string {
  if (tc.state === "error" && tc.error) return tc.error;
  if (tc.input !== undefined && tc.input !== null) {
    try {
      const str = typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input);
      return str.length > 80 ? `${str.slice(0, 77)}…` : str;
    } catch {
      return "input non sérialisable";
    }
  }
  return toolStateLabel(tc.state);
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function EmptyChatState() {
  return (
    <EmptyState
      title="Prêt à t'aider."
      description="Pose une question, lance une demande, ou laisse l'agent veiller."
      cta={{
        label: "Ouvrir le Commandeur",
        onClick: () => useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "" }),
      }}
    />
  );
}

function ChatBubble({ msg, index }: { msg: StreamingMessage; index: number }) {
  if (msg.role === "user") {
    return (
      <motion.div
        custom={index}
        variants={BUBBLE_VARIANTS}
        initial="hidden"
        animate="visible"
        className="self-end max-w-(--width-chat-bubble-max) rounded-(--radius-2xl) border border-(--border-shell) bg-(--surface-2) t-15 text-text leading-relaxed whitespace-pre-wrap break-words"
        style={{ padding: "var(--space-3) var(--space-5)" }}
      >
        {msg.content}
      </motion.div>
    );
  }

  return (
    <motion.div
      custom={index}
      variants={BUBBLE_VARIANTS}
      initial="hidden"
      animate="visible"
      className="chat-ans whitespace-pre-wrap break-words"
    >
      {msg.content}
      {msg.isStreaming && (
        <span aria-hidden="true" className="animate-pulse inline-block text-(--accent-teal) ml-0.5">
          ▊
        </span>
      )}
    </motion.div>
  );
}

// perf: évite le re-render si tc n'a pas changé (shallow compare)
const ToolCallCard = memo(function ToolCallCard({ tc }: { tc: ToolCall }) {
  const isRunning = tc.state === "running";
  const isError = tc.state === "error";
  const isDone = tc.state === "done";

  const miniClass = isError
    ? "bg-(--danger)/15 text-(--danger)"
    : isRunning
      ? "bg-(--accent-teal-surface) text-(--accent-teal)"
      : "bg-(--surface-2) text-text-soft";

  const stateClass = isError
    ? "bg-(--danger)/15 text-(--danger)"
    : isRunning
      ? "bg-(--accent-teal-surface) text-(--accent-teal)"
      : isDone
        ? "bg-(--surface-1) text-text-faint"
        : "bg-transparent text-text-ghost";

  return (
    <motion.div
      layout
      variants={TOOLCARD_VARIANTS}
      initial="hidden"
      animate="visible"
      className="tcard"
    >
      <div className={`t-mini ${miniClass}`}>{monoCode(tc.name)}</div>
      <div className="t-body">
        <div className="t-name">{tc.name}</div>
        <div className="t-sub">{toolSubLine(tc)}</div>
      </div>
      <div
        className={`t-state t-9 font-medium rounded-pill ${stateClass}`}
        style={{ padding: "var(--space-1) var(--space-2-5)" }}
      >
        {toolStateLabel(tc.state)}
      </div>
    </motion.div>
  );
});

function ToolCallList({ toolCalls }: { toolCalls: readonly ToolCall[] }) {
  return (
    <div className="tools">
      <AnimatePresence initial={false}>
        {toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} tc={tc} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function StreamingPlaceholder() {
  // Visible quand runState === "streaming" sans message/delta/tool encore
  // rendu — confirme à l'utilisateur que l'agent a démarré sa réflexion.
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: VISION_EASE }}
      role="status"
      aria-live="polite"
      className="flex items-center gap-(--space-2-5) rounded-xl border-l-2 border-(--accent-teal) bg-(--accent-teal-surface) t-13 text-text-muted leading-relaxed max-w-fit"
      style={{ padding: "var(--space-3) var(--space-4)" }}
    >
      <span aria-hidden="true" className="animate-pulse text-(--accent-teal) t-15">
        ●
      </span>
      <span>L'agent prépare sa réponse</span>
    </motion.div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

/**
 * ChatStage : conversationnel pur, pas de header eyebrow/title/subtitle.
 * Les messages forment l'identité visuelle ; ajouter un StageLayout briserait
 * l'UX chat immersive. Le stage est intentionnellement headerless.
 */

export function ChatStage({ mode }: { mode: string }) {
  const messages = useChatStageStore((s) => s.messages);
  const toolCalls = useChatStageStore((s) => s.toolCalls);
  const runState = useChatStageStore((s) => s.runState);
  const runError = useChatStageStore((s) => s.runError);

  const isEmpty = useMemo(
    () => messages.length === 0 && toolCalls.length === 0 && runState === "idle",
    [messages.length, toolCalls.length, runState],
  );

  // Pousse les 5 derniers tool calls dans shellData → ContextRail miroir
  useEffect(() => {
    const items: RailItem[] =
      toolCalls.length === 0
        ? []
        : toolCalls
            .slice(-5)
            .reverse()
            .map((tc) => ({
              t: tc.name,
              s: toolStateLabel(tc.state),
              hot: tc.state === "running",
            }));
    useStageData.getState().setShellData("Outils actifs", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [toolCalls]);

  // Auto-scroll vers le bas à chaque update messages/toolCalls
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, toolCalls]);

  // Run lancé mais aucun contenu assistant visible encore. On vérifie que
  // l'assistant n'a pas encore émis de delta (pas messages.length === 0
  // qui rate le cas où seul le message user est dans le store pendant
  // les 2-3s de reasoning silencieux de Kimi avant le 1er token).
  const isStreamingSilent = useMemo(
    () =>
      runState === "streaming" &&
      toolCalls.length === 0 &&
      !messages.some((m) => m.role === "assistant" && m.content.length > 0),
    [runState, messages, toolCalls.length],
  );

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      <div className="flex flex-col gap-8">
        {isEmpty && <EmptyChatState />}

        {!isEmpty && messages.map((msg, idx) => <ChatBubble key={msg.id} msg={msg} index={idx} />)}

        {toolCalls.length > 0 && <ToolCallList toolCalls={toolCalls} />}

        {isStreamingSilent && <StreamingPlaceholder />}

        {runState === "error" && runError && <StageErrorBanner message={runError} />}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </motion.section>
  );
}
