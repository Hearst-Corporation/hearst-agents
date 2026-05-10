import { HomShell, PageHeader, Card, MetricCell } from "../_components/Shell";
import { loadDriftLog } from "@/lib/hom/drift";

export const dynamic = "force-dynamic";

export default async function DriftPage() {
  const drift = await loadDriftLog();

  const byType: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  for (const d of drift) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
    byFile[d.file] = (byFile[d.file] ?? 0) + 1;
  }
  const topFiles = Object.entries(byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  return (
    <HomShell current="/admin/orchestrator/drift">
      <PageHeader
        title="Drift"
        subtitle="Régressions détectées vs design system : couleurs hardcodées, magic spacings, voix éditoriale."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-3) mb-(--space-6)">
        <MetricCell label="Total" value={drift.length} tone={drift.length > 0 ? "warn" : "ok"} />
        <MetricCell
          label="High"
          value={drift.filter((d) => d.severity === "high").length}
          tone={drift.filter((d) => d.severity === "high").length > 0 ? "bad" : "ok"}
        />
        <MetricCell
          label="Medium"
          value={drift.filter((d) => d.severity === "medium").length}
          tone="warn"
        />
        <MetricCell label="Low" value={drift.filter((d) => d.severity === "low").length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-(--space-4) mb-(--space-4)">
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Par type
          </h3>
          {Object.keys(byType).length === 0 ? (
            <p className="t-12 text-text-faint">Aucun drift détecté.</p>
          ) : (
            <ul className="space-y-(--space-2)">
              {Object.entries(byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <li key={type} className="flex items-baseline justify-between">
                    <span className="t-12 text-text-muted">{type}</span>
                    <span className="t-12 font-mono text-text">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Top fichiers
          </h3>
          {topFiles.length === 0 ? (
            <p className="t-12 text-text-faint">—</p>
          ) : (
            <ul className="space-y-(--space-1)">
              {topFiles.map(([file, count]) => (
                <li key={file} className="flex items-baseline justify-between gap-(--space-2)">
                  <span className="t-11 font-mono text-text-muted truncate">{file}</span>
                  <span className="t-11 font-mono text-(--warn)">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-(--space-4) py-(--space-2) border-b border-(--line) bg-surface-1">
          <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Findings récents (50 derniers)
          </span>
        </div>
        <div className="max-h-(--max-height-admin-scroll-area) overflow-y-auto">
          {drift
            .slice(-50)
            .reverse()
            .map((d) => {
              const tone =
                d.severity === "critical" || d.severity === "high"
                  ? "text-(--danger)"
                  : d.severity === "medium"
                    ? "text-(--warn)"
                    : "text-text-muted";
              return (
                <div
                  key={d.id}
                  className="px-(--space-4) py-(--space-2) border-b border-(--line) last:border-0 hover:bg-surface-1 transition-colors"
                >
                  <div className="flex items-baseline justify-between mb-(--space-1)">
                    <span className="t-10 font-mono text-text-faint">{d.type}</span>
                    <span className={`t-10 font-mono ${tone}`}>{d.severity}</span>
                  </div>
                  <div className="t-11 font-mono text-text">
                    {d.file}
                    {d.line ? `:${d.line}` : ""}
                  </div>
                  <div className="t-10 font-mono text-text-muted truncate mt-(--space-1)">
                    {d.snippet}
                  </div>
                </div>
              );
            })}
          {drift.length === 0 ? (
            <p className="t-12 text-text-faint px-(--space-4) py-(--space-4)">
              Aucun drift dans le journal.
            </p>
          ) : null}
        </div>
      </Card>
    </HomShell>
  );
}
