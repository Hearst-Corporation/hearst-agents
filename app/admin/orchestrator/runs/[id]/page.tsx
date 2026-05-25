import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/BackLink";
import { readRunBundle } from "@/lib/hom/registry";
import { readRunSpans } from "@/lib/hom/telemetry";
import type { ReplaySnapshot, RunDecisionFile, RunIntake } from "@/lib/hom/types";
import { Card, HomShell, MetricCell, PageHeader, StatusPill } from "../../_components/Shell";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, spans] = await Promise.all([readRunBundle(id), readRunSpans(id)]);
  if (!bundle.intake) notFound();
  const intake = bundle.intake as RunIntake;
  const decision = bundle.decision as RunDecisionFile | null;
  const snapshot = bundle.snapshot as ReplaySnapshot | null;

  return (
    <HomShell current="/admin/orchestrator/runs">
      <div className="mb-(--space-3)">
        <BackLink href="/admin/orchestrator/runs" label="Runs" />
      </div>
      <PageHeader title={`Run ${id}`} subtitle={intake.notes ?? "Détail du run."} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-3) mb-(--space-6)">
        <MetricCell
          label="Decision"
          value={decision?.decision ?? "—"}
          tone={
            decision?.decision === "release_candidate"
              ? "ok"
              : decision?.decision === "release_blocked"
                ? "bad"
                : "warn"
          }
        />
        <MetricCell label="Agents" value={decision?.agents.length ?? 0} />
        <MetricCell
          label="Critical"
          value={decision?.severity_stack.critical ?? 0}
          tone={(decision?.severity_stack.critical ?? 0) > 0 ? "bad" : "ok"}
        />
        <MetricCell label="Spans" value={spans.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-(--space-4) mb-(--space-4)">
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Intake
          </h3>
          <Row label="Triggered by" value={intake.triggered_by} />
          <Row label="Trigger kind" value={intake.trigger_kind} />
          <Row
            label="Created at"
            value={new Date(intake.created_at).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
            })}
          />
          <Row label="Scope" value={intake.scope.join(", ")} />
        </Card>

        {snapshot ? (
          <Card>
            <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
              Replay snapshot
            </h3>
            <Row label="Branch" value={snapshot.git.branch} />
            <Row label="Commit" value={snapshot.git.commit.slice(0, 12)} />
            <Row label="Dirty" value={String(snapshot.git.dirty)} />
            <Row label="Node" value={snapshot.node_version} />
            <Row label="Policies hash" value={`${snapshot.policies_hash.slice(0, 12)}…`} />
            <Row label="Contracts hash" value={`${snapshot.contracts_hash.slice(0, 12)}…`} />
          </Card>
        ) : null}
      </div>

      {decision ? (
        <Card className="mb-(--space-4) p-0 overflow-hidden">
          <div className="grid grid-cols-12 px-(--space-4) py-(--space-2) border-b border-(--line) bg-surface-1">
            <span className="col-span-3 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Agent
            </span>
            <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Status
            </span>
            <span className="col-span-1 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Score
            </span>
            <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Severity
            </span>
            <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Findings
            </span>
            <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Durée
            </span>
          </div>
          {decision.agents.map((a) => (
            <div
              key={a.agent}
              className="grid grid-cols-12 items-center px-(--space-4) py-(--space-2) border-b border-(--line) last:border-0"
            >
              <span className="col-span-3 t-12 text-text">{a.agent}</span>
              <span className="col-span-2">
                <StatusPill status={a.status} />
              </span>
              <span className="col-span-1 t-12 font-mono">{a.score}</span>
              <span className="col-span-2 t-12 font-mono text-text-muted">{a.severity_max}</span>
              <span className="col-span-2 t-12 font-mono">{a.findings_count}</span>
              <span className="col-span-2 t-12 font-mono text-text-muted">{a.duration_ms}ms</span>
            </div>
          ))}
        </Card>
      ) : null}

      {decision?.blockers && decision.blockers.length > 0 ? (
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-(--danger) mb-(--space-3)">
            Blockers
          </h3>
          <ul className="space-y-(--space-1)">
            {decision.blockers.map((b, i) => (
              <li key={i} className="t-12 text-text">
                · {b}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </HomShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between mb-(--space-1)">
      <span className="t-11 text-text-muted">{label}</span>
      <span className="t-11 font-mono text-text">{value}</span>
    </div>
  );
}
