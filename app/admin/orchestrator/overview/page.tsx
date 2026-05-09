import Link from "next/link";
import { HomShell, PageHeader, MetricCell, Card, StatusPill } from "../_components/Shell";
import { latestScores, loadHistory } from "@/lib/hom/trust";
import { loadDriftLog } from "@/lib/hom/drift";
import { loadCC } from "@/lib/hom/cc-state";
import { listRuns } from "@/lib/hom/registry";
import { listQuarantined } from "@/lib/hom/quarantine";
import { quickHealthCheck } from "@/lib/hom/master";
import { StartRunButton } from "../_components/StartRunButton";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [scores, history, drift, cc, runs, quarantined, health] =
    await Promise.all([
      latestScores(),
      loadHistory(),
      loadDriftLog(),
      loadCC(),
      listRuns(),
      listQuarantined(),
      quickHealthCheck(),
    ]);

  const lastTrust = history.at(-1);
  const recentRuns = runs.slice(0, 5);

  const trustEntries = Object.entries(scores) as Array<[keyof typeof scores, number]>;
  const trustMin = Math.min(...trustEntries.map(([, v]) => v));
  const trustTone = trustMin >= 90 ? "ok" : trustMin >= 75 ? "warn" : "bad";

  return (
    <HomShell current="/admin/orchestrator/overview">
      <PageHeader
        title="Vue d'ensemble"
        subtitle="État agrégé du mesh : trust scores, drift, runs, blockers."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-4) mb-(--space-6)">
        <MetricCell label="Trust min" value={trustMin} tone={trustTone} />
        <MetricCell label="Drift findings" value={drift.length} tone={drift.length > 0 ? "warn" : "ok"} />
        <MetricCell label="Runs total" value={runs.length} />
        <MetricCell
          label="Quarantaine"
          value={quarantined.length}
          tone={quarantined.length > 0 ? "bad" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-(--space-4) mb-(--space-6)">
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Trust scores
          </h3>
          <div className="space-y-(--space-2)">
            {trustEntries.map(([key, value]) => {
              const tone = value >= 90 ? "ok" : value >= 75 ? "warn" : "bad";
              const colorClass =
                tone === "ok"
                  ? "text-(--accent-teal)"
                  : tone === "warn"
                    ? "text-(--warn)"
                    : "text-(--danger)";
              return (
                <div key={key} className="flex items-baseline justify-between">
                  <span className="t-12 text-text-muted capitalize">{key.replace("_", " ")}</span>
                  <span className={`t-15 font-mono ${colorClass}`}>{value}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Système
          </h3>
          <div className="space-y-(--space-3)">
            <div className="flex items-baseline justify-between">
              <span className="t-12 text-text-muted">Master heartbeat</span>
              <span className="t-11 font-mono text-text-ghost">
                {new Date(cc.master_heartbeat).toLocaleTimeString("fr-FR")}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="t-12 text-text-muted">Phase courante</span>
              <span className="t-12 font-mono text-text">{cc.phase}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="t-12 text-text-muted">Mode dégradé</span>
              <StatusPill status={cc.degraded_mode ? "red" : "green"} />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="t-12 text-text-muted">Policies</span>
              <StatusPill status={health.policiesOk ? "green" : "red"} />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="t-12 text-text-muted">Contracts</span>
              <StatusPill status={health.contractsOk ? "green" : "red"} />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Run un audit
          </h3>
          <p className="t-12 text-text-muted mb-(--space-4)">
            Lance les 3 agents (Architecture, Design System, QA) sur la branche actuelle.
          </p>
          <StartRunButton />
        </Card>
      </div>

      <Card className="mb-(--space-6)">
        <div className="flex items-baseline justify-between mb-(--space-3)">
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Derniers runs
          </h3>
          <Link
            href="/admin/orchestrator/runs"
            className="t-11 text-(--accent-teal) hover:underline"
          >
            tout voir →
          </Link>
        </div>
        {recentRuns.length === 0 ? (
          <p className="t-13 text-text-ghost">Aucun run encore.</p>
        ) : (
          <div className="space-y-(--space-1)">
            {recentRuns.map((run) => (
              <Link
                key={run.run_id}
                href={`/admin/orchestrator/runs/${run.run_id}`}
                className="flex items-center justify-between px-(--space-3) py-(--space-2) rounded-(--radius-sm) hover:bg-surface-1 transition-colors"
              >
                <div className="flex items-center gap-(--space-3)">
                  <span className="t-11 font-mono text-text-ghost">{run.run_id}</span>
                  <span className="t-12 text-text-muted">{run.decision ?? "—"}</span>
                </div>
                <span className="t-10 font-mono text-text-ghost">
                  {new Date(run.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {lastTrust ? (
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Dernier delta
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-3)">
            {Object.entries(lastTrust.delta).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between">
                <span className="t-12 text-text-muted capitalize">{k.replace("_", " ")}</span>
                <span
                  className={`t-13 font-mono ${
                    (v as number) > 0
                      ? "text-(--accent-teal)"
                      : (v as number) < 0
                        ? "text-(--danger)"
                        : "text-text-ghost"
                  }`}
                >
                  {(v as number) > 0 ? "+" : ""}
                  {v as number}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </HomShell>
  );
}
