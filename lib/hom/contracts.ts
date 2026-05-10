/**
 * Charge et valide les capability contracts des agents.
 * Source de vérité : hom/agents/<id>/contracts.json
 */
import { HOM } from "./paths";
import { readJson } from "./fs-utils";
import { ALL_AGENTS } from "./types";
import type { AgentContract, AgentId } from "./types";

const cache = new Map<AgentId, AgentContract>();

export async function loadContract(id: AgentId): Promise<AgentContract> {
  const cached = cache.get(id);
  if (cached) return cached;
  const data = await readJson<AgentContract>(HOM.agentContract(id));
  if (!data) {
    throw new Error(`Contract missing for agent ${id} at ${HOM.agentContract(id)}`);
  }
  if (data.agent_id !== id) {
    throw new Error(`Contract id mismatch: file=${data.agent_id}, expected=${id}`);
  }
  cache.set(id, data);
  return data;
}

export async function loadAllContracts(): Promise<AgentContract[]> {
  const out: AgentContract[] = [];
  for (const id of ALL_AGENTS) {
    out.push(await loadContract(id));
  }
  return out;
}


