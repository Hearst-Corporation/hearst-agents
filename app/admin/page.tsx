import { getServerSupabase } from "@/lib/platform/db/supabase";
import { getSystemHealth } from "@/lib/admin/health";
import { AnalyticsKpiCard } from "./_components/AnalyticsKpiCard";

export const dynamic = "force-dynamic";

interface RunRow {
  id: string;
  status: string | null;
  kind: string | null;
  latency_ms: number | null;
  created_at: string;
}

async function loadDashboard() {
  const sb = getServerSupabase();
  if (!sb) return { health: null, runs: [], kpis: null };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [healthResult, recentRunsResult, hourRunsResult] = await Promise.allSettled([
    getSystemHealth(sb),
    sb
      .from("runs")
      .select("id, status, kind, latency_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    sb
      .from("runs")
      .select("status, latency_ms, created_at")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const health = healthResult.status === "fulfilled" ? healthResult.value : null;
  const runs =
    recentRunsResult.status === "fulfilled"
      ? ((recentRunsResult.value.data ?? []) as RunRow[])
      : [];

  let kpis = null;
  if (hourRunsResult.status === "fulfilled" && !hourRunsResult.value.error) {
    const rows = (hourRunsResult.value.data ?? []) as Array<{ status: string | null; latency_ms: number | null; created_at: string }>;
    const oneMinAgo = Date.now() - 60 * 1000;
    const runsPerMin = rows.filter((r) => new Date(r.created_at).getTime() >= oneMinAgo).length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const errorRate = rows.length === 0 ? 0 : failed / rows.length;
    const latencies = rows
      .filter((r) => typeof r.latency_ms === "number")
      .map((r) => r.latency_ms as number)
      .sort((a, b) => a - b);
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;
    kpis = { runsPerMin, errorRate, p95LatencyMs: p95, totalRuns: rows.length };
  }

  return { health, runs, kpis };
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block size-(--space-2) rounded-(--radius-pill) shrink-0 ${ok ? "bg-(--accent-teal)" : "bg-(--danger)"}`}
    />
  );
}

export default async function AdminHomePage() {
  const { health, runs, kpis } = await loadDashboard();

  const healthColor =
    health?.status === "healthy"
      ? "text-(--accent-teal)"
      : health?.status === "degraded"
        ? "text-(--warn)"
        : "text-(--danger)";

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
      <div className="px-(--space-8) py-(--space-10) space-y-(--space-8)">

        <div>
          <h1 className="t-24 font-light text-text">Administration</h1>
        </div>

        {/* ── Statut système ─────────────────────────────── */}
        <section className="space-y-(--space-4)">
          <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Statut système
          </h2>
          {!health ? (
            <p className="t-13 text-text-ghost">Supabase non configuré</p>
          ) : (
            <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-5) space-y-(--space-4)">
              <div className="flex items-center gap-(--space-3)">
                <span className={`t-15 font-medium ${healthColor}`}>
                  {health.status === "healthy" ? "Opérationnel" : health.status === "degraded" ? "Dégradé" : "Hors ligne"}
                </span>
                <span className="t-10 text-text-ghost font-mono">
                  {new Date(health.timestamp).toLocaleTimeString("fr-FR")}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-3)">
                {(["database", "storage", "connectors", "llm"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-(--space-2)">
                    <StatusDot ok={health.checks[key]} />
                    <span className="t-12 text-text-muted capitalize">{key}</span>
                    {health.latency[key as keyof typeof health.latency] !== undefined && (
                      <span className="t-10 text-text-ghost ml-auto">
                        {health.latency[key as keyof typeof health.latency]}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── KPIs dernière heure ───────────────────────── */}
        {kpis && (
          <section className="space-y-(--space-4)">
            <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Dernière heure
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-4)">
              <AnalyticsKpiCard label="Runs" value={String(kpis.totalRuns)} />
              <AnalyticsKpiCard label="Runs / min" value={String(kpis.runsPerMin)} />
              <AnalyticsKpiCard
                label="Taux d'erreur"
                value={`${(kpis.errorRate * 100).toFixed(1)} %`}
                accent={kpis.errorRate > 0.1 ? "danger" : "default"}
              />
              <AnalyticsKpiCard
                label="Latence p95"
                value={kpis.p95LatencyMs !== null ? `${Math.round(kpis.p95LatencyMs)} ms` : "—"}
              />
            </div>
          </section>
        )}

        {/* ── Derniers runs ─────────────────────────────── */}
        <section className="space-y-(--space-4)">
          <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Derniers runs
          </h2>
          {runs.length === 0 ? (
            <p className="t-13 text-text-ghost">Aucun run.</p>
          ) : (
            <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) overflow-hidden">
              {runs.map((run) => {
                const ok = run.status === "completed" || run.status === "success";
                const failed = run.status === "failed" || run.status === "error";
                const statusColor = ok
                  ? "text-(--accent-teal)"
                  : failed
                    ? "text-(--danger)"
                    : "text-(--warn)";
                return (
                  <div
                    key={run.id}
                    className="grid grid-cols-12 items-center px-(--space-4) py-(--space-3) border-b border-line last:border-0 gap-(--space-3) hover:bg-surface-2 transition-colors"
                  >
                    <span className="col-span-4 t-11 font-mono text-text-ghost truncate">{run.id.slice(0, 8)}…</span>
                    <span className="col-span-2 t-12 text-text-muted">{run.kind ?? "—"}</span>
                    <span className={`col-span-2 t-12 font-medium ${statusColor}`}>{run.status ?? "—"}</span>
                    <span className="col-span-2 t-11 text-text-ghost text-right">
                      {run.latency_ms !== null ? `${run.latency_ms}ms` : "—"}
                    </span>
                    <span className="col-span-2 t-10 text-text-ghost text-right font-mono">
                      {new Date(run.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

