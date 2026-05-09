import { HomShell, PageHeader, Card, MetricCell } from "../_components/Shell";
import { readDayLogs } from "@/lib/hom/telemetry";
import { todayUtc } from "@/lib/hom/paths";
import { ALL_AGENTS } from "@/lib/hom/types";

export const dynamic = "force-dynamic";

export default async function TelemetryPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; agent?: string }>;
}) {
  const sp = await searchParams;
  const day = sp.day ?? todayUtc();
  const agent = sp.agent ?? "master";

  const logs = await readDayLogs(day, agent);
  const errors = logs.filter((l) => l.level === "error" || l.level === "fatal").length;
  const warns = logs.filter((l) => l.level === "warn").length;

  const agentTabs = ["master", ...ALL_AGENTS, "system"];

  return (
    <HomShell current="/admin/orchestrator/telemetry">
      <PageHeader
        title="Telemetry"
        subtitle={`Logs structurés JSONL · jour ${day} · agent ${agent}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-3) mb-(--space-4)">
        <MetricCell label="Total logs" value={logs.length} />
        <MetricCell label="Errors" value={errors} tone={errors > 0 ? "bad" : "ok"} />
        <MetricCell label="Warns" value={warns} tone={warns > 0 ? "warn" : "ok"} />
        <MetricCell
          label="Info+"
          value={logs.filter((l) => l.level === "info" || l.level === "debug").length}
        />
      </div>

      <div className="flex flex-wrap gap-(--space-1) mb-(--space-4)">
        {agentTabs.map((a) => {
          const active = a === agent;
          return (
            <a
              key={a}
              href={`/admin/orchestrator/telemetry?agent=${a}&day=${day}`}
              className={
                active
                  ? "px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-(--accent-teal-bg-active) text-(--accent-teal) t-11 font-mono"
                  : "px-(--space-3) py-(--space-1) rounded-(--radius-pill) text-text-muted hover:text-text hover:bg-surface-1 t-11 font-mono transition-colors"
              }
            >
              {a}
            </a>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto font-mono">
          {logs.length === 0 ? (
            <div className="p-(--space-4) t-12 text-text-faint">
              Aucun log pour cet agent ce jour.
            </div>
          ) : (
            logs
              .slice(-300)
              .reverse()
              .map((log, i) => {
                const tone =
                  log.level === "error" || log.level === "fatal"
                    ? "text-(--danger)"
                    : log.level === "warn"
                      ? "text-(--warn)"
                      : "text-text-muted";
                return (
                  <div
                    key={i}
                    className="px-(--space-3) py-(--space-1) border-b border-(--line) hover:bg-surface-1 transition-colors flex gap-(--space-2)"
                  >
                    <span className="t-10 text-text-faint shrink-0">
                      {new Date(log.ts).toLocaleTimeString("fr-FR")}
                    </span>
                    <span className={`t-10 shrink-0 w-(--space-12) ${tone}`}>{log.level}</span>
                    <span className="t-10 text-text-faint shrink-0">{log.span_id}</span>
                    <span className="t-11 text-text-muted truncate">{log.msg}</span>
                  </div>
                );
              })
          )}
        </div>
      </Card>
    </HomShell>
  );
}
