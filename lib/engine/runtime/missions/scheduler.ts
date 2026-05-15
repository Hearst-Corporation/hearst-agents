/**
 * Scheduled Mission Scheduler — minimal polling loop.
 *
 * Checks every 60s if any enabled mission should run based on its schedule.
 * Uses a simple cron subset: "minute hour * * *" (minute + hour + day-of-week).
 *
 * Guard layers (in order):
 *   1. Leader lease — only the leader instance executes the tick body
 *   2. Minute dedup — prevents re-trigger within the same UTC minute
 *   3. In-memory lease — prevents same-process overlap for long runs
 *   4. Distributed lease — prevents cross-instance overlap for the same window
 *
 * On each tick, hydrates from Supabase if in-memory store is empty.
 */

import { analyzeMissionDrift, generateDriftNarration } from "@/lib/cockpit/drift-detection";
import { hasActiveApprovalSession, requestApprovals } from "@/lib/missions/approvals";
import { registerHMRCleanup } from "@/lib/runtime/hmr-cleanup";
import { INSTANCE_ID } from "../instance-id";
import {
  getScheduledMissions,
  updateScheduledMission as persistUpdateMission,
} from "../state/adapter";
import { getMonthlyMissionCost } from "./budget";
import { releaseMissionLease, tryAcquireMissionLease } from "./distributed-lease";
import { buildExportJobPayload, runExportScheduledReportJob } from "./export-job";
import { isMissionRunning, markMissionCompleted, markMissionRunning } from "./lease";
import { normalizeMissionResult } from "./normalize-result";
import {
  clearMissionDrift,
  getMissionDrift,
  setMissionResult as opsResult,
  setMissionRunning as opsRunning,
  setMissionDrift,
} from "./ops-store";
import { addMission, getAllMissions, getEnabledMissions, updateMissionLastRun } from "./store";
import type { ScheduledMission } from "./types";

const POLL_INTERVAL_MS = 60_000;
const triggeredThisMinute = new Set<string>();
let currentMinuteKey = "";
let intervalId: ReturnType<typeof setInterval> | null = null;
let hydrated = false;

// ── Minimal cron parser (minute + hour + day-of-week) ─────

interface ParsedSchedule {
  minute: number | null;
  hour: number | null;
  dow: number | null;
}

function parseSchedule(schedule: string): ParsedSchedule {
  const parts = schedule.trim().split(/\s+/);
  return {
    minute: parts[0] === "*" ? null : parseInt(parts[0], 10),
    hour: parts[1] === "*" ? null : parseInt(parts[1], 10),
    dow: parts.length >= 5 && parts[4] !== "*" ? parseInt(parts[4], 10) : null,
  };
}

function shouldRunNow(mission: ScheduledMission): boolean {
  const now = new Date();
  const parsed = parseSchedule(mission.schedule);

  if (parsed.minute !== null && now.getUTCMinutes() !== parsed.minute) return false;
  if (parsed.hour !== null && now.getUTCHours() !== parsed.hour) return false;
  if (parsed.dow !== null && now.getUTCDay() !== parsed.dow) return false;

  return true;
}

/** UTC minute bucket key for distributed dedup. */
function runWindowKey(missionId: string): string {
  const now = new Date();
  const d = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `${missionId}:${d}`;
}

// ── Trigger function (injected) ──────────────────────────

export type SchedulerTriggerFn = (mission: ScheduledMission) => Promise<string | null>;

// ── Leadership check (injected by scheduler-init) ────────

export type IsLeaderFn = () => Promise<boolean>;

// ── Hydration from Supabase ──────────────────────────────

async function hydrateIfNeeded(): Promise<void> {
  if (hydrated) return;

  const inMemory = getAllMissions();
  if (inMemory.length > 0) {
    hydrated = true;
    return;
  }

  try {
    const persisted = await getScheduledMissions();
    for (const m of persisted) {
      addMission({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        userId: m.userId,
        name: m.name,
        input: m.input,
        schedule: m.schedule,
        enabled: m.enabled,
        createdAt: m.createdAt,
        lastRunAt: m.lastRunAt,
        lastRunId: m.lastRunId,
        budgetUsd: m.budgetUsd,
        approvers: m.approvers,
        approvalMode: m.approvalMode,
      });
    }
    hydrated = true;
    if (persisted.length > 0) {
      console.log(`[Scheduler] Hydrated ${persisted.length} mission(s) from Supabase`);
    }
  } catch (err) {
    console.error("[Scheduler] Hydration failed:", err);
  }
}

// ── Scheduler loop ───────────────────────────────────────

async function tick(trigger: SchedulerTriggerFn, isLeader: IsLeaderFn): Promise<void> {
  // Layer 1: leadership gate
  const leader = await isLeader();
  if (!leader) return; // standby instance — skip silently

  await hydrateIfNeeded();

  const now = new Date();
  const minuteKey = `${now.getUTCHours()}:${now.getUTCMinutes()}`;

  if (minuteKey !== currentMinuteKey) {
    currentMinuteKey = minuteKey;
    triggeredThisMinute.clear();
  }

  const missions = getEnabledMissions();

  for (const mission of missions) {
    // Layer 2: same-minute dedup
    if (triggeredThisMinute.has(mission.id)) continue;
    if (!shouldRunNow(mission)) continue;

    triggeredThisMinute.add(mission.id);

    if (!mission.tenantId || !mission.workspaceId) {
      console.warn(`[Scheduler] Mission skipped — missing tenant scope (${mission.id})`);
      continue;
    }

    // Layer 2.5 (S3-D): hard-stop budget mensuel
    if (mission.budgetUsd && mission.budgetUsd > 0) {
      try {
        const monthlyCost = await getMonthlyMissionCost(mission.id);
        if (monthlyCost >= mission.budgetUsd) {
          console.warn(
            `[Scheduler] Mission "${mission.name}" skipped — monthly budget exceeded ($${monthlyCost.toFixed(2)} / $${mission.budgetUsd.toFixed(2)})`,
          );
          opsResult(mission.id, {
            status: "blocked",
            error: `Plafond mensuel atteint ($${monthlyCost.toFixed(2)} / $${mission.budgetUsd.toFixed(2)})`,
          });
          void persistUpdateMission(mission.id, {
            lastRunAt: Date.now(),
            lastRunStatus: "blocked",
            lastError: `Plafond mensuel atteint ($${monthlyCost.toFixed(2)} / $${mission.budgetUsd.toFixed(2)})`,
          });
          continue;
        }
      } catch (err) {
        // Lecture budget en erreur — fail-open : on laisse passer pour ne pas
        // bloquer l'agent si Supabase est down. L'enforcement sera retenté
        // au prochain tick.
        console.warn(`[Scheduler] Mission "${mission.name}" budget check failed (fail-open):`, err);
      }
    }

    // Layer 2.7 (Q3-D) : approbation collaborative
    // Si la mission a des approvers, on gate l'exécution :
    //  - Session active ?  → skip ce tick (les votes arrivent en async)
    //  - Pas de session ?  → en créer une et attendre les votes
    // L'exécution réelle se fera depuis l'endpoint /vote quand la session
    // bascule en "approved" (cf. lib/missions/approvals.ts → recordVote).
    if (mission.approvers && mission.approvers.length > 0) {
      try {
        const active = await hasActiveApprovalSession(mission.id);
        if (active) {
          console.log(
            `[Scheduler] Mission "${mission.name}" — session approbation en cours, skip tick`,
          );
          continue;
        }
        console.log(
          `[Scheduler] Mission "${mission.name}" — création session approbation (${mission.approvers.length} approvers, mode=${mission.approvalMode ?? "all"})`,
        );
        const result = await requestApprovals({
          missionId: mission.id,
          missionName: mission.name,
          missionInput: mission.input,
          tenantId: mission.tenantId,
          approvers: mission.approvers,
          mode: mission.approvalMode ?? "all",
        });
        opsResult(mission.id, {
          status: "blocked",
          error: result.ok
            ? `En attente d'approbation (${mission.approvers.length} approbateurs)`
            : `Échec création session approbation : ${result.error ?? "unknown"}`,
        });
        void persistUpdateMission(mission.id, {
          lastRunAt: Date.now(),
          lastRunStatus: "awaiting_approval",
          lastError: result.ok ? undefined : `approval_session_failed: ${result.error}`,
        });
        continue;
      } catch (err) {
        console.warn(
          `[Scheduler] Mission "${mission.name}" approval gate failed (fail-open):`,
          err,
        );
        // Fail-open : on continue le run normalement plutôt que de tout
        // bloquer si la table mission_approvals est indispo.
      }
    }

    // Layer 3: in-memory overlap guard
    if (isMissionRunning(mission.id)) {
      console.log(`[Scheduler] Mission "${mission.name}" skipped — already running (local)`);
      continue;
    }

    // Layer 4: distributed lease
    const windowKey = runWindowKey(mission.id);
    const acquired = await tryAcquireMissionLease({
      missionId: mission.id,
      runWindowKey: windowKey,
    });
    if (!acquired) {
      console.log(`[Scheduler] Mission "${mission.name}" skipped — lease held by another instance`);
      continue;
    }

    console.log(`[Scheduler] Triggering "${mission.name}" (${mission.id}) [${INSTANCE_ID}]`);
    markMissionRunning(mission.id);
    opsRunning(mission.id);

    try {
      const runId = await trigger(mission);
      const result = normalizeMissionResult({ runId, error: undefined });

      if (runId) {
        updateMissionLastRun(mission.id, runId);
      }

      opsResult(mission.id, {
        status: result.status,
        runId: runId ?? undefined,
        error: result.message,
      });

      // Persist ops durably
      void persistUpdateMission(mission.id, {
        lastRunAt: Date.now(),
        lastRunId: runId ?? undefined,
        lastRunStatus: result.status,
        lastError: result.message ?? undefined,
      });

      if (result.status === "success") {
        console.log(`[Scheduler] Mission "${mission.name}" completed → run ${runId}`);
        // ── Drift Alert (S3-E) ─────────────────────────────────
        // Fire-and-forget : la détection de drift et la notification ne
        // doivent jamais bloquer le tick suivant ni faire échouer le run.
        runDriftHook(mission).catch((err) => {
          console.warn(`[Scheduler] Drift hook failed for mission "${mission.name}":`, err);
        });
        // ── Webhook mission.completed (fire-and-forget) ───────
        try {
          const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
          dispatchWebhookEvent("mission.completed", mission.tenantId, {
            missionId: mission.id,
            missionName: mission.name,
            runId: runId ?? null,
          });
        } catch {
          // Webhook system unavailable — ignoré
        }
        // ── Export automatique si configuré ───────────────────
        if (mission.autoExport?.enabled) {
          const jobPayload = buildExportJobPayload(
            mission.id,
            mission.tenantId,
            mission.autoExport,
          );
          // Fire-and-forget : l'échec de l'export ne doit pas impacter le run.
          runExportScheduledReportJob(jobPayload).catch((err) => {
            console.error(`[Scheduler] export-job failed for mission "${mission.name}":`, err);
          });
        }
      } else {
        console.warn(
          `[Scheduler] Mission "${mission.name}" finished with status: ${result.status}`,
        );
      }
    } catch (err) {
      const result = normalizeMissionResult({ error: err });
      opsResult(mission.id, { status: result.status, error: result.message });

      // Persist failure durably
      void persistUpdateMission(mission.id, {
        lastRunAt: Date.now(),
        lastRunStatus: result.status,
        lastError: result.message,
      });

      // ── Webhook mission.failed (fire-and-forget) ───────────
      try {
        const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
        dispatchWebhookEvent("mission.failed", mission.tenantId, {
          missionId: mission.id,
          missionName: mission.name,
          error: result.message ?? "unknown error",
        });
      } catch {
        // Webhook system unavailable — ignoré
      }

      console.error(`[Scheduler] Mission "${mission.name}" ${result.status}: ${result.message}`);
    } finally {
      markMissionCompleted(mission.id);
      void releaseMissionLease({ missionId: mission.id, runWindowKey: windowKey });
    }
  }
}

/**
 * Start the scheduler polling loop.
 * Returns a cleanup function to stop it.
 */
export function startScheduler(trigger: SchedulerTriggerFn, isLeader: IsLeaderFn): () => void {
  if (intervalId) {
    console.warn("[Scheduler] Already running — skipping duplicate start");
    return () => stopScheduler();
  }

  console.log(`[Scheduler] Started (polling every 60s) [${INSTANCE_ID}]`);

  tick(trigger, isLeader).catch((e) => console.error("[Scheduler] Initial tick error:", e));

  intervalId = setInterval(() => {
    tick(trigger, isLeader).catch((e) => console.error("[Scheduler] Tick error:", e));
  }, POLL_INTERVAL_MS);

  // Register HMR cleanup
  registerHMRCleanup(() => {
    console.log("[Scheduler] HMR cleanup — stopping scheduler");
    stopScheduler();
  });

  return () => stopScheduler();
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Scheduler] Stopped");
  }
}

// ── Drift Alert (S3-E) ─────────────────────────────────────

/**
 * Re-notifie au plus 1× toutes les `DRIFT_RENOTIFY_COOLDOWN_MS`. Tant que le
 * drift persiste, on conserve le badge UI mais on ne pousse pas de nouvelle
 * notification ; la séquence est "rearmée" dès qu'un run franc reset le
 * compteur.
 */
const DRIFT_RENOTIFY_COOLDOWN_MS = 24 * 60 * 60_000;

async function runDriftHook(mission: ScheduledMission): Promise<void> {
  const analysis = await analyzeMissionDrift(mission.id);

  // Pas de drift détecté → on s'assure que l'état UI est nettoyé.
  if (analysis.consecutiveStaleRuns < 3) {
    clearMissionDrift(mission.id);
    return;
  }

  const previous = getMissionDrift(mission.id);
  const now = Date.now();
  const inCooldown = previous && now - previous.notifiedAt < DRIFT_RENOTIFY_COOLDOWN_MS;
  // Si on était déjà en drift sur la même longueur de séquence, on évite de
  // repousser la même narration : c'est le même alert state.
  const sameSequence = previous && previous.staleRuns === analysis.consecutiveStaleRuns;

  // Génère la narration (cache 1h en interne).
  const suggestion = await generateDriftNarration(mission.name, analysis.consecutiveStaleRuns);

  // Met à jour l'état ops (badge UI), avec timestamp préservé si on
  // ne renotifie pas, sinon avec le nouveau now.
  const shouldNotify = !inCooldown || !sameSequence;
  setMissionDrift(mission.id, {
    staleRuns: analysis.consecutiveStaleRuns,
    suggestion,
    lastChangeAt: analysis.lastChangeAt,
    notifiedAt: shouldNotify ? now : (previous?.notifiedAt ?? now),
  });

  if (!shouldNotify) return;

  // Push notification in-app (fire-and-forget). On réutilise le canal "signal"
  // existant pour ne pas avoir à migrer le schéma `in_app_notifications` ;
  // `meta.signal_type = "mission_drift"` permet aux clients de filtrer.
  try {
    const [{ requireServerSupabase }, { createNotification }] = await Promise.all([
      import("@/lib/platform/db/supabase"),
      import("@/lib/notifications/in-app"),
    ]);
    const sb = requireServerSupabase();
    void createNotification(sb, {
      tenantId: mission.tenantId,
      userId: mission.userId,
      kind: "signal",
      severity: "info",
      title: "Drift détecté",
      body: suggestion,
      meta: {
        signal_type: "mission_drift",
        mission_id: mission.id,
        mission_name: mission.name,
        stale_runs: analysis.consecutiveStaleRuns,
        last_change_at: analysis.lastChangeAt,
      },
    });
  } catch (err) {
    console.warn(`[Scheduler] Drift notification failed for ${mission.id}:`, err);
  }
}
