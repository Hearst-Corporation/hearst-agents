"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  agentId: string;
}

export default function ChatWindow({ agentId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // AbortController pour annuler le SSE en cours quand l'utilisateur (re)envoie
  // un message ou que le composant unmount (rend la branche AbortError du
  // catch atteignable).
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll quand un nouveau message arrive (deps sur messages.length,
  // pas []).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Cleanup au unmount : abort tout fetch SSE en vol.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    // Annule l'éventuel run précédent et expose un signal au fetch courant.
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              setMessages((prev) => {
                const currentContent = prev[prev.length - 1].content;
                const newContent = currentContent + data.delta;
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: newContent };
                return copy;
              });
            }
          } catch (err) {
            // Parse SSE défaillant — on log en dev pour identifier les payloads
            // mal formés sans casser le stream global.
            if (process.env.NODE_ENV !== "production") {
              console.warn("[ChatWindow SSE] Parse error:", line, err);
            }
          }
        }
      }
    } catch (err) {
      // Abort user-driven (ex: unmount, navigation) : pas de bubble.
      // Check err.name car AbortError n'est PAS dans err.message.
      if (err instanceof Error && err.name === "AbortError") {
        console.warn("[ChatWindow] SSE aborted (user-driven)");
        return;
      }
      const detail = sanitizeApiError(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Erreur de connexion : ${detail}. Vérifiez votre réseau ou réessayez.`,
        },
      ]);
      console.error("[ChatWindow] SSE fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col rounded-(--radius-md) border border-(--border-shell) bg-surface overflow-hidden"
      style={{ height: "var(--height-admin-prompt-max)" }}
    >
      <div className="flex-1 overflow-y-auto p-(--space-4) space-y-(--space-3)">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-(--radius-sm) px-(--space-3) py-(--space-2) t-13 max-w-[80%] ${
                m.role === "user" ? "bg-surface-2 text-text" : "bg-surface-1 text-text-soft"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-(--border-shell) p-(--space-3) flex gap-(--space-2)">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 rounded-(--radius-sm) bg-bg-soft border border-(--border-input) px-(--space-3) py-(--space-2) t-13 text-text placeholder:text-text-faint focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="t-12 font-medium px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-(--accent-teal)/50 bg-(--accent-teal)/10 text-(--accent-teal) hover:bg-(--accent-teal)/15 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
