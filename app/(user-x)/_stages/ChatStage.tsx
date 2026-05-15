"use client";

import { motion, type Variants } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Message } from "@/stores/navigation";
import { useNavigationStore } from "@/stores/navigation";
import { useStageStore } from "@/stores/stage";

const MSGS_MAX = 8;

const CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const DOTS_VARIANTS: Variants = {
  animate: {
    transition: { staggerChildren: 0.18 },
  },
};

const DOT_VARIANTS: Variants = {
  animate: {
    y: [0, -5, 0],
    transition: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
  },
};

function TypingIndicator() {
  return (
    <motion.div
      className="flex items-center gap-1 px-1 py-2"
      variants={DOTS_VARIANTS}
      animate="animate"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.35)" }}
          variants={DOT_VARIANTS}
          custom={i}
        />
      ))}
    </motion.div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const isAssistant = msg.role === "assistant";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[75%] rounded-xl px-5 py-3 text-right"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    if (!msg.content) return <TypingIndicator />;
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  // role === "tool" (et "system" si jamais)
  return (
    <div className="flex justify-start">
      <p className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        ⚙ {msg.content}
      </p>
    </div>
  );
}

export function ChatStage({ mode }: { mode: string }) {
  const setMode = useStageStore((s) => s.setMode);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const msgs = useNavigationStore(
    (s) => (s.activeThreadId ? s.messages[s.activeThreadId] : undefined) ?? [],
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const visibleMsgs = msgs.slice(-MSGS_MAX);
  const isEmpty = !activeThreadId || msgs.length === 0;
  const lastMsg = visibleMsgs[visibleMsgs.length - 1];
  const isTyping = lastMsg?.role === "assistant" && lastMsg.content === "";

  return (
    <motion.section
      key={mode}
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
    >
      {isEmpty ? (
        <div className="flex flex-col items-start gap-6">
          <p style={{ color: "rgba(255,255,255,0.5)" }} className="text-sm">
            Aucune conversation active. Commence à parler pour démarrer un thread.
          </p>
          <button
            onClick={() => setMode({ mode: "chat" })}
            className="rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            Nouvelle conversation
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleMsgs.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}
    </motion.section>
  );
}
