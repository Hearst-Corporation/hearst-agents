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
import { type StreamingMessage, type ToolCall, useChatStageStore } from "@/stores/chat-stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Variants ─────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <p
        className="t-15"
        style={{
          color: "rgba(255,255,255,0.45)",
          maxWidth: "440px",
          lineHeight: 1.6,
        }}
      >
        Pose une question, lance une mission, ou laisse l'agent veiller.
      </p>
    </motion.div>
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
          padding: "14px 20px",
          borderRadius: "16px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontSize: "14px",
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.55,
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
            marginLeft: "2px",
            color: "rgba(94,229,195,0.75)",
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
    ? "rgba(255,80,80,0.15)"
    : isRunning
      ? "rgba(94,229,195,0.15)"
      : "rgba(255,255,255,0.08)";
  const miniColor = isError
    ? "rgba(255,140,140,0.9)"
    : isRunning
      ? "rgba(94,229,195,0.85)"
      : "rgba(255,255,255,0.85)";

  // Badge état
  const stateBg = isError
    ? "rgba(255,80,80,0.15)"
    : isRunning
      ? "rgba(94,229,195,0.15)"
      : isDone
        ? "rgba(255,255,255,0.05)"
        : "transparent";
  const stateColor = isError
    ? "rgba(255,140,140,0.9)"
    : isRunning
      ? "rgba(94,229,195,0.85)"
      : isDone
        ? "rgba(255,255,255,0.45)"
        : "rgba(255,255,255,0.35)";

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
          padding: "4px 10px",
          borderRadius: "9999px",
          background: stateBg,
          color: stateColor,
          fontSize: "11px",
          fontWeight: 500,
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

function ErrorBanner({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(255,80,80,0.08)",
        borderLeft: "2px solid rgba(255,120,120,0.55)",
        color: "rgba(255,200,200,0.85)",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur</strong> — {error}
    </motion.div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function ChatStage({ mode }: { mode: string }) {
  const messages = useChatStageStore((s) => s.messages);
  const toolCalls = useChatStageStore((s) => s.toolCalls);
  const runState = useChatStageStore((s) => s.runState);
  const runError = useChatStageStore((s) => s.runError);

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

  const isEmpty = useMemo(
    () => messages.length === 0 && toolCalls.length === 0 && runState === "idle",
    [messages.length, toolCalls.length, runState],
  );

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {isEmpty && <EmptyChatState />}

        {!isEmpty && messages.map((msg, idx) => <ChatBubble key={msg.id} msg={msg} index={idx} />)}

        {toolCalls.length > 0 && <ToolCallList toolCalls={toolCalls} />}

        {runState === "error" && runError && <ErrorBanner error={runError} />}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </motion.section>
  );
}
