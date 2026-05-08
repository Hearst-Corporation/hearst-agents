/**
 * Scheduler Singleton Init — ensures startScheduler() runs exactly once.
 *
 * Primary call site: instrumentation.ts (runs at server boot, no traffic needed).
 * Secondary call site: /api/orchestrate/route.ts (module scope, fallback guard).
 *
 * Duplicate-safe: globalThis guard survives hot-reload in dev,
 * and startScheduler() itself has an internal intervalId guard.
 *
 * Leadership: acquires a DB-backed lease on boot and renews it every 30s.
 * Non-leader instances still run the scheduler loop but skip tick bodies.
 * If DB is unavailable (dev), assumes leader automatically.
 */

import { startScheduler, stopScheduler, type SchedulerTriggerFn, type IsLeaderFn } from "./scheduler";
import type { ScheduledMission } from "./types";
import type { SchedulerMode } from "./ops-types";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { orchestrate } from "@/lib/engine/orchestrator/index";
import {
  tryAcquireSchedulerLeadership,
  renewSchedulerLeadership,
} from "./leader-lease";
import { cleanupExpiredSchedulerLeases } from "./cleanup-leases";
import { INSTANCE_ID } from "../instance-id";

const GLOBAL_KEY = "__hearst_scheduler_started__";
const HEARTBEAT_INTERVAL_MS = 30_000;
const CLEANUP_EVERY_N_HEARTBEATS = 10; // ~5 min

function isStarted(): boolean {
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] === true;
}

function markStarted(): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = true;
}

// ── Leadership state ─────────────────────────────────────

let _isLeader = false;
let _dbAvailable = true;
let _heartbeatCount = 0;

/**
 * Current scheduler mode — readable by status API.
 */
export function getSchedulerMode(): SchedulerMode {
  if (!_dbAvailable) return "local_fallback";
  return _isLeader ? "leader" : "standby";
}

async function acquireLeadership(): Promise<void> {
  const acquired = await tryAcquireSchedulerLeadership();
  if (acquired && !_isLeader) {
    _isLeader = true;
    console.log(`[Scheduler] Leadership acquired by ${INSTANCE_ID}`);
  } else if (!acquired && _isLeader) {
    _isLeader = false;
    console.log(`[Scheduler] Leadership lost — entering standby`);
  } else if (!acquired) {
    console.log(`[Scheduler] Standby mode (${INSTANCE_ID})`);
  }
}

async function heartbeat(): Promise<void> {
  _heartbeatCount++;

  if (_isLeader) {
    const renewed = await renewSchedulerLeadership();
    if (!renewed) {
      _isLeader = false;
      console.log(`[Scheduler] Leadership lost — entering standby`);
      await acquireLeadership();
    }
  } else {
    await acquireLeadership();
  }

  // Periodic lease cleanup (leader only)
  if (_isLeader && _heartbeatCount % CLEANUP_EVERY_N_HEARTBEATS === 0) {
    try {
      const { deleted } = await cleanupExpiredSchedulerLeases();
      if (deleted > 0) {
        console.log(`[Scheduler] Cleaned ${deleted} expired lease(s)`);
      }
    } catch (e) {
      console.error("[Scheduler] Lease cleanup error:", e);
    }
  }
}

function startHeartbeat(): void {
  setInterval(() => {
    heartbeat().catch((e) =>
      console.error("[Scheduler] Heartbeat error:", e),
    );
  }, HEARTBEAT_INTERVAL_MS);
}

// ── Stream drain helper ──────────────────────────────────

interface DrainResult {
  runId: string | null;
  finalText: string;
}

async function drainStream(stream: ReadableStream): Promise<DrainResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let runId: string | null = null;
  const textParts: string[] = [];
  let textTotal = 0;
  const TEXT_CAP = 16_000;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "run_started" && typeof event.run_id === "string") {
            runId = event.run_id;
          } else if (
            event.type === "text_delta" &&
            typeof event.delta === "string" &&
            textTotal < TEXT_CAP
          ) {
            // Reconstruit le finalText pour la persistance Mission Memory.
            // Cap soft 16k chars cohérent avec /api/v2/missions/[id]/run.
            textParts.push(event.delta);
            textTotal += event.delta.length;
          }
        } catch {
          /* skip lignes non-JSON ou tronquées */
        }
      }
    }
  } catch (err) {
    console.error("[Scheduler] Stream drain error:", err);
  } finally {
    reader.releaseLock();
  }

  return { runId, finalText: textParts.join("").trim() };
}

// ── Trigger builder ──────────────────────────────────────

function buildTrigger(): SchedulerTriggerFn {
  return async (mission: ScheduledMission): Promise<string | null> => {
    const db = requireServerSupabase();

    // Mission Memory — persistance fire-and-forget cohérente avec
    // /api/v2/missions/[id]/run. Sans ces appels, les missions
    // schedulées tournent en amnésie totale (cf. audit E2E 2026-05-08
    // 14.6 : invariant missions.md I-12 violé).
    const { appendMissionMessage, updateMissionContextSummary } = await import(
      "@/lib/memory/mission-context"
    );
    const { fireAndForgetIngestTurn } = await import(
      "@/lib/memory/kg-ingest-pipeline"
    );

    void appendMissionMessage({
      missionId: mission.id,
      userId: mission.userId,
      tenantId: mission.tenantId ?? null,
      role: "user",
      content: mission.input,
    });

    const stream = orchestrate(db, {
      userId: mission.userId,
      message: mission.input,
      missionId: mission.id,
      tenantId: mission.tenantId,
      workspaceId: mission.workspaceId,
      surface: "scheduler",
    });

    const { runId, finalText } = await drainStream(stream);

    if (finalText.length > 0) {
      void appendMissionMessage({
        missionId: mission.id,
        userId: mission.userId,
        tenantId: mission.tenantId ?? null,
        role: "assistant",
        content: finalText,
        runId: runId ?? undefined,
      });

      // Régénère le summary post-run (Haiku, 4 sections cf. missions.md
      // I-13). Fire-and-forget — l'échec ne casse pas le tick.
      if (runId) {
        void updateMissionContextSummary({
          missionId: mission.id,
          userId: mission.userId,
          tenantId: mission.tenantId ?? "",
          missionInput: mission.input,
          previousSummary: null,
          runResult: {
            runId,
            status: "completed",
            finalText,
          },
        }).catch((err) => {
          console.warn(
            `[Scheduler] updateMissionContextSummary failed for ${mission.id}:`,
            err,
          );
        });
      }

      // KG global — alimente le knowledge graph user-wide. Cohérent
      // avec /api/v2/missions/[id]/run.
      if (mission.tenantId) {
        fireAndForgetIngestTurn({
          userId: mission.userId,
          tenantId: mission.tenantId,
          userMessage: mission.input,
          assistantReply: finalText,
        });
      }
    }

    return runId;
  };
}

// ── IsLeader function passed to scheduler ────────────────

function buildIsLeader(): IsLeaderFn {
  return async () => _isLeader;
}

// ── Public entry ─────────────────────────────────────────

export async function ensureSchedulerStarted(): Promise<void> {
  if (isStarted()) return;
  markStarted();

  console.log(`[Scheduler] Initializing… (${INSTANCE_ID})`);

  // Check if DB is available
  try {
    requireServerSupabase();
  } catch {
    _dbAvailable = false;
    _isLeader = true; // local fallback
    console.log(`[Scheduler] No DB — local fallback mode`);
  }

  if (_dbAvailable) {
    await acquireLeadership();
  }

  const trigger = buildTrigger();
  const isLeader = buildIsLeader();
  startScheduler(trigger, isLeader);

  if (_dbAvailable) {
    startHeartbeat();
  }

  // Clean shutdown : à SIGTERM (deploy, rolling restart), on arrête le
  // setInterval pour ne pas laisser le timer pendre après l'arrêt du
  // process. Sans ça → memory leak si le process est gardé en vie par
  // un autre handler (rare en Next, mais arrive en custom server).
  if (typeof process !== "undefined" && !(process as unknown as { _hearstSigtermRegistered?: boolean })._hearstSigtermRegistered) {
    (process as unknown as { _hearstSigtermRegistered?: boolean })._hearstSigtermRegistered = true;
    process.once("SIGTERM", () => {
      console.log("[Scheduler] SIGTERM received — stopping scheduler");
      stopScheduler();
    });
    process.once("SIGINT", () => {
      console.log("[Scheduler] SIGINT received — stopping scheduler");
      stopScheduler();
    });
  }
}
