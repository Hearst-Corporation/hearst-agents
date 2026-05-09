/**
 * Charge et valide les capability contracts des agents.
 * Source de vérité : hom/agents/<id>/contracts.json
 */
import "server-only";
import { HOM } from "./paths";
import { readJson, fileExists } from "./fs-utils";
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

export function clearContractCache() {
  cache.clear();
}

/** Valide qu'un fichier respecte le scope d'un agent. */
export function isFileInScope(contract: AgentContract, relPath: string): boolean {
  if (contract.scope.files_denied.some((p) => matchGlob(p, relPath))) return false;
  return contract.scope.files_allowed.some((p) => matchGlob(p, relPath));
}

function matchGlob(pattern: string, file: string): boolean {
  if (pattern === file) return true;
  if (pattern.includes("**")) {
    const re = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*") +
        "$",
    );
    return re.test(file);
  }
  if (pattern.includes("*")) {
    const re = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, "[^/]*") +
        "$",
    );
    return re.test(file);
  }
  return false;
}

export async function contractsExist(): Promise<boolean> {
  for (const id of ALL_AGENTS) {
    if (!(await fileExists(HOM.agentContract(id)))) return false;
  }
  return true;
}
