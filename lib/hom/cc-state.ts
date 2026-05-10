/**
 * Command Center state writer/reader.
 * État live overwrite, lu par l'admin via API.
 * Le state n'est jamais append-only : c'est un instantané.
 * L'historique vit dans /orchestrator/runs/<id>/.
 */
import { HOM } from "./paths";
import { readJson, writeJson, nowIso } from "./fs-utils";
import { loadQuarantine } from "./quarantine";
import { ALL_AGENTS } from "./types";
import type {
  AgentId,
  AgentStatus,
  CommandCenterState,
  RunPhase,
  Severity,
  TrustScores,
} from "./types";

const EMPTY_SEVERITY: Record<Severity, number> = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
};

export async function loadCC(): Promise<CommandCenterState> {
  const data = await readJson<CommandCenterState>(HOM.ccState);
  if (data) return data;
  return defaultCC();
}

function defaultCC(): CommandCenterState {
  return {
    ts: nowIso(),
    run_id: null,
    master_heartbeat: nowIso(),
    phase: "idle",
    agents: ALL_AGENTS.map((id) => ({
      id,
      status: "stale" as AgentStatus,
      last_run: null,
      current_task: null,
      heartbeat: nowIso(),
    })),
    queue: [],
    retries: [],
    escalations: [],
    severity_stack: { ...EMPTY_SEVERITY },
    trust_delta: {},
    token_burn: { current_run: 0, today: 0 },
    blockers: [],
    degraded_mode: false,
  };
}

export async function patchCC(
  patch: Partial<CommandCenterState>,
): Promise<CommandCenterState> {
  const current = await loadCC();
  const next = { ...current, ...patch, ts: nowIso(), master_heartbeat: nowIso() };
  await writeJson(HOM.ccState, next);
  return next;
}

export async function setPhase(runId: string, phase: RunPhase): Promise<void> {
  await patchCC({ run_id: runId, phase });
}

export async function setAgentStatus(
  agentId: AgentId,
  status: AgentStatus,
  task: string | null,
): Promise<void> {
  const current = await loadCC();
  const agents = current.agents.map((a) =>
    a.id === agentId
      ? { ...a, status, current_task: task, heartbeat: nowIso() }
      : a,
  );
  await writeJson(HOM.ccState, { ...current, agents, ts: nowIso() });
}

export async function refreshFromQuarantine(): Promise<void> {
  const q = await loadQuarantine();
  const current = await loadCC();
  const agents = current.agents.map((a) => {
    const qe = q.agents[a.id];
    if (qe?.state === "quarantined") {
      return { ...a, status: "quarantined" as AgentStatus };
    }
    return a;
  });
  await writeJson(HOM.ccState, { ...current, agents, ts: nowIso() });
}

export async function recordRunEnd(
  runId: string,
  trustDelta: Partial<TrustScores>,
  severityStack: Record<Severity, number>,
  blockers: string[],
): Promise<void> {
  const current = await loadCC();
  await writeJson(HOM.ccState, {
    ...current,
    run_id: runId,
    phase: "idle",
    severity_stack: severityStack,
    trust_delta: trustDelta,
    blockers,
    ts: nowIso(),
    master_heartbeat: nowIso(),
  });
}
