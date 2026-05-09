/**
 * Hearst Operations Mesh — types partagés.
 *
 * Schémas centraux : run, span, finding, contract, policy, trust, drift.
 * Toutes les écritures de fichiers passent par des schémas validés ici.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AgentId = "architecture" | "design-system" | "qa";
export type AgentStatus = "green" | "amber" | "red" | "stale" | "quarantined";
export type RunDecision =
  | "release_candidate"
  | "release_blocked"
  | "needs_review"
  | "aborted";

export type RunPhase =
  | "intake"
  | "memory_load"
  | "preflight"
  | "dispatch"
  | "audit"
  | "cross_check"
  | "drift_check"
  | "aggregate"
  | "decision"
  | "trust_update"
  | "report"
  | "memory_write"
  | "archive"
  | "idle";

export interface Finding {
  id: string;
  agent: AgentId;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string[];
  remediation?: string;
  anti_pattern?: string;
  adr_referenced?: string[];
  scope: string;
}

export interface AgentReport {
  report_id: string;
  run_id: string;
  agent: AgentId;
  authored_by: string;
  signed_by: string;
  authored_at: string;
  signed_at: string;
  severity_max: Severity;
  score: number;
  status: AgentStatus;
  hash_prev: string | null;
  hash_self: string;
  scope: string[];
  production_impact: "none" | "low" | "medium" | "high" | "critical";
  rollback_required: boolean;
  duration_ms: number;
  files_scanned: number;
  findings: Finding[];
  trust_delta: Record<string, number>;
}

export interface Span {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  delegation_chain_id: string | null;
  correlation_id: string;
  agent_id: AgentId | "master";
  phase: RunPhase;
  name: string;
  start_ts: string;
  end_ts: string | null;
  status: "ok" | "error" | "cancelled";
  attributes: Record<string, string | number | boolean | null>;
}

export interface LogEvent {
  ts: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  trace_id: string;
  span_id: string;
  agent_id: AgentId | "master" | "system";
  msg: string;
  context?: Record<string, unknown>;
}

export interface MetricSample {
  ts: string;
  name: string;
  value: number;
  labels: Record<string, string>;
}

export interface AgentContract {
  agent_id: AgentId;
  version: string;
  model: { primary: string; fallback: string };
  scope: {
    files_allowed: string[];
    files_denied: string[];
    domains_owned: string[];
    domains_read_only: string[];
  };
  tools: { allowed: string[]; denied: string[] };
  permissions: {
    memory_access: "none" | "read" | "write";
    policy_access: "none" | "read";
    release_permissions: "none" | "propose" | "sign";
    escalation_permissions: "tier_1" | "tier_2" | "tier_3";
    write_permissions: string;
  };
  budgets: {
    max_runtime_seconds: number;
    max_tokens_per_run: number;
    max_cost_usd_per_run: number;
    max_retries: number;
  };
  validation: {
    validated_by: string[];
    validates: string[];
    self_approval: boolean;
  };
  outputs: {
    report_path: string;
    schema: string;
    evidence_required_for: Severity[];
  };
  quarantine: {
    anomaly_threshold: number;
    auto_quarantine_signals: string[];
  };
  telemetry: {
    spans_required: boolean;
    metrics_emitted: string[];
  };
}

export type PolicyDecision =
  | "allow"
  | "deny"
  | "require_human_approval"
  | "quarantine"
  | "retry_with_backoff"
  | "escalate";

export interface PolicyRule {
  id: string;
  action: string;
  scope?: string;
  decision: PolicyDecision;
  appender_only?: boolean;
  exception?: string[];
}

export interface FleetPolicy {
  version: string;
  rules: PolicyRule[];
}

export interface ReleaseGate {
  id: string;
  rule: string;
  blocking: boolean;
  warning?: boolean;
}

export interface ReleasePolicy {
  version: string;
  gates: ReleaseGate[];
}

export interface RunIntake {
  run_id: string;
  scope: AgentId[];
  blocking: boolean;
  triggered_by: string;
  trigger_kind: "manual" | "cron" | "ci";
  created_at: string;
  notes?: string;
}

export interface AgentRunResult {
  agent: AgentId;
  status: AgentStatus;
  report_path: string | null;
  severity_max: Severity;
  score: number;
  findings_count: number;
  findings_by_severity: Record<Severity, number>;
  duration_ms: number;
  retries: number;
  quarantined: boolean;
  anomaly_score: number;
  error?: string;
}

export interface RunDecisionFile {
  run_id: string;
  started_at: string;
  ended_at: string;
  intake: RunIntake;
  agents: AgentRunResult[];
  severity_stack: Record<Severity, number>;
  trust_before: TrustScores;
  trust_after: TrustScores;
  drift_findings: number;
  decision: RunDecision;
  blockers: string[];
  signed_by: string;
  hash: string;
}

export interface TrustScores {
  architecture: number;
  design: number;
  qa: number;
  runtime: number;
  release: number;
  orchestration: number;
  product_experience: number;
}

export interface TrustHistoryEntry {
  ts: string;
  run_id: string;
  scores: TrustScores;
  delta: Partial<TrustScores>;
}

export interface DriftFinding {
  id: string;
  ts: string;
  run_id: string;
  type:
    | "hardcoded_color"
    | "hardcoded_spacing"
    | "inline_style"
    | "forbidden_token"
    | "orphan_component"
    | "ds_violation";
  file: string;
  line: number | null;
  snippet: string;
  severity: Severity;
  agent: AgentId;
}

export interface QuarantineEntry {
  agent_id: AgentId;
  state: "healthy" | "suspect" | "quarantined" | "retired";
  anomaly_score: number;
  triggered_at: string | null;
  triggered_run: string | null;
  reason: string | null;
  history: Array<{
    ts: string;
    run_id: string;
    anomaly_score: number;
    signal: string;
  }>;
}

export interface CommandCenterState {
  ts: string;
  run_id: string | null;
  master_heartbeat: string;
  phase: RunPhase;
  agents: Array<{
    id: AgentId;
    status: AgentStatus;
    last_run: string | null;
    current_task: string | null;
    heartbeat: string;
  }>;
  queue: Array<{ run_id: string; created_at: string; status: string }>;
  retries: Array<{ run_id: string; agent: AgentId; attempt: number }>;
  escalations: Array<{
    id: string;
    tier: 1 | 2 | 3;
    reason: string;
    created_at: string;
  }>;
  severity_stack: Record<Severity, number>;
  trust_delta: Partial<TrustScores>;
  token_burn: { current_run: number; today: number };
  blockers: string[];
  degraded_mode: boolean;
}

export interface ReplaySnapshot {
  run_id: string;
  taken_at: string;
  git: {
    branch: string;
    commit: string;
    dirty: boolean;
  };
  policies_hash: string;
  contracts_hash: string;
  prompts_hash: string;
  node_version: string;
  package_lock_hash: string;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const ALL_AGENTS: AgentId[] = ["architecture", "design-system", "qa"];
