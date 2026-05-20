import Link from "next/link";
// TODO: import { AgentStatePanel } from "@/components/crews/AgentStatePanel";
// TODO: import { DayTimeline } from "@/components/crews/DayTimeline";
// TODO: import { DecisionCard } from "@/components/crews/DecisionCard";
import { crewai } from "@/lib/crewai-client";
import { Card, HomShell, PageHeader } from "../../../_components/Shell";

export const metadata = { title: "Run history — Chief of Staff — Helm" };
export const dynamic = "force-dynamic";

interface RunSummary {
  kickoff_id: string;
  trigger?: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
    case "success":
      return "text-(--accent-teal)";
    case "running":
    case "pending":
      return "text-(--warn)";
    case "failed":
    case "error":
      return "text-(--danger)";
    default:
      return "text-text-muted";
  }
}

export default async function ChiefHistoryPage() {
  let runs: RunSummary[] = [];
  let listError: string | null = null;

  try {
    runs = (await crewai.listChiefRuns()) as RunSummary[];
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load runs";
  }

  return (
    <HomShell current="/admin/orchestrator/crews/chief">
      <PageHeader
        title="Daily Chief of Staff"
        subtitle="Historique des runs et décisions du Chief."
      />

      <div className="mb-(--space-2) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
        Orchestrator · Crews
      </div>

      {listError ? (
        <Card>
          <p className="t-13 text-(--danger)">{listError}</p>
        </Card>
      ) : runs.length === 0 ? (
        <Card>
          <p className="t-13 text-text-muted">
            Aucun run pour l&apos;instant. Déclenchez un brief depuis la page principale.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-(--line)">
                <th className="px-(--space-4) py-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Kickoff ID
                </th>
                <th className="px-(--space-4) py-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Trigger
                </th>
                <th className="px-(--space-4) py-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Statut
                </th>
                <th className="px-(--space-4) py-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Démarré
                </th>
                <th className="px-(--space-4) py-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Terminé
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.kickoff_id}
                  className="border-b border-(--line) last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <td className="px-(--space-4) py-(--space-3) t-11 font-mono text-text-ghost">
                    <Link
                      href={`/admin/orchestrator/crews/chief/runs/${r.kickoff_id}`}
                      prefetch={false}
                      className="hover:text-text transition-colors"
                    >
                      {r.kickoff_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-(--space-4) py-(--space-3) t-12 text-text-muted">
                    {r.trigger ?? "—"}
                  </td>
                  <td className="px-(--space-4) py-(--space-3)">
                    <span className={`t-11 font-mono ${statusColor(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-(--space-4) py-(--space-3) t-11 font-mono text-text-ghost">
                    {formatDate(r.started_at)}
                  </td>
                  <td className="px-(--space-4) py-(--space-3) t-11 font-mono text-text-ghost">
                    {r.finished_at ? formatDate(r.finished_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </HomShell>
  );
}
