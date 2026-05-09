/**
 * Trust engine minimal HOM.
 * Calcule 7 scores 0-100 dérivés des findings et des signaux runtime.
 * Stockage append-only dans war-room/trust-history.json.
 */
import { HOM } from "./paths";
import { readJson, writeJson, nowIso } from "./fs-utils";
import type {
  AgentRunResult,
  TrustHistoryEntry,
  TrustScores,
} from "./types";

const DEFAULT_SCORES: TrustScores = {
  architecture: 100,
  design: 100,
  qa: 100,
  runtime: 100,
  release: 100,
  orchestration: 100,
  product_experience: 100,
};

export async function loadHistory(): Promise<TrustHistoryEntry[]> {
  return (await readJson<TrustHistoryEntry[]>(HOM.trustHistory)) ?? [];
}

export async function latestScores(): Promise<TrustScores> {
  const history = await loadHistory();
  return history.at(-1)?.scores ?? { ...DEFAULT_SCORES };
}

export interface TrustComputeInput {
  runId: string;
  agentResults: AgentRunResult[];
  driftFindings: number;
  retries: number;
  quarantinedAgents: number;
}

export async function computeTrust(
  input: TrustComputeInput,
): Promise<{ before: TrustScores; after: TrustScores }> {
  const before = await latestScores();
  const after: TrustScores = { ...DEFAULT_SCORES };

  // Trust score = directement le score réel rendu par l'agent
  const archResult = input.agentResults.find((r) => r.agent === "architecture");
  const dsResult = input.agentResults.find((r) => r.agent === "design-system");
  const qaResult = input.agentResults.find((r) => r.agent === "qa");

  after.architecture = archResult?.score ?? 100;
  after.design = dsResult?.score ?? 100;
  after.qa = qaResult?.score ?? 100;

  // Runtime = QA si QA a tourné (pass rate proxy), sinon stable
  after.runtime = Math.max(0, after.qa - 5);

  // Release = min des trois agents primaires
  after.release = Math.min(after.architecture, after.design, after.qa);

  // Orchestration = pénalisé par retries + quarantines
  after.orchestration = Math.max(
    0,
    100 - input.retries * 4 - input.quarantinedAgents * 15,
  );

  // Product experience = design + drift
  after.product_experience = Math.max(
    0,
    after.design - input.driftFindings * 2,
  );

  return { before, after };
}

export async function appendHistory(
  runId: string,
  before: TrustScores,
  after: TrustScores,
): Promise<void> {
  const history = await loadHistory();
  const delta: Partial<TrustScores> = {};
  for (const k of Object.keys(after) as (keyof TrustScores)[]) {
    delta[k] = after[k] - before[k];
  }
  history.push({
    ts: nowIso(),
    run_id: runId,
    scores: after,
    delta,
  });
  // Cap à 500 entrées en clair (compaction simple).
  const trimmed = history.slice(-500);
  await writeJson(HOM.trustHistory, trimmed);
}

export function trustGate(scores: TrustScores): {
  passed: boolean;
  failedKeys: string[];
} {
  const minimums: Record<keyof TrustScores, number> = {
    architecture: 75,
    design: 75,
    qa: 85,
    runtime: 80,
    release: 90,
    orchestration: 70,
    product_experience: 75,
  };
  const failedKeys: string[] = [];
  for (const k of Object.keys(scores) as (keyof TrustScores)[]) {
    if (scores[k] < minimums[k]) failedKeys.push(k);
  }
  return { passed: failedKeys.length === 0, failedKeys };
}
