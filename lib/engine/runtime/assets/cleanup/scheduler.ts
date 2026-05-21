/**
 * Asset Cleanup Scheduler — Architecture Finale
 *
 * Schedules periodic cleanup jobs using setInterval.
 * Supports simple cron-like hour/minute scheduling for daily runs.
 * Path: lib/engine/runtime/assets/cleanup/scheduler.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/observability/logger";
import { registerHMRCleanup } from "@/lib/runtime/hmr-cleanup";
import type { StorageProvider } from "../storage/types";
import { type CleanupConfig, type CleanupResult, runAssetCleanup } from "./worker";

export interface SchedulerConfig {
  cronExpression: string; // e.g., "0 2 * * *" (daily at 2am)
  enabled: boolean;
  cleanupConfig?: Partial<CleanupConfig>;
}

export class CleanupScheduler {
  private config: SchedulerConfig;
  private db: SupabaseClient;
  private storage: StorageProvider;
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialTimeout: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private lastRun: Date | null = null;
  private lastResult: CleanupResult | null = null;

  constructor(db: SupabaseClient, storage: StorageProvider, config: SchedulerConfig) {
    this.db = db;
    this.storage = storage;
    this.config = config;
  }

  start(): void {
    if (!this.config.enabled) {
      logger.info("[CleanupScheduler] Disabled");
      return;
    }

    if (this.timer) {
      logger.info("[CleanupScheduler] Already running");
      return;
    }

    const { hour, minute } = parseCronHourMinute(this.config.cronExpression);
    const msUntilFirst = msUntilNextRun(hour, minute);
    const DAILY_MS = 24 * 60 * 60 * 1000;

    logger.info(
      { hour, minute, firstRunInMin: Math.round(msUntilFirst / 60_000) },
      "[CleanupScheduler] Scheduled daily",
    );

    this.initialTimeout = setTimeout(() => {
      void this.tick();
      this.timer = setInterval(() => void this.tick(), DAILY_MS);

      // Register HMR cleanup for recurring timer
      registerHMRCleanup(() => {
        if (this.timer) clearInterval(this.timer);
      });
    }, msUntilFirst);

    // Register HMR cleanup for initial timeout
    registerHMRCleanup(() => {
      if (this.initialTimeout) clearTimeout(this.initialTimeout);
    });
  }

  stop(): void {
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
      this.initialTimeout = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info("[CleanupScheduler] Stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): {
    enabled: boolean;
    running: boolean;
    lastRun: Date | null;
    lastResult: CleanupResult | null;
  } {
    return {
      enabled: this.config.enabled,
      running: this.running,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
    };
  }

  async runNow(): Promise<CleanupResult> {
    return this.tick();
  }

  private async tick(): Promise<CleanupResult> {
    if (this.running) {
      logger.info("[CleanupScheduler] Skipping — previous run still active");
      return this.lastResult ?? emptyResult();
    }

    this.running = true;
    logger.info("[CleanupScheduler] Run starting…");

    try {
      const cleanupConfig: CleanupConfig = {
        defaultTtlDays: 30,
        archiveAfterDays: 90,
        deleteArchivedAfterDays: 0,
        dryRun: false,
        batchSize: 1000,
        ...this.config.cleanupConfig,
      };
      const result = await runAssetCleanup(this.db, this.storage, cleanupConfig);
      this.lastRun = new Date();
      this.lastResult = result;
      logger.info(
        {
          assetsDeleted: result.assetsDeleted,
          filesDeleted: result.filesDeleted,
          errors: result.errors,
          durationMs: result.durationMs,
        },
        "[CleanupScheduler] Run complete",
      );
      return result;
    } catch (err) {
      console.error("[CleanupScheduler] Run failed:", err);
      return emptyResult();
    } finally {
      this.running = false;
    }
  }
}

/**
 * Parse hour and minute from a cron expression (only supports "M H * * *").
 * Falls back to 02:00 if parsing fails.
 */
function parseCronHourMinute(cron: string): { hour: number; minute: number } {
  const parts = cron.trim().split(/\s+/);
  if (parts.length >= 2) {
    const minute = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);
    if (
      !Number.isNaN(minute) &&
      !Number.isNaN(hour) &&
      hour >= 0 &&
      hour < 24 &&
      minute >= 0 &&
      minute < 60
    ) {
      return { hour, minute };
    }
  }
  return { hour: 2, minute: 0 };
}

function msUntilNextRun(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function emptyResult(): CleanupResult {
  return {
    assetsMarked: 0,
    assetsDeleted: 0,
    filesDeleted: 0,
    assetsArchived: 0,
    errors: 0,
    durationMs: 0,
    byTenant: {},
  };
}
