"use client";

/**
 * ChatKimi.tsx — Couche de rendu pure du chat Kimi 2.6.
 *
 * Toute la logique d'état et de streaming est dans useChat.ts.
 * Ce composant gère : JSX, textarea, focus, scroll, retry, reset.
 */

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import DOMPurify from "dompurify";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../stores/activeProductStore";
import { useCockpit } from "../shell/context";
import type { ChatMessage } from "./types";
import { useChat } from "./useChat";

// ---------------------------------------------------------------------------
// Markdown léger — pas de lib lourde
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  return (
    text
      .replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        (_m, _lang: string, code: string) =>
          `<pre style="background:rgba(0,0,0,0.4);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0;border:1px solid rgba(255,255,255,0.08)"><code>${escapeHtml(code.trimEnd())}</code></pre>`,
      )
      .replace(
        /`([^`]+)`/g,
        (_m, c: string) =>
          `<code style="background:rgba(0,0,0,0.35);padding:1px 5px;border-radius:3px;font-size:12px">${escapeHtml(c)}</code>`,
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/((?:^[-*] .+$\n?)+)/gm, (block) => {
        const items = block
          .split("\n")
          .filter(Boolean)
          .map(
            (line) =>
              `<li style="margin:2px 0">${line.replace(/^[-*] /, "")}</li>`,
          )
          .join("");
        return `<ul style="padding-left:16px;margin:4px 0">${items}</ul>`;
      })
      .replace(/\n/g, "<br>")
  );
}

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatKimiProps {
  /** Nom du produit en cours, pour le placeholder/contexte. */
  productName?: string;
  /** Accent du produit, pour la pastille + bouton envoyer. */
  productColor?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatKimi({ productName, productColor }: ChatKimiProps = {}) {
  const [input, setInput] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProduct = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const { chatConfig } = useCockpit();

  const { messages, streaming, error, sendMessage, reset } = useChat({
    apiEndpoint: chatConfig.apiEndpoint ?? "/api/cockpit-chat",
    persistence: chatConfig.persistence,
    productId: activeProduct,
  });

  // Auto-scroll
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newConversation = useCallback(() => {
    reset();
    setInput("");
  }, [reset]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || streaming) return;
      setInput("");
      sendMessage(text);
      // Re-focus après envoi.
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [streaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [input, handleSend],
  );

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  const accent = productColor ?? "var(--ct-accent, #8A1538)";

  return (
    <div className="ct-chat-root">
      {/* Action bar */}
      <div className="ct-chat-actionbar">
        <button
          type="button"
          onClick={newConversation}
          title="Nouvelle conversation"
          className="ct-chat-newbtn"
        >
          + Nouveau
        </button>
      </div>

      {/* Messages */}
      <div className="ct-chat-list">
        {messages.length === 0 && !streaming && (
          <p className="ct-placeholder">
            Assistant Kimi K2.6
            {productName ? ` — contexte ${productName}.` : "."}
            <br />
            Pose ta question pour démarrer.
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isStreamingThis={
              streaming &&
              msg.role === "assistant" &&
              msg === messages[messages.length - 1]
            }
            accent={accent}
          />
        ))}

        {error && (
          <div className="ct-chat-error">
            <p>{error}</p>
            <button type="button" onClick={retryLast} className="ct-chat-retry">
              ↻ Réessayer
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        className="ct-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
      >
        <textarea
          ref={textareaRef}
          className="ct-chat-input"
          rows={2}
          placeholder="Message à Kimi…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
        />
        <button
          type="submit"
          className="ct-chat-send"
          disabled={!input.trim() || streaming}
          aria-label="Envoyer"
          style={{ background: input.trim() && !streaming ? accent : undefined }}
        >
          {streaming ? "…" : "↑"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  msg: ChatMessage;
  isStreamingThis: boolean;
  accent: string;
}

function MessageBubble({ msg, isStreamingThis, accent }: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const isEmpty = msg.content === "";

  return (
    <div className={`ct-chat-msg ${isUser ? "user" : "assistant"}`}>
      {isEmpty ? (
        <div className="ct-chat-typing">
          <span />
          <span />
          <span />
        </div>
      ) : isUser ? (
        <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
      ) : (
        <>
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(renderMarkdown(msg.content)),
            }}
          />
          {isStreamingThis && (
            <span className="ct-chat-cursor" style={{ background: accent }} />
          )}
        </>
      )}
    </div>
  );
}

