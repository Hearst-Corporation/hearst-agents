"use client";

import { useEffect, useState } from "react";
import { fetchAdminJson } from "./safe-admin-fetch";

interface RunSummary {
  id: string;
  status: string;
  createdAt: number;
  input: string;
  metrics?: { latencyMs?: number };
}

interface RunsResponse {
  runs: RunSummary[];
}

interface Props {
  onSelect: (runId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  completed: "text-(--color-success)",
  failed: "text-(--color-danger)",
  running: "text-(--accent-teal)",
  cancelled: "text-text-faint",
  aborted: "text-text-faint",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Réussi",
  failed: "Échec",
  running: "En cours",
  cancelled: "Annulé",
  aborted: "Annulé",
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function truncateInput(s: string, max = 38): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default function RunRail({ onSelect }: Props) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAdminJson<RunsResponse>("/api/admin/runs/recent?limit=20").then((data) => {
      if (cancelled) return;
      setRuns(data?.runs ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-(--space-4) py-(--space-2) border-b border-line shrink-0">
        <span className="t-11 font-medium text-text-muted">Runs récents</span>
        {!loading && runs.length > 0 && (
          <span className="t-10 text-text-faint">{runs.length}</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-16">
            <span className="t-11 text-text-faint">Chargement…</span>
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="flex items-center justify-center h-16">
            <span className="t-11 text-text-faint">Aucun run</span>
          </div>
        )}

        {!loading && runs.length > 0 && (
          <ul className="divide-y divide-line">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onSelect(run.id)}
                  className="w-full text-left flex flex-col gap-(--space-1) px-(--space-4) py-(--space-3) hover:bg-surface transition-colors duration-(--duration-base)"
                >
                  <div className="flex items-center justify-between gap-(--space-2)">
                    <span
                      className={[
                        "t-10 font-medium shrink-0",
                        STATUS_COLOR[run.status] ?? "text-text-muted",
                      ].join(" ")}
                    >
                      {STATUS_LABEL[run.status] ?? run.status}
                    </span>
                    <span className="t-10 text-text-faint shrink-0">{formatTs(run.createdAt)}</span>
                  </div>
                  <span className="t-11 text-text truncate">
                    {truncateInput(run.input)}
                  </span>
                  {run.metrics?.latencyMs != null && (
                    <span className="t-10 text-text-faint">
                      {(run.metrics.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
