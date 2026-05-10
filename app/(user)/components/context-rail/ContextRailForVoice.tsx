"use client";

/**
 * Sub-rail Stage "voice" — transcript live (10 derniers entries),
 * tool receipts, available tools, voice settings + bouton « Lier au
 * thread » (best-effort PATCH /api/v2/voice/transcripts/:sessionId).
 */

import { useVoiceStore } from "@/stores/voice";
import { useServicesStore } from "@/stores/services";
import { useNavigationStore } from "@/stores/navigation";
import { voiceToolDefs, VOICE_TOOL_LABELS } from "@/lib/voice/tool-defs";
import { ProviderChip } from "../ProviderChip";
import { Section, EmptyHint } from "./Section";

export function ContextRailForVoice() {
  const transcript = useVoiceStore((s) => s.transcript);
  const phase = useVoiceStore((s) => s.phase);
  const sessionId = useVoiceStore((s) => s.sessionId);
  const services = useServicesStore((s) => s.services);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const connectedApps = services.filter((s) => s.connectionStatus === "connected");
  const last10 = transcript.slice(-10);
  const totalToolsCount = voiceToolDefs.length + connectedApps.length;
  const toolCallCount = transcript.filter(
    (e) => e.role === "tool_call" || e.role === "tool_result",
  ).length;

  const handleLinkThread = async () => {
    if (!sessionId || !activeThreadId) return;
    try {
      await fetch(`/api/v2/voice/transcripts/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ threadId: activeThreadId }),
      });
    } catch {
      // Silent — le link est best-effort
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <Section label="Live transcript" count={transcript.length}>
        {transcript.length === 0 ? (
          <EmptyHint>
            {phase === "idle"
              ? "Activate voice mode to start"
              : "Waiting for first exchange"}
          </EmptyHint>
        ) : (
          <ul className="flex flex-col gap-4">
            {last10.map((entry) => {
              if (entry.role === "tool_call") {
                return (
                  <li key={entry.id} className="flex flex-col gap-1.5">
                    <span className="t-9 font-medium text-(--warn)">
                      TOOL CALL
                    </span>
                    <div className="flex items-center gap-2">
                      <ProviderChip
                        providerId={entry.providerId ?? "composio"}
                        label={entry.toolName ?? entry.text}
                        status={entry.status ?? "pending"}
                      />
                    </div>
                  </li>
                );
              }
              if (entry.role === "tool_result") {
                return (
                  <li key={entry.id} className="flex flex-col gap-1.5">
                    <span
                      className={`t-9 font-medium ${
                        entry.status === "error"
                          ? "text-(--danger)"
                          : "text-(--accent-teal)"
                      }`}
                    >
                      {entry.status === "error" ? "TOOL ERROR" : "TOOL RESULT"}
                    </span>
                    <p className="t-11 font-light text-text-muted line-clamp-2 leading-relaxed">
                      {entry.text}
                    </p>
                  </li>
                );
              }
              return (
                <li key={entry.id} className="flex flex-col gap-1.5">
                  <span
                    className={`t-9 font-medium ${
                      entry.role === "user"
                        ? "text-(--accent-teal)"
                        : "text-text-ghost"
                    }`}
                  >
                    {entry.role === "user" ? "USER" : "AGENT"}
                  </span>
                  <p className="t-11 font-light text-text-muted line-clamp-2 leading-relaxed">
                    {entry.text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {sessionId && transcript.length > 0 && activeThreadId && (
          <button
            type="button"
            onClick={handleLinkThread}
            className="mt-4 t-9 font-medium text-(--accent-teal) hover:text-text transition-colors"
          >
            Lier au thread →
          </button>
        )}
      </Section>
      <Section label="Tool receipts" count={toolCallCount}>
        {toolCallCount === 0 ? (
          <EmptyHint>No tool calls yet</EmptyHint>
        ) : (
          <p className="t-9 font-light text-text-faint leading-relaxed">
            {transcript
              .filter((e) => e.role === "tool_call")
              .slice(-5)
              .map((e) => e.toolName ?? e.text)
              .join(" · ")}
          </p>
        )}
      </Section>
      <Section label="Available tools" count={totalToolsCount}>
        <p className="t-9 font-light text-text-faint leading-relaxed">
          {[
            ...voiceToolDefs.map((t) => VOICE_TOOL_LABELS[t.name] ?? t.name),
            ...connectedApps.map((a) => a.name),
          ].join(" · ")}
        </p>
      </Section>
      <Section label="Voice settings">
        <p className="t-13 font-light text-text-faint leading-relaxed">
          Model{" "}
          <span className="text-(--accent-teal)">openai-realtime</span>, target
          latency &lt; 500&nbsp;ms.
        </p>
      </Section>
    </div>
  );
}
