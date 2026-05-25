import { latestScores, loadHistory, trustGate } from "@/lib/hom/trust";
import { Card, HomShell, MetricCell, PageHeader } from "../_components/Shell";

export const dynamic = "force-dynamic";

export default async function TrustPage() {
  const [scores, history] = await Promise.all([latestScores(), loadHistory()]);
  const gate = trustGate(scores);

  return (
    <HomShell current="/admin/orchestrator/trust">
      <PageHeader
        title="Trust"
        subtitle="7 dimensions de confiance — historique 30 derniers runs."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-(--space-3) mb-(--space-6)">
        {(Object.entries(scores) as Array<[keyof typeof scores, number]>).map(([key, value]) => {
          const tone = value >= 90 ? "ok" : value >= 75 ? "warn" : "bad";
          return <MetricCell key={key} label={key.replace("_", " ")} value={value} tone={tone} />;
        })}
      </div>

      {!gate.passed ? (
        <Card className="mb-(--space-4)">
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-(--warn) mb-(--space-2)">
            Release gates en échec
          </h3>
          <p className="t-12 text-text-muted">
            Dimensions sous le seuil minimum : {gate.failedKeys.join(", ")}
          </p>
        </Card>
      ) : (
        <Card className="mb-(--space-4)">
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-(--accent-teal) mb-(--space-2)">
            Toutes les gates passent
          </h3>
          <p className="t-12 text-text-muted">
            Le mesh est en zone signature pour la prochaine release.
          </p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-12 px-(--space-4) py-(--space-2) border-b border-(--line) bg-surface-1">
          <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Run
          </span>
          <span className="col-span-2 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Date
          </span>
          {(Object.keys(scores) as Array<keyof typeof scores>).map((k) => (
            <span
              key={k}
              className="col-span-1 t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint"
            >
              {k.slice(0, 4)}
            </span>
          ))}
        </div>
        {history.length === 0 ? (
          <div className="px-(--space-4) py-(--space-6) text-center">
            <p className="t-13 text-text-muted">Aucune donnée trust.</p>
          </div>
        ) : (
          [...history]
            .reverse()
            .slice(0, 30)
            .map((h) => (
              <div
                key={h.run_id + h.ts}
                className="grid grid-cols-12 items-center px-(--space-4) py-(--space-2) border-b border-(--line) last:border-0"
              >
                <span className="col-span-2 t-11 font-mono text-text-muted">{h.run_id}</span>
                <span className="col-span-2 t-11 font-mono text-text-faint">
                  {new Date(h.ts).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Paris",
                  })}
                </span>
                {(Object.keys(scores) as Array<keyof typeof scores>).map((k) => {
                  const v = h.scores[k];
                  const tone =
                    v >= 90
                      ? "text-(--accent-teal)"
                      : v >= 75
                        ? "text-(--warn)"
                        : "text-(--danger)";
                  return (
                    <span key={k} className={`col-span-1 t-11 font-mono ${tone}`}>
                      {v}
                    </span>
                  );
                })}
              </div>
            ))
        )}
      </Card>
    </HomShell>
  );
}
