/**
 * Admin Runs List Page
 */
import Link from "next/link";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";

interface RunRow {
  id: string;
  kind: string;
  status: string;
  agent_id: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number | null;
  created_at: string;
  error: string | null;
  agents: { name: string } | null;
}

const statusColor: Record<string, string> = {
  completed: "text-(--money)",
  running: "text-(--cyan-accent)",
  failed: "text-(--danger)",
  pending: "text-text-muted",
  cancelled: "text-text-muted",
  timeout: "text-(--warn)",
};

const kindLabel: Record<string, string> = {
  chat: "Chat",
  workflow: "Workflow",
  evaluation: "Eval",
  tool_test: "Tool",
};

export default async function RunsPage() {
  let runs: RunRow[] = [];
  let error: string | null = null;

  const sb = getServerSupabase();
  if (!sb) {
    error = "Supabase non configuré.";
  } else {
    try {
      const res = await sb
        .from("runs")
        .select("id, kind, status, agent_id, tokens_in, tokens_out, cost_usd, latency_ms, created_at, error, agents(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (res.error) throw new Error(res.error.message);
      runs = (res.data ?? []) as unknown as RunRow[];
    } catch (e) {
      error = e instanceof Error ? e.message : "Erreur DB";
    }
  }

  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <div className="mb-(--space-8)">
        <h1 className="t-24 font-light text-text">Runs</h1>
        <p className="mt-(--space-1) t-13 text-text-muted">
          Chaque exécution, chaque trace, chaque token.
        </p>
      </div>

      {error && (
        <div className="mb-(--space-6) admin-callout-danger t-13 text-(--danger)">
          {error}
        </div>
      )}

      {runs.length === 0 && !error ? (
        <p className="t-13 text-text-muted">Aucun run enregistré. Lancez un chat ou un workflow.</p>
      ) : (
        <div className="space-y-(--space-2)">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/admin/runs/${run.id}`}
              className="flex items-center justify-between rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-4) transition-colors hover:border-(--accent-teal-border-hover) hover:bg-(--surface-1)"
            >
              <div className="flex items-center gap-(--space-4)">
                <span className="rounded-(--radius-xs) border border-(--border-shell) px-(--space-2) py-(--space-1) t-10 font-medium text-text-muted">
                  {kindLabel[run.kind] ?? run.kind}
                </span>
                <span className={`t-9 font-medium ${statusColor[run.status] ?? "text-text-muted"}`}>
                  {run.status}
                </span>
                {run.agents && (
                  <span className="t-9 text-text-muted">{run.agents.name}</span>
                )}
                {run.error && (
                  <span className="max-w-[var(--width-admin-code-clip)] truncate t-9 text-(--danger)/80">
                    {run.error}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-(--space-6) t-9 text-text-muted">
                {run.tokens_in > 0 && (
                  <span>{run.tokens_in + run.tokens_out} tok</span>
                )}
                {run.latency_ms != null && run.latency_ms > 0 && (
                  <span>{run.latency_ms}ms</span>
                )}
                <span className="text-right font-mono" style={{ minWidth: "var(--space-32)" }}>
                  {new Date(run.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
