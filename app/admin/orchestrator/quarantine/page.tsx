import { loadQuarantine } from "@/lib/hom/quarantine";
import { RestoreAgentButton } from "../_components/RestoreAgentButton";
import { Card, HomShell, PageHeader, StatusPill } from "../_components/Shell";

export const dynamic = "force-dynamic";

export default async function QuarantinePage() {
  const state = await loadQuarantine();
  const entries = Object.values(state.agents);
  const active = entries.filter((e) => e.state === "quarantined" || e.state === "suspect");

  return (
    <HomShell current="/admin/orchestrator/quarantine">
      <PageHeader
        title="Quarantaine"
        subtitle="Agents isolés ou sous surveillance — anomaly score, signaux, restauration."
      />

      {active.length === 0 ? (
        <Card>
          <p className="t-13 text-(--accent-teal)">Aucun agent en quarantaine.</p>
          <p className="t-11 text-text-muted mt-(--space-1)">
            Tous les agents tournent avec un anomaly score sous le seuil.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-(--space-4) mt-(--space-4)">
        {entries.map((entry) => (
          <Card key={entry.agent_id}>
            <div className="flex items-baseline justify-between mb-(--space-3)">
              <h3 className="t-15 text-text">{entry.agent_id}</h3>
              <StatusPill
                status={
                  entry.state === "quarantined"
                    ? "quarantined"
                    : entry.state === "suspect"
                      ? "amber"
                      : "green"
                }
              />
            </div>
            <div className="space-y-(--space-2) mb-(--space-3)">
              <Row label="Anomaly score" value={entry.anomaly_score.toFixed(2)} />
              {entry.triggered_at ? (
                <Row
                  label="Triggered"
                  value={new Date(entry.triggered_at).toLocaleString("fr-FR", {
                    timeZone: "Europe/Paris",
                  })}
                />
              ) : null}
              {entry.triggered_run ? <Row label="Run" value={entry.triggered_run} /> : null}
              {entry.reason ? <Row label="Raison" value={entry.reason} /> : null}
            </div>

            {entry.history.length > 0 ? (
              <details>
                <summary className="t-11 font-mono uppercase tracking-(--tracking-stretch) text-text-faint cursor-pointer hover:text-text">
                  Historique ({entry.history.length})
                </summary>
                <div className="mt-(--space-2) space-y-(--space-1)">
                  {entry.history
                    .slice(-10)
                    .reverse()
                    .map((h, i) => (
                      <div key={i} className="t-10 font-mono text-text-faint">
                        {new Date(h.ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })} ·{" "}
                        {h.signal} · {h.anomaly_score.toFixed(2)}
                      </div>
                    ))}
                </div>
              </details>
            ) : null}

            {entry.state === "quarantined" ? (
              <div className="mt-(--space-4)">
                <RestoreAgentButton agentId={entry.agent_id} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </HomShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="t-11 text-text-muted">{label}</span>
      <span className="t-11 font-mono text-text truncate ml-(--space-2)">{value}</span>
    </div>
  );
}
