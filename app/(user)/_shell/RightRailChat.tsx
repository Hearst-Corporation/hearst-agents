"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function RightRailChat() {
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Bonjour. Que voulez-vous orchestrer aujourd'hui ?",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

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
          thread_id: conversationIdRef.current,
          conversation_id: conversationIdRef.current,
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
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: err } : m)));
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
      let failureReason = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(line.indexOf(":") + 1).trim());
            if (event.type === "text_delta" && event.delta) {
              assistantBuffer += event.delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: assistantBuffer } : m)),
              );
            }
            if (event.type === "run_failed") {
              failureReason = event.error || event.reason || event.message || "run_failed";
            }
            if (event.type === "error" && (event.message || event.error)) {
              failureReason = event.message || event.error;
            }
            if (event.type === "run_completed" || event.type === "run_failed") {
              setIsStreaming(false);
            }
          } catch {
            /* ignore malformed */
          }
        }
      }

      if (!assistantBuffer) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: failureReason ? `⚠️ ${failureReason}` : "⚠️ Réponse vide" }
              : m,
          ),
        );
      }
      setIsStreaming(false);
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
  }, [inputValue, isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <aside
      aria-label="Chat avec Kimi"
      className="vision-rail-right preserve-3d relative z-20 hidden xl:flex shrink-0 flex-col"
      style={{
        width: "var(--ct-rail-right)",
        minWidth: "var(--ct-rail-right)",
        background: "var(--surface-1)",
        borderLeft: "1px solid var(--border-shell)",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--border-shell)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2-5, 10px)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "color-mix(in srgb, var(--accent-teal) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-teal) 30%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg viewBox="560 455 155 170" width="12" height="13" fill="var(--accent-teal)">
            <polygon points="601.74 466.87 572.6 466.87 572.6 609.73 601.74 609.73 601.74 549.07 633.11 579.43 665.76 579.43 601.74 517.46 601.74 466.87" />
            <polygon points="672.72 466.87 672.72 528.12 644.63 500.93 611.98 500.93 672.72 559.72 672.72 609.73 701.86 609.73 701.86 466.87 672.72 466.87" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-semibold"
            style={{
              fontSize: 12,
              color: "var(--text)",
              fontFamily: "var(--font-satoshi)",
              letterSpacing: "-0.01em",
            }}
          >
            Kimi
          </div>
          <div
            role="status"
            aria-live="polite"
            className="t-11"
            style={{
              color: isStreaming ? "var(--accent-teal)" : "var(--text-ghost)",
              fontFamily: "var(--font-satoshi)",
              marginTop: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {isStreaming ? (
              <>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--accent-teal)",
                    display: "inline-block",
                    animation: "pulse 1.2s infinite",
                  }}
                />
                En train d&apos;écrire…
              </>
            ) : (
              <>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--color-online)",
                    display: "inline-block",
                  }}
                />
                En ligne
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          title="Nouvelle conversation"
          aria-label="Nouvelle conversation"
          onClick={() => {
            if (abortRef.current) abortRef.current.abort();
            conversationIdRef.current = crypto.randomUUID();
            setMessages([
              {
                id: "welcome",
                role: "assistant",
                content: "Bonjour. Que voulez-vous orchestrer aujourd'hui ?",
              },
            ]);
            setIsStreaming(false);
            setInputValue("");
          }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: "1px solid var(--border-shell)",
            background: "transparent",
            color: "var(--text-ghost)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background = "var(--surface-hover)";
            (e.target as HTMLButtonElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background = "transparent";
            (e.target as HTMLButtonElement).style.color = "var(--text-ghost)";
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isStreaming}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "12px 0",
          minHeight: 0,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              padding: "4px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "assistant" && (
              <div
                className="t-10 font-semibold"
                style={{
                  color: "var(--text-ghost)",
                  fontFamily: "var(--font-satoshi)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-caption)",
                  paddingLeft: 2,
                  marginBottom: 2,
                }}
              >
                Kimi
              </div>
            )}
            <div
              className="t-13"
              style={{
                lineHeight: 1.6,
                fontFamily: "var(--font-satoshi)",
                letterSpacing: "-0.005em",
                padding: msg.role === "user" ? "8px 12px" : "0",
                borderRadius: msg.role === "user" ? 10 : 0,
                background: msg.role === "user" ? "var(--surface-msg-user)" : "transparent",
                border: msg.role === "user" ? "1px solid var(--border-shell)" : "none",
                color: msg.role === "user" ? "var(--text)" : "var(--text-muted)",
                maxWidth: "90%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.content || (
                <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent-teal)",
                      display: "inline-block",
                      animation: "pulse 1.2s infinite",
                    }}
                  />
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent-teal)",
                      display: "inline-block",
                      animation: "pulse 1.2s infinite 0.2s",
                    }}
                  />
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent-teal)",
                      display: "inline-block",
                      animation: "pulse 1.2s infinite 0.4s",
                    }}
                  />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "10px 12px 14px",
          borderTop: "1px solid var(--border-shell)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "var(--surface-1)",
            border: "1px solid var(--border-shell)",
            borderRadius: 12,
            padding: "8px 8px 8px 14px",
            transition: "border-color 0.15s",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-teal)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-shell)";
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            className="ct-chat-input t-14"
            placeholder="Demandez à Kimi…"
            aria-label="Message à Kimi"
            aria-describedby="chat-hint"
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontFamily: "var(--font-satoshi)",
              lineHeight: 1.5,
              resize: "none",
              overflow: "hidden",
              minHeight: 22,
              maxHeight: 120,
              padding: 0,
            }}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isStreaming || !inputValue.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background:
                inputValue.trim() && !isStreaming ? "var(--accent-teal)" : "var(--surface-1)",
              color:
                inputValue.trim() && !isStreaming ? "var(--color-on-accent)" : "var(--text-ghost)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: inputValue.trim() && !isStreaming ? "pointer" : "default",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
            aria-label="Envoyer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div
          id="chat-hint"
          className="t-10"
          style={{
            color: "var(--text-ghost)",
            fontFamily: "var(--font-satoshi)",
            marginTop: 6,
            paddingLeft: 2,
          }}
        >
          Shift+Entrée pour saut de ligne
        </div>
      </div>
    </aside>
  );
}
