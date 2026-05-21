"use client";

/**
 * RightRailChat — Chat Kimi dans la colonne de droite.
 *
 * Structure cible (inspirée du ref design) :
 *   .ct-rail-right-body
 *     .ct-chat-root
 *       .ct-chat-actionbar
 *       .ct-chat-list
 *       .ct-chat-form
 *
 * Ce composant est AUTONOME : il gère son propre fetch SSE vers /api/orchestrate.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Styles inline (ref design) ───────────────────────────────────────────────

const RAIL_BODY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
};

const CHAT_ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--border-shell)",
  flexShrink: 0,
  gap: "var(--space-2)",
};

const HEADER_TITLE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-soft)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-1-5)",
};

const HEADER_DOT_STYLE: React.CSSProperties = {
  width: "var(--size-dot)",
  height: "var(--size-dot)",
  borderRadius: "50%",
  background: "var(--accent-teal)",
  boxShadow: "var(--shadow-playhead-accent-teal)",
};

const HEADER_ACTIONS_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-1)",
};

const HEADER_BTN_STYLE: React.CSSProperties = {
  width: "var(--size-compare-handle)",
  height: "var(--size-compare-handle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "transparent",
  color: "var(--text-faint)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  padding: 0,
};

const NEWBTN_STYLE: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--accent-teal)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "var(--space-1) var(--space-2)",
  borderRadius: "var(--radius-sm)",
  transition: "background 0.15s",
};

const LIST_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const MSG_USER_STYLE: React.CSSProperties = {
  alignSelf: "flex-end",
  maxWidth: "85%",
  background: "var(--accent-teal-surface)",
  color: "var(--text)",
  border: "1px solid var(--accent-teal-border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-2-5) var(--space-3-5)",
  fontSize: "13px",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const MSG_ASSISTANT_STYLE: React.CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: "85%",
  background: "var(--surface-1)",
  color: "var(--text-muted)",
  border: "1px solid var(--border-shell)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-2-5) var(--space-3-5)",
  fontSize: "13px",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const FORM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "var(--space-2)",
  padding: "var(--space-3) var(--space-4)",
  borderTop: "1px solid var(--border-shell)",
  flexShrink: 0,
};

const TEXTAREA_STYLE: React.CSSProperties = {
  flex: 1,
  background: "var(--surface-1)",
  border: "1px solid var(--border-shell)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-2-5) var(--space-3)",
  fontSize: "13px",
  color: "var(--text)",
  resize: "none",
  outline: "none",
  minHeight: "var(--size-touch-target)",
  maxHeight: "var(--space-24)",
  fontFamily: "inherit",
};

const SEND_BTN_STYLE: React.CSSProperties = {
  width: "var(--size-avatar-sm)",
  height: "var(--size-avatar-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "transparent",
  color: "var(--accent-teal)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};

const SEND_BTN_DISABLED_STYLE: React.CSSProperties = {
  ...SEND_BTN_STYLE,
  color: "var(--text-ghost)",
  cursor: "not-allowed",
};

// ── Composant principal ──────────────────────────────────────────────────────

export function RightRailChat() {
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Bonjour ! Je suis Kimi K2.6, votre assistant Hearst. Comment puis-je vous aider aujourd'hui ?",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleNewChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Bonjour ! Je suis Kimi K2.6, votre assistant Hearst. Comment puis-je vous aider aujourd'hui ?",
      },
    ]);
    setInputValue("");
  };

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = inputValue.trim();
      if (!text || isStreaming) return;

      // Message user
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Message assistant vide
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      setInputValue("");
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            surface: "chat",
            thread_id: `thread-${Date.now()}`,
            conversation_id: `thread-${Date.now()}`,
            history: messages
              .filter((m) => m.content.trim().length > 0)
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
            capability_mode: "general",
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = res.status >= 500 ? "Problème serveur" : `Erreur ${res.status}`;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: err } : m)),
          );
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "text_delta" && event.delta) {
                assistantBuffer += event.delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: assistantBuffer } : m)),
                );
              }
              if (event.type === "run_completed" || event.type === "run_failed") {
                setIsStreaming(false);
              }
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (!isAbort) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: "Erreur de connexion" } : m)),
          );
        }
        setIsStreaming(false);
      } finally {
        abortRef.current = null;
      }
    },
    [inputValue, isStreaming, messages],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const canSend = inputValue.trim().length > 0 && !isStreaming;

  return (
    <aside
      aria-label="Chat avec Kimi"
      className="vision-rail-right preserve-3d relative z-20 hidden xl:flex xl:w-(--width-rail-right) shrink-0 flex-col border-l border-line-strong bg-surface 2xl:w-(--width-rail-right-wide)"
    >
      <div className="ct-rail-right-body" style={RAIL_BODY_STYLE}>
        <div className="ct-chat-root" style={CHAT_ROOT_STYLE}>
          {/* Header */}
          <div className="ct-chat-header" style={HEADER_STYLE}>
            <div style={HEADER_TITLE_STYLE}>
              <span style={HEADER_DOT_STYLE} />
              <span>Assistant · Hearst Cortex</span>
            </div>
            <div style={HEADER_ACTIONS_STYLE}>
              {/* Historique */}
              <button
                type="button"
                title="Historique"
                style={HEADER_BTN_STYLE}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-faint)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
              {/* Paramètres */}
              <button
                type="button"
                title="Paramètres"
                style={HEADER_BTN_STYLE}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-faint)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.67a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {/* Nouveau */}
              <button
                type="button"
                title="Nouvelle conversation"
                className="ct-chat-newbtn"
                style={NEWBTN_STYLE}
                onClick={handleNewChat}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--accent-teal-surface)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                + Nouveau
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} className="ct-chat-list" style={LIST_STYLE}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`ct-chat-msg ${msg.role}`}
                style={msg.role === "user" ? MSG_USER_STYLE : MSG_ASSISTANT_STYLE}
              >
                <div>{msg.content}</div>
              </div>
            ))}
            {isStreaming && (
              <div className="ct-chat-msg assistant" style={MSG_ASSISTANT_STYLE}>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: "var(--size-dot)",
                      height: "var(--size-dot)",
                      borderRadius: "50%",
                      background: "var(--accent-teal)",
                      animation: "pulse 1.5s infinite",
                      marginRight: "var(--space-1-5)",
                    }}
                  />
                  En cours…
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form className="ct-chat-form" style={FORM_STYLE} onSubmit={(e) => void handleSubmit(e)}>
            <textarea
              ref={textareaRef}
              className="ct-chat-input"
              style={TEXTAREA_STYLE}
              rows={2}
              placeholder="Message à Kimi…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
            />
            <button
              type="submit"
              className="ct-chat-send"
              style={canSend ? SEND_BTN_STYLE : SEND_BTN_DISABLED_STYLE}
              disabled={!canSend}
              aria-label="Envoyer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
