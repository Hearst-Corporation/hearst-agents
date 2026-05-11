/**
 * Agent Lock — state Redis (Upstash ou ioredis).
 *
 * F-106 : L'implémentation FS (fs.readFile / fs.writeFile sur AGENT-LOCK.json)
 * est inopérante sur Vercel (filesystem en lecture seule, et serverless functions
 * démarrent dans des contextes distincts → la mise à jour ne persiste pas).
 *
 * Cette version utilise Redis (via lib/platform/redis/client.ts, qui sélectionne
 * automatiquement Upstash REST ou ioredis selon les env vars). Le JSON sur disque
 * (`docs/AGENT-LOCK.json`) reste la source de vérité pour les agents CLI/locaux,
 * mais l'état runtime (cockpit admin) passe par Redis.
 *
 * Fallback : si Redis n'est pas configuré, on lit le fichier JSON sur disque
 * (compatible local dev + Railway avec filesystem writeable).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRedis } from "@/lib/platform/redis/client";

const LOCK_KEY = "agent-lock:state";
const LOCK_PATH = path.join(process.cwd(), "docs", "AGENT-LOCK.json");

export interface AgentLockState {
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  reason: string | null;
  /** Version optionnelle pour concurrence optimiste. */
  version?: number;
}

const DEFAULT_STATE: AgentLockState = {
  locked: false,
  lockedAt: null,
  lockedBy: null,
  reason: null,
  version: 0,
};

// ── FS fallback helpers ────────────────────────────────────────

async function readFromFs(): Promise<AgentLockState> {
  try {
    const raw = await fs.readFile(LOCK_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AgentLockState>;
    return {
      locked: Boolean(parsed.locked),
      lockedAt: parsed.lockedAt ?? null,
      lockedBy: parsed.lockedBy ?? null,
      reason: parsed.reason ?? null,
      version: parsed.version ?? 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeToFs(state: AgentLockState): Promise<void> {
  const payload = {
    ...state,
    _doc:
      "État du verrou agent. Si locked=true, AUCUN agent ne doit modifier de fichier (Edit, Write, NotebookEdit) ni exécuter d'action destructive (rm, git commit, etc.). Voir docs/AGENT-DRIVEN-DEV.md section 'Verrou agent'.",
  };
  await fs.writeFile(LOCK_PATH, JSON.stringify(payload, null, 2) + "\n");
}

// ── Public API ─────────────────────────────────────────────────

export async function getAgentLockState(): Promise<AgentLockState> {
  const redis = getRedis();

  if (redis) {
    try {
      const raw = await redis.get(LOCK_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      return JSON.parse(raw) as AgentLockState;
    } catch (err) {
      console.warn("[agent-lock] Redis get failed, falling back to FS:", err);
    }
  }

  // Fallback : FS (dev local ou Railway filesystem)
  return readFromFs();
}

export async function setAgentLockState(
  input: {
    locked: boolean;
    lockedBy?: string | null;
    reason?: string | null;
  },
  expectedVersion?: number,
): Promise<AgentLockState> {
  const current = await getAgentLockState();

  // Optimistic concurrency : si expectedVersion est fourni, vérifier
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new Error(
      `[agent-lock] version_conflict: expected ${expectedVersion}, got ${current.version ?? 0}`,
    );
  }

  const next: AgentLockState = {
    locked: input.locked,
    lockedAt: input.locked ? new Date().toISOString() : null,
    lockedBy: input.locked ? (input.lockedBy ?? null) : null,
    reason: input.locked ? (input.reason ?? null) : null,
    version: (current.version ?? 0) + 1,
  };

  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(LOCK_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("[agent-lock] Redis set failed, falling back to FS:", err);
      await writeToFs(next);
      return next;
    }
  }

  // Toujours écrire sur FS aussi pour cohérence Git/local
  try {
    await writeToFs(next);
  } catch (err) {
    // FS readonly sur Vercel — pas critique si Redis a réussi
    if (!redis) {
      throw err;
    }
    console.warn("[agent-lock] FS write failed (expected on Vercel readonly FS):", err);
  }

  return next;
}
