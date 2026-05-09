/**
 * Hearst Operations Mesh — chemins canoniques.
 * Toute la racine HOM vit sous `hom/` à la racine du repo,
 * pour ne pas polluer `app/` ni mélanger avec `docs/`.
 */
import path from "node:path";

export const ROOT = process.cwd();
export const HOM_ROOT = path.join(ROOT, "hom");

export const HOM = {
  root: HOM_ROOT,

  // Orchestrator
  orchestrator: path.join(HOM_ROOT, "orchestrator"),
  orchestratorConfig: path.join(HOM_ROOT, "orchestrator", "config.json"),
  runs: path.join(HOM_ROOT, "orchestrator", "runs"),
  run: (runId: string) => path.join(HOM_ROOT, "orchestrator", "runs", runId),
  runIntake: (runId: string) =>
    path.join(HOM_ROOT, "orchestrator", "runs", runId, "intake.json"),
  runDecision: (runId: string) =>
    path.join(HOM_ROOT, "orchestrator", "runs", runId, "decision.json"),
  runSnapshot: (runId: string) =>
    path.join(HOM_ROOT, "orchestrator", "runs", runId, "snapshot.json"),
  runEvents: (runId: string) =>
    path.join(HOM_ROOT, "orchestrator", "runs", runId, "events.log"),
  runSpans: (runId: string) =>
    path.join(HOM_ROOT, "orchestrator", "runs", runId, "spans.jsonl"),

  // Agents
  agents: path.join(HOM_ROOT, "agents"),
  agentDir: (id: string) => path.join(HOM_ROOT, "agents", id),
  agentContract: (id: string) =>
    path.join(HOM_ROOT, "agents", id, "contracts.json"),
  agentPrompts: (id: string) => path.join(HOM_ROOT, "agents", id, "prompts.md"),

  // Audits (append-only)
  audits: path.join(HOM_ROOT, "audits"),
  auditsAgent: (id: string) => path.join(HOM_ROOT, "audits", id),

  // Policies
  policies: path.join(HOM_ROOT, "policies"),
  fleetPolicy: path.join(HOM_ROOT, "policies", "fleet-policy.json"),
  releasePolicy: path.join(HOM_ROOT, "policies", "release-policy.json"),
  agentPolicy: path.join(HOM_ROOT, "policies", "agent-policy.json"),

  // Telemetry
  telemetry: path.join(HOM_ROOT, "telemetry"),
  traces: path.join(HOM_ROOT, "telemetry", "traces"),
  metrics: path.join(HOM_ROOT, "telemetry", "metrics"),
  logs: path.join(HOM_ROOT, "telemetry", "logs"),

  // Quarantine
  quarantine: path.join(HOM_ROOT, "quarantine"),
  quarantineState: path.join(HOM_ROOT, "quarantine", "state.json"),

  // War Room
  warRoom: path.join(HOM_ROOT, "war-room"),
  warRoomSnapshots: path.join(HOM_ROOT, "war-room", "snapshots"),
  warRoomSnapshot: (runId: string) =>
    path.join(HOM_ROOT, "war-room", "snapshots", runId),
  warRoomIndex: path.join(HOM_ROOT, "war-room", "index.json"),
  trustHistory: path.join(HOM_ROOT, "war-room", "trust-history.json"),
  driftLog: path.join(HOM_ROOT, "war-room", "drift-log.json"),

  // Command Center (live state)
  commandCenter: path.join(HOM_ROOT, "command-center"),
  ccState: path.join(HOM_ROOT, "command-center", "state.json"),

  // Memory
  memory: path.join(HOM_ROOT, "memory"),
  antiPatterns: path.join(HOM_ROOT, "memory", "anti-patterns"),
  knownFailures: path.join(HOM_ROOT, "memory", "known-failures"),

  // Release
  release: path.join(HOM_ROOT, "release"),
  releaseIndex: path.join(HOM_ROOT, "release", "index.json"),

  // Repo paths utiles aux scans
  repoApp: path.join(ROOT, "app"),
  repoLib: path.join(ROOT, "lib"),
  repoComponents: path.join(ROOT, "app", "components"),
  repoTests: path.join(ROOT, "__tests__"),
  repoE2E: path.join(ROOT, "e2e"),
  repoGlobalsCss: path.join(ROOT, "app", "globals.css"),
  repoPackageJson: path.join(ROOT, "package.json"),
  repoPackageLock: path.join(ROOT, "package-lock.json"),
};

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
