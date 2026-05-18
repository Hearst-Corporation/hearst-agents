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
import { useEffect, useMemo, useRef } from "react";
import { EmptyState } from "@/app/(user)/components/ui";
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
        style={{
          alignSelf: "flex-end",
          maxWidth: "80%",
          padding: "var(--space-3-5) var(--space-5)",
          borderRadius: "var(--radius-lg)",
          background: "var(--card-flat-bg)",
          border: "1px solid var(--border-input)",
          fontSize: "var(--text-base)",
          color: "var(--text-soft)",
          lineHeight: "var(--leading-comfortable)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
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
      className="chat-ans"
      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
    >
      {msg.content}
      {msg.isStreaming && (
        <span
          aria-hidden="true"
          className="animate-pulse"
          style={{
            display: "inline-block",
            marginLeft: "var(--space-0-5)",
            color: "var(--accent-teal)",
          }}
        >
          ▊
        </span>
      )}
    </motion.div>
  );
}

function ToolCallCard({ tc }: { tc: ToolCall }) {
  const isRunning = tc.state === "running";
  const isError = tc.state === "error";
  const isDone = tc.state === "done";

  // Couleurs mono pill : teal sourd pour running, blanc sourd sinon, rouge pour erreur
  const miniBg = isError
    ? "var(--danger-surface)"
    : isRunning
      ? "var(--accent-teal-surface)"
      : "var(--border-input)";
  const miniColor = isError
    ? "var(--danger)"
    : isRunning
      ? "var(--accent-teal)"
      : "var(--text-soft)";

  // Badge état
  const stateBg = isError
    ? "var(--danger-surface)"
    : isRunning
      ? "var(--accent-teal-surface)"
      : isDone
        ? "var(--surface-1)"
        : "transparent";
  const stateColor = isError
    ? "var(--danger)"
    : isRunning
      ? "var(--accent-teal)"
      : isDone
        ? "var(--text-faint)"
        : "var(--text-l2)";

  return (
    <motion.div
      layout
      variants={TOOLCARD_VARIANTS}
      initial="hidden"
      animate="visible"
      className="tcard"
    >
      <div className="t-mini" style={{ background: miniBg, color: miniColor }}>
        {monoCode(tc.name)}
      </div>
      <div className="t-body">
        <div className="t-name">{tc.name}</div>
        <div className="t-sub">{toolSubLine(tc)}</div>
      </div>
      <div
        className="t-state"
        style={{
          padding: "var(--space-1) var(--space-2-5)",
          borderRadius: "var(--radius-pill)",
          background: stateBg,
          color: stateColor,
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-medium)",
        }}
      >
        {toolStateLabel(tc.state)}
      </div>
    </motion.div>
  );
}

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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2-5)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: "var(--accent-teal-surface)",
        borderLeft: "2px solid var(--accent-teal-border)",
        color: "var(--text-muted)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-comfortable)",
        maxWidth: "fit-content",
      }}
    >
      <span
        aria-hidden="true"
        className="animate-pulse"
        style={{ color: "var(--accent-teal)", fontSize: "var(--text-base)" }}
      >
        ●
      </span>
      <span>L'agent prépare sa réponse</span>
    </motion.div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "var(--space-3-5) var(--space-4-5)",
        borderRadius: "var(--radius-md)",
        background: "var(--danger-surface-soft)",
        borderLeft: "2px solid var(--danger-border)",
        color: "var(--danger)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-comfortable)",
      }}
    >
      <strong style={{ color: "var(--danger)", fontWeight: "var(--weight-semibold)" }}>
        Erreur
      </strong>{" "}
      — {error}
    </motion.div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {isEmpty && <EmptyChatState />}

        {!isEmpty && messages.map((msg, idx) => <ChatBubble key={msg.id} msg={msg} index={idx} />)}

        {toolCalls.length > 0 && <ToolCallList toolCalls={toolCalls} />}

        {isStreamingSilent && <StreamingPlaceholder />}

        {runState === "error" && runError && <ErrorBanner error={runError} />}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </motion.section>
  );
}
