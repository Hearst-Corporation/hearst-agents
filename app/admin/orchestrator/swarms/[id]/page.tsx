import Link from "next/link";
import { notFound } from "next/navigation";
import { crewai } from "@/lib/crewai-client";
import { Card, HomShell, PageHeader } from "../../_components/Shell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SwarmAgent {
  id?: string;
  name: string;
  role?: string;
  model_provider?: string;
  model_name?: string;
}

interface SwarmTask {
  id?: string;
  name: string;
  description: string;
}

interface SwarmDetail {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  agents: SwarmAgent[];
  tasks: SwarmTask[];
}

interface SwarmRun {
  id: string;
  status: string;
  trigger?: string;
  started_at?: string;
  finished_at?: string;
  total_tokens_in?: number;
  total_tokens_out?: number;
  total_cost_usd?: number;
}

export default async function SwarmDetailPage({ params }: PageProps) {
  const { id } = await params;

  let swarm: SwarmDetail;
  let loadError: string | null = null;

  try {
    swarm = (await crewai.getSwarm(id)) as SwarmDetail;
    if (!swarm) notFound();
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404) notFound();
    loadError = err instanceof Error ? err.message : "Failed to load swarm";
    return (
      <HomShell current="/admin/orchestrator/swarms">
        <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
          <Link
            href="/admin/orchestrator/swarms"
            className="text-text-muted hover:text-text transition-colors no-underline"
          >
            ← Swarms
          </Link>
        </div>
        <p className="t-13 text-(--danger)">{loadError}</p>
      </HomShell>
    );
  }

  let recentRuns: SwarmRun[] = [];
  let runsError: string | null = null;
  try {
    const data = (await crewai.listSwarmRuns(id)) as { runs?: SwarmRun[] } | SwarmRun[];
    recentRuns = Array.isArray(data) ? data : ((data as { runs?: SwarmRun[] }).runs ?? []);
  } catch (err) {
    runsError = err instanceof Error ? err.message : "Failed to load runs";
  }

  const totalRuns = recentRuns.length;
  const activeRuns = recentRuns.filter((r) => r.status === "running").length;
  const succeededRuns = recentRuns.filter((r) => r.status === "completed").length;
  const totalCost = recentRuns.reduce((acc, r) => acc + (r.total_cost_usd ?? 0), 0);

  return (
    <HomShell current="/admin/orchestrator/swarms">
      <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
        <Link
          href="/admin/orchestrator/swarms"
          className="text-text-muted hover:text-text transition-colors no-underline"
        >
          ← Swarms
        </Link>
      </div>

      <div className="flex items-start justify-between gap-(--space-4) flex-wrap mb-(--space-6)">
        <div>
          <div className="flex items-center gap-(--space-3) flex-wrap">
            <h2 className="t-24 font-light text-text">{swarm.name}</h2>
            {swarm.is_active === false ? (
              <span className="px-(--space-2) py-(--space-0) rounded-(--radius-pill) bg-(--warn-surface) text-(--warn) t-10 font-mono">
                Archived
              </span>
            ) : null}
          </div>
          {swarm.description ? (
            <p className="t-12 text-text-muted mt-(--space-1)">{swarm.description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-(--space-2)">
          {swarm.is_active === false ? (
            <span className="px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-surface-1 border border-(--line) text-text-faint t-12 opacity-50 cursor-not-allowed">
              Archived — cannot be triggered
            </span>
          ) : (
            <>
              <Link
                href={`/admin/orchestrator/swarms/${id}/edit`}
                className="px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-surface-1 border border-(--line) text-text t-12 hover:bg-surface-2 transition-colors"
              >
                Edit
              </Link>
              <form
                action={async () => {
                  "use server";
                  await crewai.kickoffSwarm(id);
                }}
              >
                <button
                  type="submit"
                  className="px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-(--accent-teal-bg-active) text-(--accent-teal) t-12 hover:opacity-80 transition-opacity"
                >
                  Kickoff
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-(--space-4) mb-(--space-6)">
        {[
          { label: "Agents", value: swarm.agents.length },
          { label: "Tasks", value: swarm.tasks.length },
          { label: "Recent runs", value: totalRuns },
          { label: "Active", value: activeRuns },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-(--radius-md) bg-surface-1 border border-(--line) p-(--space-4) flex flex-col gap-(--space-1)"
          >
            <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              {kpi.label}
            </span>
            <span className="t-24 font-light text-text">{kpi.value}</span>
          </div>
        ))}
      </div>

      <Card className="mb-(--space-4)">
        <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
          Composition
        </p>
        <div className="grid grid-cols-2 gap-(--space-6)">
          <div>
            <p className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
              Agents
            </p>
            {swarm.agents.length === 0 ? (
              <p className="t-11 text-text-faint">No agent.</p>
            ) : (
              <ul className="list-none p-0 m-0">
                {swarm.agents.map((a) => (
                  <li
                    key={a.id ?? a.name}
                    className="py-(--space-2) border-b border-(--line) last:border-0"
                  >
                    <p className="t-13 text-text font-light">{a.name}</p>
                    {a.role || a.model_provider ? (
                      <p className="t-11 text-text-faint">
                        {a.role}
                        {a.role && a.model_provider ? " · " : ""}
                        {a.model_provider && a.model_name
                          ? `${a.model_provider}/${a.model_name}`
                          : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
              Tasks
            </p>
            {swarm.tasks.length === 0 ? (
              <p className="t-11 text-text-faint">No task.</p>
            ) : (
              <ul className="list-none p-0 m-0">
                {swarm.tasks.map((t) => (
                  <li
                    key={t.id ?? t.name}
                    className="py-(--space-2) border-b border-(--line) last:border-0"
                  >
                    <p className="t-13 text-text font-light">{t.name}</p>
                    <p className="t-11 text-text-faint">
                      {t.description.slice(0, 80)}
                      {t.description.length > 80 ? "…" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-(--space-5) pt-(--space-5) pb-(--space-3)">
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Recent runs
          </p>
        </div>
        {runsError ? (
          <div className="px-(--space-5) pb-(--space-5)">
            <p className="t-12 text-(--danger)">{runsError}</p>
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="px-(--space-5) pb-(--space-5)">
            <p className="t-12 text-text-muted">No run yet. Trigger one with the button above.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-6 px-(--space-5) py-(--space-2) border-b border-(--line) bg-surface-1">
              {["Run", "Trigger", "Status", "Started", "Finished", "Tokens"].map((h) => (
                <span
                  key={h}
                  className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint"
                >
                  {h}
                </span>
              ))}
            </div>
            {recentRuns.map((r) => (
              <Link
                key={r.id}
                href={`/admin/orchestrator/swarms/${id}/runs/${r.id}`}
                className="grid grid-cols-6 items-center px-(--space-5) py-(--space-3) border-b border-(--line) last:border-0 hover:bg-surface-1 transition-colors"
              >
                <span className="t-11 font-mono text-(--accent-teal)">{r.id.slice(0, 8)}…</span>
                <span className="t-11 text-text-muted">{r.trigger ?? "—"}</span>
                <span
                  className={`t-11 font-mono ${r.status === "completed" ? "text-(--accent-teal)" : r.status === "running" ? "text-(--warn)" : "text-(--danger)"}`}
                >
                  {r.status}
                </span>
                <span className="t-11 text-text-muted">
                  {r.started_at ? new Date(r.started_at).toLocaleString("fr-FR") : "—"}
                </span>
                <span className="t-11 text-text-muted">
                  {r.finished_at ? new Date(r.finished_at).toLocaleString("fr-FR") : "—"}
                </span>
                <span className="t-11 text-text-muted">
                  {((r.total_tokens_in ?? 0) + (r.total_tokens_out ?? 0)).toLocaleString()}
                </span>
              </Link>
            ))}
            {succeededRuns > 0 && totalRuns > 0 ? (
              <div className="px-(--space-5) py-(--space-3)">
                <p className="t-10 text-text-faint">
                  {succeededRuns}/{totalRuns} success · cumulative cost ${totalCost.toFixed(4)}
                </p>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </HomShell>
  );
}
