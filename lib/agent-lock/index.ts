import fs from "node:fs/promises";
import path from "node:path";

const LOCK_PATH = path.join(process.cwd(), "docs", "AGENT-LOCK.json");

export interface AgentLockState {
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  reason: string | null;
}

const DEFAULT_STATE: AgentLockState = {
  locked: false,
  lockedAt: null,
  lockedBy: null,
  reason: null,
};

export async function getAgentLockState(): Promise<AgentLockState> {
  try {
    const raw = await fs.readFile(LOCK_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AgentLockState>;
    return {
      locked: Boolean(parsed.locked),
      lockedAt: parsed.lockedAt ?? null,
      lockedBy: parsed.lockedBy ?? null,
      reason: parsed.reason ?? null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function setAgentLockState(input: {
  locked: boolean;
  lockedBy?: string | null;
  reason?: string | null;
}): Promise<AgentLockState> {
  const next: AgentLockState & { _doc: string } = {
    locked: input.locked,
    lockedAt: input.locked ? new Date().toISOString() : null,
    lockedBy: input.locked ? input.lockedBy ?? null : null,
    reason: input.locked ? input.reason ?? null : null,
    _doc:
      "État du verrou agent. Si locked=true, AUCUN agent ne doit modifier de fichier (Edit, Write, NotebookEdit) ni exécuter d'action destructive (rm, git commit, etc.). Voir docs/AGENT-DRIVEN-DEV.md section 'Verrou agent'.",
  };
  await fs.writeFile(LOCK_PATH, JSON.stringify(next, null, 2) + "\n");
  const { _doc, ...state } = next;
  void _doc;
  return state;
}
