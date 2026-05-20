import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentDiff } from "@/components/crews/AgentDiff";
import { AgentStatePanel } from "@/components/crews/AgentStatePanel";
import { DayTimeline } from "@/components/crews/DayTimeline";
import { DecisionCard } from "@/components/crews/DecisionCard";
import { CrewAIError, crewai } from "@/lib/crewai-client";
import type { AgentRow, DiffItem, P0Item, RunStats, TimelineMarker } from "@/lib/types/swarm";
import { isValidUuidV4 } from "@/lib/utils/uuid";
import { Card, HomShell, PageHeader } from "../../../../_components/Shell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ runId: string }>;
}

// ─── Shapes from the crewai engine ────────────────────────────────────────────

interface ChiefStatus {
  kickoff_id: string;
  status: string;
  trigger?: string;
  started_at?: string;
  finished_at?: string | null;
  result?: string | null;
  state?: Record<string, unknown> | null;
}

interface ChiefStep {
  agent_name?: string;
  task_name?: string;
  status?: string;
  created_at?: string;
  output_text?: string | null;
}

interface ChiefDecision {
  from?: string;
  subject?: string;
  action?: string;
  channel?: string;
  draft_text?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RUNNING_STATUSES = new Set(["running", "pending", "paused_hitl"]);

function isRunning(status: string): boolean {
  return RUNNING_STATUSES.has(status);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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
    case "paused_hitl":
      return "text-(--accent-llm)";
    default:
      return "text-text-muted";
  }
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

function stepsToAgentRows(steps: ChiefStep[]): AgentRow[] {
  const seen = new Map<string, AgentRow>();
  for (const step of steps) {
    const name = step.agent_name ?? "Unknown";
    if (!seen.has(name)) {
      const initials = name
        .split(/[\s_-]+/)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("");
      const active = step.status === "running";
      seen.set(name, {
        initials,
        name,
        status: active ? "active" : "idle",
        statusLabel: step.status ?? "idle",
      });
    }
  }
  return Array.from(seen.values());
}

function stepsToDiffItems(steps: ChiefStep[]): DiffItem[] {
  return steps
    .filter((s) => s.output_text)
    .slice(-20)
    .map((s) => ({
      time: s.created_at
        ? new Date(s.created_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      agentName: s.agent_name ?? "—",
      text: (s.output_text ?? "").slice(0, 200),
    }));
}

function stepsToTimeline(steps: ChiefStep[], runStatus: string): TimelineMarker[] {
  if (steps.length === 0) return [];
  const total = steps.length;
  const doneCount = steps.filter((s) => s.status === "completed" || s.status === "success").length;
  const nowIndex = doneCount < total ? doneCount : total - 1;

  return steps.slice(0, Math.min(steps.length, 6)).map((s, i) => {
    let variant: TimelineMarker["variant"] = "future";
    if (i < nowIndex) variant = "done";
    else if (i === nowIndex && isRunning(runStatus)) variant = "now";
    else if (i < doneCount) variant = "done";

    return {
      leftPercent: total === 1 ? 50 : (i / (total - 1)) * 100,
      time: s.created_at
        ? new Date(s.created_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      label: s.task_name ?? s.agent_name ?? `Step ${i + 1}`,
      variant,
    };
  });
}

function decisionsToP0(decisions: ChiefDecision[]): P0Item | null {
  const first = decisions[0];
  if (!first) return null;
  return {
    from: first.from ?? "unknown",
    subject: first.subject ?? "(no subject)",
    action: first.action ?? "",
    channel: first.channel ?? "Gmail",
  };
}

// ─── AutoPoll client component ────────────────────────────────────────────────

// Inlined to avoid creating a new file (out of scope).
// Uses a meta-refresh approach via Next.js revalidation.
// We emit a <meta http-equiv="refresh"> tag when the run is live.
function AutoPoll({ active, seconds }: { active: boolean; seconds: number }) {
  if (!active) return null;
  return (
    // eslint-disable-next-line @next/next/no-head-element
    <meta httpEquiv="refresh" content={String(seconds)} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ChiefRunDetailPage({ params }: PageProps) {
  const { runId } = await params;

  if (!isValidUuidV4(runId)) {
    notFound();
  }

  // ── Parallel fetches ────────────────────────────────────────────────────────
  let run: ChiefStatus;
  let steps: ChiefStep[] = [];
  let decisions: ChiefDecision[] = [];
  let fetchError: string | null = null;

  try {
    run = (await crewai.getChiefStatus(runId)) as ChiefStatus;
  } catch (err) {
    if (err instanceof Error && (err as CrewAIError).status === 404) {
      notFound();
    }
    fetchError = err instanceof Error ? err.message : "Erreur inconnue";
    // Render error state inside the shell
    return (
      <HomShell current="/admin/orchestrator/crews/chief">
        <PageHeader title="Chief of Staff — Run detail" subtitle={`Run ${runId.slice(0, 8)}…`} />
        <Card>
          <p className="t-13 text-(--danger)">{fetchError}</p>
          <Link
            href="/admin/orchestrator/crews/chief/history"
            className="t-12 text-text-muted hover:text-text mt-(--space-3) inline-block"
          >
            ← Retour à l&apos;historique
          </Link>
        </Card>
      </HomShell>
    );
  }

  // Best-effort: steps and decisions — don't block the page on failure
  try {
    [steps, decisions] = await Promise.all([
      crewai.getChiefSteps(runId) as Promise<ChiefStep[]>,
      crewai.getChiefDecisions(runId) as Promise<ChiefDecision[]>,
    ]);
  } catch {
    // non-fatal — panels render empty state
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const running = isRunning(run.status);
  const agentRows: AgentRow[] = stepsToAgentRows(steps);
  const diffItems: DiffItem[] = stepsToDiffItems(steps);
  const timelineMarkers: TimelineMarker[] = stepsToTimeline(steps, run.status);
  const p0Item: P0Item | null = decisionsToP0(decisions);
  const draftText: string | null = decisions[0]?.draft_text ?? null;
  const runStats: RunStats | null =
    steps.length > 0 ? { total: steps.length, p0: decisions.length, p1: 0 } : null;

  let resultPretty: string | null = null;
  if (run.result) {
    try {
      resultPretty = JSON.stringify(JSON.parse(run.result), null, 2);
    } catch {
      resultPretty = run.result;
    }
  }

  const triggerLabel =
    run.trigger ??
    (run.state && typeof run.state === "object" && "trigger" in run.state
      ? String(run.state["trigger"])
      : "—");

  const sinceLabel = run.started_at
    ? new Date(run.started_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      })
    : "—";

  const elapsedLabel = (() => {
    if (!run.started_at) return "—";
    const end = run.finished_at ? new Date(run.finished_at) : new Date();
    const ms = end.getTime() - new Date(run.started_at).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  })();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <HomShell current="/admin/orchestrator/crews/chief">
      {/* Auto-poll 3s while running */}
      <AutoPoll active={running} seconds={3} />

      <PageHeader
        title="Daily Chief of Staff — Run detail"
        subtitle={`Run ${runId.slice(0, 8)}… · trigger : ${triggerLabel}`}
      />

      {/* Breadcrumb + status */}
      <div className="flex items-center gap-(--space-3) mb-(--space-6) flex-wrap">
        <Link
          href="/admin/orchestrator/crews/chief/history"
          className="t-12 text-text-muted hover:text-text transition-colors"
        >
          ← Historique
        </Link>
        <span className="t-10 text-text-faint">·</span>
        <span className={`t-11 font-mono ${statusColor(run.status)}`}>{run.status}</span>
        {running && (
          <span className="inline-block w-2 h-2 rounded-full bg-(--warn) animate-pulse" />
        )}
      </div>

      {/* Metadata row */}
      <div className="grid grid-cols-2 gap-(--space-4) mb-(--space-6)">
        <Card>
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-1)">
            Démarré
          </p>
          <p className="t-12 font-mono text-text">
            {run.started_at ? formatDate(run.started_at) : "—"}
          </p>
        </Card>
        <Card>
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-1)">
            Terminé
          </p>
          <p className="t-12 font-mono text-text">
            {run.finished_at ? formatDate(run.finished_at) : "—"}
          </p>
        </Card>
      </div>

      {/* Main grid: left column (state + diff) / right column (decision + timeline) */}
      <div className="grid grid-cols-[1fr_1fr] gap-(--space-5) mb-(--space-6)">
        {/* Left */}
        <div className="flex flex-col gap-(--space-5)">
          <AgentStatePanel
            agentRows={agentRows}
            runStats={runStats}
            lastRunAt={run.started_at ? formatDate(run.started_at) : null}
            runStatus={run.status}
          />
          <AgentDiff items={diffItems} sinceLabel={sinceLabel} elapsed={elapsedLabel} />
        </div>

        {/* Right */}
        <div className="flex flex-col gap-(--space-5)">
          <DecisionCard p0Item={p0Item} draftText={draftText} runId={runId} />
          <DayTimeline markers={timelineMarkers} />
        </div>
      </div>

      {/* Result block */}
      {resultPretty && (
        <div className="mb-(--space-6)">
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
            Résultat
          </p>
          <Card className="p-0 overflow-hidden">
            <pre className="overflow-auto p-(--space-5) t-11 font-mono text-text leading-relaxed m-0">
              {resultPretty}
            </pre>
          </Card>
        </div>
      )}

      {/* Raw state (debug) */}
      {run.state && (
        <details className="mb-(--space-6)">
          <summary className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint cursor-pointer select-none mb-(--space-2)">
            State (debug)
          </summary>
          <Card className="p-0 overflow-hidden">
            <pre className="overflow-auto p-(--space-5) t-11 font-mono text-text-muted leading-relaxed m-0">
              {JSON.stringify(run.state, null, 2)}
            </pre>
          </Card>
        </details>
      )}
    </HomShell>
  );
}
