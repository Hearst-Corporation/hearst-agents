"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SwarmBuilder } from "@/components/swarms/SwarmBuilder";
import type { Tool } from "@/components/swarms/types";

export default function NewSwarmPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crewai/v1/tools", { signal: AbortSignal.timeout(15000) })
      .then((r) => {
        if (!r.ok) throw new Error(`Catalog unavailable (HTTP ${r.status})`);
        return r.json();
      })
      .then((data: { tools?: Tool[] } | Tool[]) => {
        if (!cancelled) {
          const arr = Array.isArray(data) ? data : ((data as { tools?: Tool[] }).tools ?? []);
          setTools(arr);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.name === "TimeoutError"
            ? "Timeout — CrewAI engine unreachable."
            : "Could not load tools.";
        setToolsError(msg);
      })
      .finally(() => {
        if (!cancelled) setToolsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
      <div className="px-(--space-8) pt-(--space-8) pb-(--space-4) border-b border-(--line)">
        <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
          <Link
            href="/admin/orchestrator/swarms"
            className="text-text-muted hover:text-text transition-colors no-underline"
          >
            ← Swarms
          </Link>
        </div>
        <h2 className="t-24 font-light text-text">New swarm</h2>
        <p className="t-12 text-text-muted mt-(--space-1)">
          Define name, agents, tasks and tools. You can edit after creation.
        </p>
      </div>

      <div className="px-(--space-8) py-(--space-6)">
        {toolsLoading ? (
          <div className="rounded-(--radius-md) bg-surface-1 border border-(--line) p-(--space-5)">
            <p className="t-13 text-text-muted">Loading tools…</p>
            <p className="t-11 text-text-faint mt-(--space-1)">
              Fetching catalog from the CrewAI engine.
            </p>
          </div>
        ) : toolsError ? (
          <div className="rounded-(--radius-md) bg-(--warn-surface) border border-(--warn) p-(--space-5)">
            <p className="t-13 text-(--warn)">{toolsError}</p>
            <button
              type="button"
              className="mt-(--space-3) px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-surface-1 border border-(--line) text-text t-12 hover:bg-surface-2 transition-colors"
              onClick={() => {
                setToolsError(null);
                setToolsLoading(true);
                setReloadKey((k) => k + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <SwarmBuilder mode="create" availableTools={tools} />
        )}
      </div>
    </div>
  );
}
