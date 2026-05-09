import { HomShell, PageHeader, Card, MetricCell } from "../_components/Shell";
import { latestScores, trustGate } from "@/lib/hom/trust";
import { evaluateReleaseGates } from "@/lib/hom/policy";
import { loadDriftLog } from "@/lib/hom/drift";
import { listRuns } from "@/lib/hom/registry";
import { readJson } from "@/lib/hom/fs-utils";
import { HOM } from "@/lib/hom/paths";
import type { RunDecisionFile } from "@/lib/hom/types";

export const dynamic = "force-dynamic";

export default async function ReleasePage() {
  const [scores, drift, runs] = await Promise.all([
    latestScores(),
    loadDriftLog(),
    listRuns(),
  ]);
  const lastRun = runs[0];
  const lastDecision = lastRun
    ? await readJson<RunDecisionFile>(HOM.runDecision(lastRun.run_id))
    : null;
  const hasCritical = (lastDecision?.severity_stack.critical ?? 0) > 0;
  const hasHighDrift = drift.filter((d) => d.severity === "high").length > 0;

  const gates = await evaluateReleaseGates({
    trustScores: { ...scores },
    hasCritical,
    hasHighDriftUnresolved: hasHighDrift,
    manifestSynced: true,
    humanSignaturePresent: false,
    acceptedDebtValid: true,
  });

  const blocking = gates.filter((g) => g.blocking && !g.passed);
  const canRelease = blocking.length === 0;
  const trust = trustGate(scores);

  return (
    <HomShell current="/admin/orchestrator/release">
      <PageHeader
        title="Release"
        subtitle="Évaluation des gates avant signature — trust, drift, critical, manifest."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-3) mb-(--space-6)">
        <MetricCell
          label="Status"
          value={canRelease ? "ready" : "blocked"}
          tone={canRelease ? "ok" : "bad"}
        />
        <MetricCell label="Gates" value={gates.length} />
        <MetricCell
          label="Failed"
          value={gates.filter((g) => !g.passed).length}
          tone={blocking.length > 0 ? "bad" : "ok"}
        />
        <MetricCell
          label="Trust min"
          value={Math.min(...Object.values(scores))}
          tone={trust.passed ? "ok" : "warn"}
        />
      </div>

      <Card className="p-0 overflow-hidden mb-(--space-4)">
        <div className="grid grid-cols-12 px-(--space-4) py-(--space-2) border-b border-(--line) bg-surface-1">
          <span className="col-span-1 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            ID
          </span>
          <span className="col-span-7 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Rule
          </span>
          <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Type
          </span>
          <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Status
          </span>
        </div>
        {gates.map((g) => (
          <div
            key={g.id}
            className="grid grid-cols-12 items-center px-(--space-4) py-(--space-2) border-b border-(--line) last:border-0"
          >
            <span className="col-span-1 t-11 font-mono text-text-faint">{g.id}</span>
            <span className="col-span-7 t-12 font-mono text-text">{g.rule}</span>
            <span className="col-span-2 t-11 text-text-muted">
              {g.blocking ? "blocking" : "warning"}
            </span>
            <span
              className={`col-span-2 t-11 font-mono ${
                g.passed ? "text-(--accent-teal)" : g.blocking ? "text-(--danger)" : "text-(--warn)"
              }`}
            >
              {g.passed ? "✓ passé" : "✗ échec"}
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
          Signature humaine
        </h3>
        <p className="t-12 text-text-muted mb-(--space-2)">
          Adrien doit signer manuellement après validation de toutes les gates blocking.
          La signature humaine est requise par la policy <code className="t-11">G-06</code>.
        </p>
        <p className="t-11 font-mono text-text-faint">
          Status : <span className="text-(--warn)">non signé</span>
        </p>
      </Card>
    </HomShell>
  );
}
