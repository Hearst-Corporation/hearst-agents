// TODO V2 — Race multi-onglets polling :
// Si l'utilisateur ouvre la même page run dans N onglets en parallèle, chaque
// onglet déclenche son propre AutoRefreshClient → N polls/sec vers
// /api/crewai/v1/swarms/[id]/status/[runId]. Pas critique en single-user,
// mais à corriger en V2 multi-tenant via BroadcastChannel cross-tab ou SSE.
import Link from "next/link";
import { notFound } from "next/navigation";
import { KPIDashboard } from "@/components/swarms/KPIDashboard";
import { RunTimeline } from "@/components/swarms/RunTimeline";
import { CrewAIError, crewai } from "@/lib/crewai-client";
import type { SwarmRun } from "@/lib/types/swarm";
import { formatDate } from "@/lib/utils/format";
import { isValidUuid } from "@/lib/utils/uuid";
import { Card, HomShell, PageHeader } from "../../../../_components/Shell";
import { AutoRefreshClient } from "./AutoRefreshClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; runId: string }>;
}

function isRunningStatus(status: string): boolean {
  return status === "running" || status === "pending" || status === "paused_hitl";
}

export default async function SwarmRunDetailPage({ params }: PageProps) {
  const { id, runId } = await params;
  if (!isValidUuid(id) || !isValidUuid(runId)) notFound();

  let run: SwarmRun;
  try {
    run = (await crewai.getSwarmRun(id, runId)) as SwarmRun;
    if (!run) notFound();
  } catch (err) {
    const e = err as CrewAIError;
    if (e?.status === 404) notFound();
    return (
      <HomShell current="/admin/orchestrator/swarms">
        <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
          <Link
            href={`/admin/orchestrator/swarms/${id}`}
            className="text-text-muted hover:text-text transition-colors no-underline"
          >
            ← Swarm
          </Link>
        </div>
        <p className="t-13 text-(--danger)">
          {err instanceof Error ? err.message : "Failed to load run"}
        </p>
      </HomShell>
    );
  }

  const isRunning = isRunningStatus(run.status);

  return (
    <HomShell current="/admin/orchestrator/swarms">
      {isRunning && <AutoRefreshClient intervalMs={3000} />}

      {/* Breadcrumb */}
      <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
        <Link
          href="/admin/orchestrator/swarms"
          className="text-text-muted hover:text-text transition-colors no-underline"
        >
          Swarms
        </Link>
        <span className="mx-(--space-2) text-text-faint">·</span>
        <Link
          href={`/admin/orchestrator/swarms/${id}`}
          className="text-text-muted hover:text-text transition-colors no-underline"
        >
          Swarm
        </Link>
        <span className="mx-(--space-2) text-text-faint">·</span>
        <span className="text-text-faint">Run {runId.slice(0, 8)}…</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-(--space-4) flex-wrap mb-(--space-6)">
        <div>
          <PageHeader title={`Run ${runId.slice(0, 8)}…`} subtitle={`trigger: ${run.trigger}`} />
          <div className="flex items-center gap-(--space-3) flex-wrap -mt-(--space-4)">
            <RunStatusBadge status={run.status} />
            {isRunning && (
              <span className="inline-flex items-center gap-(--space-1) t-11 text-(--warn)">
                <span
                  className="inline-block w-2 h-2 rounded-full bg-(--warn) animate-pulse"
                  aria-hidden="true"
                />
                Live
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KPIDashboard
        kpis={[
          {
            label: "Tokens in",
            value: run.total_tokens_in.toLocaleString("en-US"),
            accent: true,
          },
          {
            label: "Tokens out",
            value: run.total_tokens_out.toLocaleString("en-US"),
          },
          { label: "Cost $", value: run.total_cost_usd.toFixed(4) },
          { label: "Steps", value: run.steps.length },
        ]}
      />

      {/* Metadata */}
      <Card className="mb-(--space-4)">
        <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
          Metadata
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-(--space-4)">
          <Field
            label="Started"
            value={formatDate(run.started_at, { withSeconds: true, withYear: true })}
          />
          <Field
            label="Finished"
            value={
              run.finished_at
                ? formatDate(run.finished_at, { withSeconds: true, withYear: true })
                : "—"
            }
          />
          {run.langfuse_trace_id ? (
            <Field label="Langfuse trace" value={run.langfuse_trace_id} mono />
          ) : null}
        </div>
      </Card>

      {/* Error */}
      {run.error_text != null && run.error_text !== "" ? (
        <Card className="mb-(--space-4) border-(--danger) bg-(--danger-surface)">
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-(--danger) mb-(--space-3)">
            Error
          </p>
          <pre className="t-11 font-mono text-text whitespace-pre-wrap break-words overflow-auto max-h-64">
            {run.error_text}
          </pre>
        </Card>
      ) : null}

      {/* Result */}
      {run.result_text != null ? (
        <Card className="mb-(--space-4)">
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Result
          </p>
          <pre className="t-11 font-mono text-text bg-surface-2 border border-(--line) rounded-(--radius-md) p-(--space-3) whitespace-pre-wrap break-words overflow-auto max-h-96">
            {prettyJsonOrRaw(run.result_text)}
          </pre>
        </Card>
      ) : null}

      {/* Timeline */}
      <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3) mt-(--space-6)">
        Timeline ({run.steps.length} steps)
      </div>
      <RunTimeline steps={run.steps} status={run.status} />
    </HomShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-1)">
        {label}
      </p>
      <p className={`t-12 text-text break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const colorClass =
    status === "completed"
      ? "bg-(--accent-teal-bg-active) text-(--accent-teal)"
      : status === "running" || status === "pending"
        ? "bg-(--warn-surface) text-(--warn)"
        : status === "failed" || status === "cancelled"
          ? "bg-(--danger-surface) text-(--danger)"
          : "bg-surface-1 text-text-muted";

  return (
    <span
      className={`inline-block px-(--space-2) py-(--space-0) rounded-(--radius-pill) t-10 font-mono ${colorClass}`}
    >
      {status}
    </span>
  );
}

function prettyJsonOrRaw(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}
