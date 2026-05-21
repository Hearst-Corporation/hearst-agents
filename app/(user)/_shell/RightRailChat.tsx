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
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <aside
      aria-label="Chat avec Kimi"
      className="vision-rail-right preserve-3d relative z-20 hidden xl:flex xl:w-(--width-rail-right) shrink-0 flex-col border-l border-line-strong bg-surface 2xl:w-(--width-rail-right-wide)"
    >
      <div className="ct-rail-right-body">
        <div className="ct-chat">
          <div ref={listRef} className="ct-chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`ct-chat-msg ${msg.role}`}>
                {msg.role === "assistant" && (
                  <div className="ct-chat-msg-avatar" aria-hidden>
                    <svg viewBox="560 455 155 170" width="13" height="14" fill="currentColor">
                      <polygon points="601.74 466.87 572.6 466.87 572.6 609.73 601.74 609.73 601.74 549.07 633.11 579.43 665.76 579.43 601.74 517.46 601.74 466.87" />
                      <polygon points="672.72 466.87 672.72 528.12 644.63 500.93 611.98 500.93 672.72 559.72 672.72 609.73 701.86 609.73 701.86 466.87 672.72 466.87" />
                    </svg>
                  </div>
                )}
                <div className="ct-chat-msg-bubble">{msg.content}</div>
              </div>
            ))}
            {isStreaming && (
              <div className="ct-chat-msg assistant">
                <div className="ct-chat-msg-avatar" aria-hidden>
                  <svg viewBox="560 455 155 170" width="13" height="14" fill="currentColor">
                    <polygon points="601.74 466.87 572.6 466.87 572.6 609.73 601.74 609.73 601.74 549.07 633.11 579.43 665.76 579.43 601.74 517.46 601.74 466.87" />
                    <polygon points="672.72 466.87 672.72 528.12 644.63 500.93 611.98 500.93 672.72 559.72 672.72 609.73 701.86 609.73 701.86 466.87 672.72 466.87" />
                  </svg>
                </div>
                <div className="ct-chat-msg-bubble">
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--ct-accent)",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="ct-chat-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="ct-chat-input"
              placeholder="Demandez à Helm…"
              aria-label="Message à Helm"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
