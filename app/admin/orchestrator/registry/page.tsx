import { buildRegistry } from "@/lib/hom/registry";
import { Card, HomShell, MetricCell, PageHeader } from "../_components/Shell";

export const dynamic = "force-dynamic";

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? "all";
  const reg = await buildRegistry();
  const filtered = view === "all" ? reg.entries : reg.entries.filter((e) => e.kind === view);

  const tabs = [
    { key: "all", label: "Tout", count: reg.entries.length },
    { key: "page", label: "Pages", count: reg.totals.pages },
    { key: "component", label: "Composants", count: reg.totals.components },
    { key: "api-route", label: "Routes API", count: reg.totals.api_routes },
    { key: "test", label: "Tests", count: reg.totals.tests },
    { key: "store", label: "Stores", count: reg.totals.stores },
  ];

  return (
    <HomShell current="/admin/orchestrator/registry">
      <PageHeader
        title="System Registry"
        subtitle="Vérité structurelle agrégée : composants, routes, tests, ownership, drift, trust."
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-(--space-3) mb-(--space-6)">
        <MetricCell label="Pages" value={reg.totals.pages} />
        <MetricCell label="Composants" value={reg.totals.components} />
        <MetricCell label="Routes API" value={reg.totals.api_routes} />
        <MetricCell label="Tests" value={reg.totals.tests} />
        <MetricCell label="Stores" value={reg.totals.stores} />
        <MetricCell
          label="Drift"
          value={reg.totals.drift_findings}
          tone={reg.totals.drift_findings > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="flex flex-wrap gap-(--space-1) mb-(--space-4)">
        {tabs.map((tab) => {
          const active = view === tab.key;
          return (
            <a
              key={tab.key}
              href={`/admin/orchestrator/registry?view=${tab.key}`}
              className={
                active
                  ? "px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-(--accent-teal-bg-active) text-(--accent-teal) t-11 font-mono"
                  : "px-(--space-3) py-(--space-1) rounded-(--radius-pill) text-text-muted hover:text-text hover:bg-surface-1 t-11 font-mono transition-colors"
              }
            >
              {tab.label} <span className="text-text-faint">({tab.count})</span>
            </a>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-12 px-(--space-4) py-(--space-2) border-b border-(--line) bg-surface-1">
          <span className="col-span-1 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Kind
          </span>
          <span className="col-span-6 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Path
          </span>
          <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Owner
          </span>
          <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Drift
          </span>
          <span className="col-span-1 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Test
          </span>
        </div>
        <div className="max-h-(--max-height-admin-scroll-area) overflow-y-auto">
          {filtered.slice(0, 500).map((entry, i) => (
            <div
              key={`${entry.path}-${i}`}
              className="grid grid-cols-12 items-center px-(--space-4) py-(--space-2) border-b border-(--line) last:border-0 hover:bg-surface-1 transition-colors"
            >
              <span className="col-span-1 t-10 font-mono text-text-faint">{entry.kind}</span>
              <span className="col-span-6 t-11 font-mono text-text-muted truncate">
                {entry.path}
              </span>
              <span className="col-span-2 t-11 text-text-muted">
                {entry.owner ?? <span className="text-text-faint">—</span>}
              </span>
              <span className="col-span-2 t-11 font-mono">
                {entry.drift_findings === 0 ? (
                  <span className="text-text-faint">0</span>
                ) : (
                  <span className="text-(--warn)">{entry.drift_findings}</span>
                )}
              </span>
              <span className="col-span-1 t-11">
                {entry.has_test ? (
                  <span className="text-(--accent-teal)">✓</span>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </span>
            </div>
          ))}
          {filtered.length > 500 ? (
            <div className="px-(--space-4) py-(--space-2) t-11 text-text-faint">
              … {filtered.length - 500} entrée(s) supplémentaire(s)
            </div>
          ) : null}
        </div>
      </Card>
    </HomShell>
  );
}
