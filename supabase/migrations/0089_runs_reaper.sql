-- Migration 0089 — Reaper index pour runs zombies (P0-2)
--
-- lib/jobs/inngest/run-persistence.ts insère runs.status='running'. Si le
-- process meurt entre startJobRun et endJobRun, la row reste 'running'
-- éternellement → /admin/analytics agrège des coûts faux.
--
-- Index partiel sur (started_at) filtré status='running' : permet au cron
-- /api/cron/reap-stale-runs de scanner uniquement les runs encore actives
-- sans full scan sur la table runs (table 0003_runtime_observability.sql).
--
-- Idempotent (IF NOT EXISTS) — colonnes confirmées : status (run_status),
-- started_at, finished_at, error (cf. 0003 + 0015).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_runs_running_started
  ON public.runs(started_at)
  WHERE status = 'running';

COMMIT;
