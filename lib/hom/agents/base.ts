/**
 * Helpers communs aux 3 agents : exécution timée, écriture du rapport
 * append-only, calcul du hash chain, propagation telemetry.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, nowIso, readTextSafe, sha256, shortId } from "../fs-utils";
import { HOM } from "../paths";
import { startSpan } from "../telemetry";
import type {
  AgentId,
  AgentReport,
  AgentRunResult,
  AgentStatus,
  Finding,
  Severity,
} from "../types";
import { SEVERITY_RANK } from "../types";

const SEVERITY_PENALTY: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 5,
  high: 12,
  critical: 25,
};

export interface ScanResult {
  findings: Finding[];
  files_scanned: number;
}

export interface AgentExecCtx {
  runId: string;
  correlationId: string;
}

export type ScanFn = (ctx: AgentExecCtx) => Promise<ScanResult>;

export async function runAgent(
  agent: AgentId,
  ctx: AgentExecCtx,
  scanFn: ScanFn,
): Promise<AgentRunResult> {
  const span = startSpan({
    trace_id: ctx.runId,
    correlation_id: ctx.correlationId,
    agent_id: agent,
    phase: "audit",
    name: `agent.${agent}.scan`,
  });
  await span.log("info", `agent ${agent} starting`);
  const start = Date.now();

  try {
    const result = await scanFn(ctx);
    const duration_ms = Date.now() - start;
    const severity_max = severityMaxOf(result.findings);
    const score = scoreOf(result.findings);
    const status = statusOf(severity_max);

    const report = await writeReport(agent, ctx.runId, {
      findings: result.findings,
      files_scanned: result.files_scanned,
      duration_ms,
      severity_max,
      score,
      status,
    });

    await span.end({
      status: "ok",
      attributes: {
        findings_count: result.findings.length,
        severity_max,
        score,
        files_scanned: result.files_scanned,
      },
    });

    return {
      agent,
      status,
      report_path: report,
      severity_max,
      score,
      findings_count: result.findings.length,
      findings_by_severity: countBySeverity(result.findings),
      duration_ms,
      retries: 0,
      quarantined: false,
      anomaly_score: 0,
    };
  } catch (err) {
    const duration_ms = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await span.log("error", `agent ${agent} failed`, { error: message });
    await span.end({ status: "error", attributes: { error: message } });
    return {
      agent,
      status: "red",
      report_path: null,
      severity_max: "critical",
      score: 0,
      findings_count: 0,
      findings_by_severity: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
      duration_ms,
      retries: 0,
      quarantined: false,
      anomaly_score: 0.9,
      error: message,
    };
  }
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const stack: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) stack[f.severity] += 1;
  return stack;
}

interface ReportInput {
  findings: Finding[];
  files_scanned: number;
  duration_ms: number;
  severity_max: Severity;
  score: number;
  status: AgentStatus;
}

async function writeReport(agent: AgentId, runId: string, input: ReportInput): Promise<string> {
  const dir = HOM.auditsAgent(agent);
  await ensureDir(dir);
  const ts = nowIso().replace(/[:.]/g, "-");
  const reportFile = path.join(dir, `${ts}-${runId}.md`);

  // Hash chain : lire le dernier rapport pour récupérer son hash.
  const hashPrev = await getPrevHash(dir);

  const reportObject: Omit<AgentReport, "hash_self"> = {
    report_id: `${runId}-${agent}`,
    run_id: runId,
    agent,
    authored_by: `agent/${agent}`,
    signed_by: "orchestrator/master",
    authored_at: nowIso(),
    signed_at: nowIso(),
    severity_max: input.severity_max,
    score: input.score,
    status: input.status,
    hash_prev: hashPrev,
    scope: [],
    production_impact: input.severity_max === "critical" ? "high" : "low",
    rollback_required: false,
    duration_ms: input.duration_ms,
    files_scanned: input.files_scanned,
    findings: input.findings,
    trust_delta: {},
  };

  const body = renderMarkdown(reportObject);
  const hash_self = sha256(body);
  const final = `${body}\n\n<!-- hash:${hash_self} -->\n`;
  await fs.writeFile(reportFile, final, "utf8");
  return path.relative(process.cwd(), reportFile);
}

async function getPrevHash(dir: string): Promise<string | null> {
  try {
    const files = await fs.readdir(dir);
    const sorted = files.filter((f) => f.endsWith(".md")).sort();
    if (sorted.length === 0) return null;
    const last = await readTextSafe(path.join(dir, sorted[sorted.length - 1]));
    if (!last) return null;
    const m = last.match(/<!-- hash:([0-9a-f]{64}) -->/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function severityMaxOf(findings: Finding[]): Severity {
  let max: Severity = "info";
  for (const f of findings) {
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max]) max = f.severity;
  }
  return max;
}

function scoreOf(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    score -= SEVERITY_PENALTY[f.severity];
  }
  return Math.max(0, Math.round(score));
}

function statusOf(sev: Severity): AgentStatus {
  switch (sev) {
    case "critical":
      return "red";
    case "high":
      return "amber";
    case "medium":
      return "amber";
    default:
      return "green";
  }
}

function renderMarkdown(r: Omit<AgentReport, "hash_self">): string {
  const fm = [
    "---",
    `report_id: ${r.report_id}`,
    `run_id: ${r.run_id}`,
    `agent: ${r.agent}`,
    `authored_by: ${r.authored_by}`,
    `signed_by: ${r.signed_by}`,
    `authored_at: ${r.authored_at}`,
    `signed_at: ${r.signed_at}`,
    `severity_max: ${r.severity_max}`,
    `score: ${r.score}`,
    `status: ${r.status}`,
    `hash_prev: ${r.hash_prev ?? "null"}`,
    `production_impact: ${r.production_impact}`,
    `rollback_required: ${r.rollback_required}`,
    `duration_ms: ${r.duration_ms}`,
    `files_scanned: ${r.files_scanned}`,
    "---",
  ].join("\n");

  const summary = [
    "",
    "## Executive summary",
    `- Findings : **${r.findings.length}** (severity max : ${r.severity_max})`,
    `- Score : ${r.score} / 100`,
    `- Files scanned : ${r.files_scanned}`,
    `- Duration : ${r.duration_ms} ms`,
    "",
  ].join("\n");

  const findingsBlock =
    r.findings.length === 0
      ? "## Findings\n\nAucun finding détecté.\n"
      : [
          "## Findings",
          "",
          ...r.findings.map(
            (f) =>
              `### [${f.severity.toUpperCase()}] ${f.title}\n\n` +
              `**Scope** : \`${f.scope}\`\n\n` +
              `${f.detail}\n\n` +
              (f.evidence.length
                ? `Evidence : ${f.evidence.map((e) => `\`${e}\``).join(", ")}\n\n`
                : ""),
          ),
        ].join("\n");

  return `${fm}\n${summary}\n${findingsBlock}`;
}

export function makeFindingId(): string {
  return shortId("f");
}
