import { HomShell, PageHeader, Card, StatusPill } from "../_components/Shell";
import { loadAllContracts } from "@/lib/hom/contracts";
import { loadCC } from "@/lib/hom/cc-state";
import { loadQuarantine } from "@/lib/hom/quarantine";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const [contracts, cc, q] = await Promise.all([
    loadAllContracts(),
    loadCC(),
    loadQuarantine(),
  ]);

  return (
    <HomShell current="/admin/orchestrator/agents">
      <PageHeader
        title="Agents"
        subtitle="Capability contracts, scope, état runtime, quarantaine."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-(--space-4)">
        {contracts.map((c) => {
          const live = cc.agents.find((a) => a.id === c.agent_id);
          const quarantine = q.agents[c.agent_id];
          const effectiveStatus = quarantine.state === "quarantined"
            ? "quarantined"
            : live?.status ?? "stale";
          return (
            <Card key={c.agent_id}>
              <div className="flex items-baseline justify-between mb-(--space-3)">
                <h3 className="t-15 text-text">{c.agent_id}</h3>
                <StatusPill status={effectiveStatus} />
              </div>
              <p className="t-11 text-text-muted mb-(--space-4)">
                {c.scope.domains_owned.join(" · ")}
              </p>

              <div className="space-y-(--space-2) mb-(--space-4)">
                <Row label="Modèle" value={`${c.model.primary} → ${c.model.fallback}`} />
                <Row label="Tokens max" value={c.budgets.max_tokens_per_run.toLocaleString()} />
                <Row label="Cost max" value={`$${c.budgets.max_cost_usd_per_run}`} />
                <Row label="Runtime max" value={`${c.budgets.max_runtime_seconds}s`} />
                <Row label="Memory" value={c.permissions.memory_access} />
                <Row label="Release" value={c.permissions.release_permissions} />
                <Row
                  label="Anomaly score"
                  value={quarantine.anomaly_score.toFixed(2)}
                />
              </div>

              <details>
                <summary className="t-11 font-mono uppercase tracking-(--tracking-stretch) text-text-faint cursor-pointer hover:text-text">
                  Scope
                </summary>
                <div className="mt-(--space-2) space-y-(--space-1)">
                  <p className="t-10 font-mono text-text-muted">allowed:</p>
                  {c.scope.files_allowed.map((p) => (
                    <p key={p} className="t-10 font-mono text-text-ghost ml-(--space-2)">
                      {p}
                    </p>
                  ))}
                  <p className="t-10 font-mono text-text-muted mt-(--space-2)">denied:</p>
                  {c.scope.files_denied.map((p) => (
                    <p key={p} className="t-10 font-mono text-(--danger) ml-(--space-2)">
                      {p}
                    </p>
                  ))}
                </div>
              </details>
            </Card>
          );
        })}
      </div>
    </HomShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="t-11 text-text-muted">{label}</span>
      <span className="t-11 font-mono text-text">{value}</span>
    </div>
  );
}
