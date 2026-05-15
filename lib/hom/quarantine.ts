/**
 * Quarantine engine HOM minimal.
 * Score d'anomalie 0..1 calculé à la fin de chaque run, transition d'état
 * healthy → suspect → quarantined selon seuils. Pas de recovery auto :
 * un agent quarantiné requiert action humaine via UI.
 */

import { nowIso, readJson, writeJson } from "./fs-utils";
import { HOM } from "./paths";
import type { AgentId, AgentRunResult, QuarantineEntry } from "./types";
import { ALL_AGENTS } from "./types";

interface QuarantineState {
  agents: Record<AgentId, QuarantineEntry>;
}

const DEFAULT_THRESHOLD_SUSPECT = 0.6;
const DEFAULT_THRESHOLD_QUARANTINE = 0.85;

export async function loadQuarantine(): Promise<QuarantineState> {
  const data = await readJson<QuarantineState>(HOM.quarantineState);
  if (data) return data;
  const empty: QuarantineState = { agents: {} as QuarantineState["agents"] };
  for (const id of ALL_AGENTS) {
    empty.agents[id] = {
      agent_id: id,
      state: "healthy",
      anomaly_score: 0,
      triggered_at: null,
      triggered_run: null,
      reason: null,
      history: [],
    };
  }
  await writeJson(HOM.quarantineState, empty);
  return empty;
}

export async function recordAnomaly(
  agent: AgentId,
  runId: string,
  result: AgentRunResult,
): Promise<QuarantineEntry> {
  const state = await loadQuarantine();
  const entry = state.agents[agent];
  const score = computeAnomaly(result);
  const signal = anomalySignal(result, score);

  entry.anomaly_score = score;
  entry.history.push({
    ts: nowIso(),
    run_id: runId,
    anomaly_score: score,
    signal,
  });
  // Trim history à 50.
  entry.history = entry.history.slice(-50);

  if (score >= DEFAULT_THRESHOLD_QUARANTINE) {
    entry.state = "quarantined";
    entry.triggered_at = nowIso();
    entry.triggered_run = runId;
    entry.reason = signal;
  } else if (score >= DEFAULT_THRESHOLD_SUSPECT) {
    if (entry.state === "healthy") entry.state = "suspect";
  } else if (entry.state === "suspect" && score < 0.3) {
    entry.state = "healthy";
    entry.triggered_at = null;
    entry.triggered_run = null;
    entry.reason = null;
  }

  await writeJson(HOM.quarantineState, state);
  return entry;
}

function computeAnomaly(r: AgentRunResult): number {
  let score = 0;
  if (r.status === "red") score += 0.3;
  if (r.error) score += 0.4;
  if (r.duration_ms > 600_000) score += 0.2;
  if (r.findings_count > 200) score += 0.15;
  if (r.retries > 1) score += 0.1;
  return Math.min(1, score);
}

function anomalySignal(r: AgentRunResult, score: number): string {
  if (r.error) return `error:${r.error.slice(0, 80)}`;
  if (r.duration_ms > 600_000) return "runaway:duration";
  if (r.findings_count > 200) return "explosion:findings";
  if (score >= DEFAULT_THRESHOLD_QUARANTINE) return "anomaly:high";
  if (score >= DEFAULT_THRESHOLD_SUSPECT) return "anomaly:suspect";
  return "ok";
}

export async function isAgentAvailable(agent: AgentId): Promise<boolean> {
  const state = await loadQuarantine();
  return state.agents[agent].state !== "quarantined";
}

export async function listQuarantined(): Promise<QuarantineEntry[]> {
  const state = await loadQuarantine();
  return Object.values(state.agents).filter(
    (e) => e.state === "quarantined" || e.state === "suspect",
  );
}

export async function restoreAgent(agent: AgentId, reason: string): Promise<void> {
  const state = await loadQuarantine();
  const entry = state.agents[agent];
  entry.state = "healthy";
  entry.triggered_at = null;
  entry.triggered_run = null;
  entry.reason = null;
  entry.history.push({
    ts: nowIso(),
    run_id: "manual-restore",
    anomaly_score: 0,
    signal: `restore:${reason}`,
  });
  await writeJson(HOM.quarantineState, state);
}
