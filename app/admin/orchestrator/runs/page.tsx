import Link from "next/link";
import { listRuns } from "@/lib/hom/registry";
import { Card, HomShell, PageHeader } from "../_components/Shell";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await listRuns();

  return (
    <HomShell current="/admin/orchestrator/runs">
      <PageHeader
        title="Runs"
        subtitle="Historique des exécutions du mesh — décisions et signatures."
      />
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-12 px-(--space-4) py-(--space-2) border-b border-(--line) bg-surface-1">
          <span className="col-span-3 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Run ID
          </span>
          <span className="col-span-3 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Date
          </span>
          <span className="col-span-3 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Decision
          </span>
          <span className="col-span-3 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint" />
        </div>
        {runs.length === 0 ? (
          <div className="px-(--space-4) py-(--space-6) text-center">
            <p className="t-13 text-text-muted">Aucun run encore.</p>
            <p className="t-11 text-text-faint mt-(--space-1)">
              Lance un run via la page Vue d&apos;ensemble.
            </p>
          </div>
        ) : (
          runs.map((run) => {
            const tone =
              run.decision === "release_candidate"
                ? "text-(--accent-teal)"
                : run.decision === "release_blocked"
                  ? "text-(--danger)"
                  : "text-(--warn)";
            return (
              <Link
                key={run.run_id}
                href={`/admin/orchestrator/runs/${run.run_id}`}
                className="grid grid-cols-12 items-center px-(--space-4) py-(--space-3) border-b border-(--line) last:border-0 hover:bg-surface-1 transition-colors"
              >
                <span className="col-span-3 t-11 font-mono text-text">{run.run_id}</span>
                <span className="col-span-3 t-11 font-mono text-text-muted">
                  {new Date(run.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                </span>
                <span className={`col-span-3 t-12 ${tone}`}>{run.decision ?? "—"}</span>
                <span className="col-span-3 t-11 text-(--accent-teal) text-right">détail →</span>
              </Link>
            );
          })
        )}
      </Card>
    </HomShell>
  );
}
