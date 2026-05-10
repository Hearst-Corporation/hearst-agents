"use client";

import { useMemo } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import type { StreamEvent } from "@/stores/runtime";

/**
 * Récapitulatif d'exécution post-run — affiché sous le dernier message
 * assistant une fois le run terminé (coreState === "idle").
 *
 * Extrait depuis les events SSE : providers consultés, durée totale, nombre
 * de steps. Style "trace" discret — non intrusif, purement informatif.
 */

interface RunSummary {
  steps: number;
  providers: string[];
  durationMs: number | null;
}

function selectRunSummary(events: StreamEvent[], lastRunId: string | null): RunSummary | null {
  if (!lastRunId) return null;

  const runEvents = events.filter(
    (e) => (e.run_id as string | undefined) === lastRunId,
  );

  // Compter les steps complétés + collecter les providers
  const completedSteps = runEvents.filter((e) => e.type === "plan_step_completed");
  if (completedSteps.length === 0) return null;

  const providerSet = new Set<string>();
  for (const ev of completedSteps) {
    const p = ev.providerId as string | undefined;
    if (p) providerSet.add(p);
  }

  // Durée : run_started → run_completed timestamps
  const startEvent = runEvents.find((e) => e.type === "run_started");
  const endEvent = runEvents.find((e) => e.type === "run_completed");
  const durationMs =
    startEvent && endEvent ? endEvent.timestamp - startEvent.timestamp : null;

  return {
    steps: completedSteps.length,
    providers: Array.from(providerSet),
    durationMs,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ChatRunReceipt() {
  const coreState = useRuntimeStore((s) => s.coreState);
  const events = useRuntimeStore((s) => s.events);
  const lastRunId = useRuntimeStore((s) => s.lastRunId);

  const summary = useMemo(
    () => selectRunSummary(events, lastRunId),
    [events, lastRunId],
  );

  // Afficher uniquement en idle, avec des steps significatifs
  if (coreState !== "idle" || !summary) return null;

  const parts: string[] = [];
  parts.push(`${summary.steps} ${summary.steps === 1 ? "step" : "steps"}`);
  parts.push(...summary.providers);
  if (summary.durationMs !== null) {
    parts.push(formatDuration(summary.durationMs));
  }

  return (
    <div
      className="flex items-center flex-wrap"
      style={{ marginTop: "var(--space-3)", gap: "var(--space-1)" }}
      aria-label="Résumé d'exécution"
    >
      <span
        className="t-9 font-mono text-text-ghost"
        style={{ marginRight: "var(--space-1)" }}
        aria-hidden
      >
        ›
      </span>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center" style={{ gap: "var(--space-1)" }}>
          {i > 0 && (
            <span className="t-9 text-text-ghost" aria-hidden>
              ·
            </span>
          )}
          <span
            className="t-9 font-mono text-text-faint"
            style={{
              padding: "1px var(--space-1-5)",
              border: "1px solid var(--border-shell)",
              borderRadius: "var(--radius-xs)",
            }}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}
