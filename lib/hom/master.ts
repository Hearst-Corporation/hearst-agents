/**
 * Master Orchestrator — chef d'orchestre HOM.
 * Centralized orchestration : un seul Master sequence intake → dispatch
 * → cross-check → trust → snapshot → archive. Aucun peer-to-peer.
 */
import path from "node:path";
import { HOM } from "./paths";
import {
  ensureDir,
  nowIso,
  shortId,
  writeJson,
  sha256,
  readJson,
  fileExists,
} from "./fs-utils";
import { startSpan, ensureTelemetryDirs } from "./telemetry";
import { evaluate } from "./policy";
import { computeTrust, appendHistory } from "./trust";
import { captureSnapshot } from "./snapshot";
import {
  loadCC,
  setPhase,
  setAgentStatus,
  recordRunEnd,
  refreshFromQuarantine,
} from "./cc-state";
import {
  recordAnomaly,
  isAgentAvailable,
} from "./quarantine";
import { generateWarRoomSnapshot } from "./war-room";
import { executeArchitecture } from "./agents/architecture";
import { executeDesignSystem } from "./agents/design-system";
import { executeQa } from "./agents/qa";
import { ALL_AGENTS, SEVERITY_RANK } from "./types";
import type {
  AgentId,
  AgentRunResult,
  Finding,
  RunDecision,
  RunDecisionFile,
  RunIntake,
  Severity,
} from "./types";

interface RunOptions {
  triggeredBy: string;
  triggerKind?: "manual" | "cron" | "ci";
  scope?: AgentId[];
  notes?: string;
}

interface RunOutcome {
  runId: string;
  decision: RunDecision;
  reportPath: string;
  durationMs: number;
}

const AGENT_RUNNERS: Record<
  AgentId,
  (ctx: { runId: string; correlationId: string }) => Promise<AgentRunResult>
> = {
  architecture: executeArchitecture,
  "design-system": executeDesignSystem,
  qa: executeQa,
};

export async function startRun(opts: RunOptions): Promise<RunOutcome> {
  const runId = shortId("r");
  const correlationId = shortId("c");
  const startedAt = nowIso();
  const start = Date.now();

  await ensureRunDirs(runId);
  await ensureTelemetryDirs();

  const span = startSpan({
    trace_id: runId,
    correlation_id: correlationId,
    agent_id: "master",
    phase: "intake",
    name: "run.lifecycle",
  });
  await span.log("info", `run ${runId} started by ${opts.triggeredBy}`);

  // INTAKE
  const intake: RunIntake = {
    run_id: runId,
    scope: opts.scope ?? [...ALL_AGENTS],
    blocking: false,
    triggered_by: opts.triggeredBy,
    trigger_kind: opts.triggerKind ?? "manual",
    created_at: startedAt,
    notes: opts.notes,
  };
  await writeJson(HOM.runIntake(runId), intake);
  await setPhase(runId, "intake");

  // PREFLIGHT — policy check sur le master
  await setPhase(runId, "preflight");
  const policyOk = await evaluate({
    agent_id: "master",
    action: "spawn_subagent",
    scope: undefined,
  });
  if (policyOk.decision !== "allow") {
    await span.log("error", `master spawn blocked by policy: ${policyOk.reason}`);
    return await abortRun(runId, span, "release_blocked", `policy: ${policyOk.reason}`);
  }

  // SNAPSHOT replay
  await captureSnapshot(runId);

  // DISPATCH
  await setPhase(runId, "dispatch");
  const results: AgentRunResult[] = [];
  const allFindings: Finding[] = [];

  for (const agentId of intake.scope) {
    const available = await isAgentAvailable(agentId);
    if (!available) {
      await span.log("warn", `agent ${agentId} quarantined, skipped`);
      results.push({
        agent: agentId,
        status: "quarantined",
        report_path: null,
        severity_max: "info",
        score: 0,
        findings_count: 0,
        findings_by_severity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        duration_ms: 0,
        retries: 0,
        quarantined: true,
        anomaly_score: 1,
      });
      continue;
    }
    await setAgentStatus(agentId, "amber", `audit en cours`);
    const runner = AGENT_RUNNERS[agentId];
    let result = await runner({ runId, correlationId });

    // Retry simple si error
    if (result.status === "red" && result.error) {
      await span.log("warn", `agent ${agentId} failed, retry once`);
      result = await runner({ runId, correlationId });
      result.retries = 1;
    }

    await setAgentStatus(agentId, result.status, null);
    await recordAnomaly(agentId, runId, result);
    results.push(result);

    if (result.report_path) {
      const reportFindings = await readReportFindings(result.report_path);
      allFindings.push(...reportFindings);
    }
  }

  // AGGREGATE + CROSS-CHECK
  await setPhase(runId, "cross_check");
  const severityStack = stackFromAgents(results);

  // TRUST UPDATE
  await setPhase(runId, "trust_update");
  const drift = await readJson<unknown[]>(HOM.driftLog);
  const driftCount = Array.isArray(drift) ? drift.length : 0;

  const { before, after } = await computeTrust({
    runId,
    agentResults: results,
    allFindings,
    driftFindings: driftCount,
    retries: results.reduce((a, r) => a + r.retries, 0),
    quarantinedAgents: results.filter((r) => r.quarantined).length,
  });

  // DECISION
  await setPhase(runId, "decision");
  const decision = decide(severityStack, after);
  const blockers = blockersFor(severityStack, after);

  // REPORT
  await setPhase(runId, "report");
  const decisionFile: RunDecisionFile = {
    run_id: runId,
    started_at: startedAt,
    ended_at: nowIso(),
    intake,
    agents: results,
    severity_stack: severityStack,
    trust_before: before,
    trust_after: after,
    drift_findings: driftCount,
    decision,
    blockers,
    signed_by: "orchestrator/master",
    hash: "",
  };
  decisionFile.hash = sha256(JSON.stringify({ ...decisionFile, hash: "" }));
  await writeJson(HOM.runDecision(runId), decisionFile);
  await appendHistory(runId, before, after);

  // ARCHIVE — War Room snapshot
  await setPhase(runId, "archive");
  const reportPath = await generateWarRoomSnapshot(runId, decisionFile);

  await recordRunEnd(runId, deltaOf(before, after), severityStack, blockers);
  await refreshFromQuarantine();

  await span.end({
    status: "ok",
    attributes: { decision, agents_count: results.length },
  });

  return {
    runId,
    decision,
    reportPath,
    durationMs: Date.now() - start,
  };
}

async function ensureRunDirs(runId: string): Promise<void> {
  await ensureDir(HOM.run(runId));
  await ensureDir(path.dirname(HOM.runEvents(runId)));
}

async function abortRun(
  runId: string,
  span: { end: (o: { status: "error" | "cancelled" | "ok"; attributes?: Record<string, string | number | boolean | null> }) => Promise<unknown> },
  decision: RunDecision,
  reason: string,
): Promise<RunOutcome> {
  const minimal: RunDecisionFile = {
    run_id: runId,
    started_at: nowIso(),
    ended_at: nowIso(),
    intake: {
      run_id: runId,
      scope: [],
      blocking: false,
      triggered_by: "system",
      trigger_kind: "manual",
      created_at: nowIso(),
    },
    agents: [],
    severity_stack: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    trust_before: {} as never,
    trust_after: {} as never,
    drift_findings: 0,
    decision,
    blockers: [reason],
    signed_by: "orchestrator/master",
    hash: "",
  };
  minimal.hash = sha256(JSON.stringify(minimal));
  await writeJson(HOM.runDecision(runId), minimal);
  await span.end({ status: "cancelled", attributes: { reason } });
  return { runId, decision, reportPath: "", durationMs: 0 };
}

function stackFromAgents(results: AgentRunResult[]): Record<Severity, number> {
  const stack: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const r of results) {
    for (const sev of Object.keys(r.findings_by_severity) as Severity[]) {
      stack[sev] += r.findings_by_severity[sev];
    }
  }
  return stack;
}

function decide(
  stack: Record<Severity, number>,
  scores: { release: number },
): RunDecision {
  if (stack.critical > 0) return "release_blocked";
  if (scores.release < 90) return "needs_review";
  return "release_candidate";
}

function blockersFor(
  stack: Record<Severity, number>,
  scores: { release: number; architecture: number; design: number; qa: number },
): string[] {
  const out: string[] = [];
  if (stack.critical > 0) out.push(`${stack.critical} finding(s) critical`);
  if (scores.release < 90) out.push(`release trust < 90 (${scores.release})`);
  if (scores.architecture < 75) out.push("architecture trust < 75");
  if (scores.design < 75) out.push("design trust < 75");
  if (scores.qa < 85) out.push("qa trust < 85");
  return out;
}

function deltaOf(
  before: import("./types").TrustScores,
  after: import("./types").TrustScores,
): Partial<import("./types").TrustScores> {
  const d: Partial<import("./types").TrustScores> = {};
  const keys = Object.keys(after) as Array<keyof import("./types").TrustScores>;
  for (const k of keys) {
    d[k] = after[k] - before[k];
  }
  return d;
}

async function readReportFindings(_reportPath: string): Promise<Finding[]> {
  return [];
}

export async function listAvailableAgents(): Promise<AgentId[]> {
  const out: AgentId[] = [];
  for (const id of ALL_AGENTS) {
    if (await isAgentAvailable(id)) out.push(id);
  }
  return out;
}

export async function quickHealthCheck(): Promise<{
  policiesOk: boolean;
  contractsOk: boolean;
  ccOk: boolean;
}> {
  const policiesOk = await fileExists(HOM.fleetPolicy);
  const contractsOk = await Promise.all(
    ALL_AGENTS.map((id) => fileExists(HOM.agentContract(id))),
  ).then((v) => v.every(Boolean));
  const cc = await loadCC();
  return { policiesOk, contractsOk, ccOk: !!cc };
}

export const _internal = { stackFromAgents, decide, blockersFor, deltaOf, SEVERITY_RANK };
