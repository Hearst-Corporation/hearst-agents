/**
 * Admin Run Detail Page
 */
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";

const traceKindColor: Record<string, string> = {
  llm_call:     "border-(--accent-teal)/50 text-(--accent-teal)",
  tool_call:    "border-(--accent-llm)/50 text-(--accent-llm)",
  memory_read:  "border-(--accent-teal)/50 text-(--accent-teal)",
  memory_write: "border-(--accent-teal)/50 text-(--accent-teal)",
  skill_invoke: "border-(--warn)/50 text-(--warn)",
  error:        "border-(--danger)/70 text-(--danger)",
  guard:        "border-(--warn)/50 text-(--warn)",
  custom:       "border-(--line-strong) text-text-muted",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  const sb = getServerSupabase();
  if (!sb) notFound();

  const [runRes, tracesRes] = await Promise.all([
    sb.from("runs").select("*, agents(name, slug)").eq("id", id).single(),
    sb
      .from("traces")
      .select("*")
      .eq("run_id", id)
      .order("step_index", { ascending: true })
      .order("started_at", { ascending: true }),
  ]);

  if (runRes.error || !runRes.data) notFound();
  const run = runRes.data;
  const traces = tracesRes.data ?? [];
  const agent = run.agents as { name: string; slug: string } | null;

  const statusColor: Record<string, string> = {
    completed: "text-(--money)",
    running: "text-(--cyan-accent)",
    failed: "text-(--danger)",
    pending: "text-text-muted",
  };

  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <div className="mb-(--space-8)">
        <div className="flex items-center gap-(--space-3)">
          <h1 className="t-24 font-light text-text">{run.kind}</h1>
          <span className={`t-13 font-medium ${statusColor[run.status] ?? "text-text-muted"}`}>
            {run.status}
          </span>
        </div>
        {agent && (
          <p className="mt-(--space-1) t-13 text-text-muted">Agent : {agent.name}</p>
        )}
      </div>

      {/* Run summary */}
      <div className="mb-(--space-8) grid grid-cols-2 gap-(--space-4) sm:grid-cols-5">
        {[
          { label: "Tokens entrée", value: run.tokens_in },
          { label: "Tokens sortie", value: run.tokens_out },
          { label: "Coût", value: `$${(run.cost_usd ?? 0).toFixed(4)}` },
          { label: "Latence", value: `${run.latency_ms ?? 0}ms` },
          { label: "Traces", value: traces.length },
        ].map((s) => (
          <div key={s.label} className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) px-(--space-4) py-(--space-3)">
            <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">{s.label}</p>
            <p className="mt-(--space-1) t-18 font-light text-text">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Input / Output */}
      <div className="mb-(--space-8) grid grid-cols-1 gap-(--space-4) lg:grid-cols-2">
        <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
          <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">Entrée</h3>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono t-9 text-text-soft">
            {JSON.stringify(run.input, null, 2)}
          </pre>
        </div>
        <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
          <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">Sortie</h3>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono t-9 text-text-soft">
            {JSON.stringify(run.output, null, 2)}
          </pre>
        </div>
      </div>

      {run.error && (
        <div className="mb-(--space-8) admin-callout-danger t-13 text-(--danger)">
          {run.error}
        </div>
      )}

      {/* Traces timeline */}
      <h2 className="mb-(--space-4) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
        Traces
      </h2>
      {traces.length === 0 ? (
        <p className="t-13 text-text-ghost">Aucune trace.</p>
      ) : (
        <div className="space-y-(--space-2)">
          {traces.map((t, i) => (
            <div
              key={t.id}
              className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-4)"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-(--space-3)">
                  <span className="t-9 font-mono text-text-faint">#{i + 1}</span>
                  <span
                    className={`rounded-pill border px-(--space-2) py-(--space-1) t-10 font-medium ${traceKindColor[t.kind] ?? "border-(--border-shell) text-text-muted"}`}
                  >
                    {t.kind}
                  </span>
                  <span className="t-13 text-text-soft">{t.name}</span>
                </div>
                <div className="flex items-center gap-(--space-4) t-9 text-text-muted font-mono">
                  {t.model_used && <span>{t.model_used}</span>}
                  {t.latency_ms != null && <span>{t.latency_ms}ms</span>}
                  {(t.tokens_in ?? 0) > 0 && (
                    <span>{(t.tokens_in ?? 0) + (t.tokens_out ?? 0)} tok</span>
                  )}
                </div>
              </div>

              {t.error && (
                <p className="mt-(--space-2) t-9 text-(--danger)">{t.error}</p>
              )}

              <div className="mt-(--space-3) grid grid-cols-1 gap-(--space-3) lg:grid-cols-2">
                <div>
                  <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">Entrée</p>
                  <pre className="mt-(--space-1) max-h-24 overflow-auto whitespace-pre-wrap font-mono t-11 text-text-muted">
                    {JSON.stringify(t.input, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">Sortie</p>
                  <pre className="mt-(--space-1) max-h-24 overflow-auto whitespace-pre-wrap font-mono t-11 text-text-muted">
                    {JSON.stringify(t.output, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-(--space-8) font-mono t-10 text-text-faint">
        run_id: {run.id}
      </p>
    </div>
  );
}
