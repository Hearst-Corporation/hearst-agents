/**
 * Queue factory — routing BullMQ vs Inngest + idempotency garantie.
 *
 * Sur Vercel (VERCEL=1) : TOUS les jobs passent par Inngest (serverless,
 * workers longue durée impossibles). Sur Railway / self-hosted : les kinds
 * non Inngest passent par BullMQ avec jobId déterministe pour idempotency.
 *
 * Idempotency-Key :
 *  - Inngest : `event.id` = deterministicHash(payload) ou opts.idempotencyKey
 *  - BullMQ  : `job.id`  = même hash
 * → double-enqueue du même payload = 1 seul job exécuté.
 */

import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { JOB_QUEUE_CONFIGS } from "./configs";
import { getBullConnection } from "./connection";
import type { JobKind, JobPayload } from "./types";

// ── Kinds routés vers Inngest ──────────────────────────────────
// Sur Vercel : TOUS (liste complète). Sur Railway : uniquement ceux listés.
// Pour ajouter un kind : créer la fonction Inngest dans
// lib/jobs/inngest/functions/ et la registrer dans functions/index.ts.
// Exporté pour permettre à workers/index.ts de skipper le démarrage du Worker
// BullMQ correspondant (sinon Worker idle qui consomme RAM et brouille la
// frontière BullMQ/Inngest — cf. audit P0-2 "double exécution").
export const INNGEST_JOB_KINDS = new Set<JobKind>([
  "daily-brief",
  "audio-gen",
  "image-gen",
  "code-exec",
  "document-parse",
  "weekly-digest" as JobKind,
  "monthly-card" as JobKind,
  "pre-meeting-intel" as JobKind,
  "swarm-run",
  "computer-action-run",
]);

const queues = new Map<JobKind, Queue>();

function getQueue(kind: JobKind): Queue | null {
  const cached = queues.get(kind);
  if (cached) return cached;

  const connection = getBullConnection();
  if (!connection) return null;

  const config = JOB_QUEUE_CONFIGS[kind];
  if (!config) return null;

  const queue = new Queue(config.queueName, {
    connection,
    defaultJobOptions: {
      attempts: config.retryAttempts + 1,
      backoff: { type: "exponential", delay: config.retryDelayMs },
      removeOnComplete: config.removeOnComplete,
      removeOnFail: config.removeOnFail,
      priority: config.priority,
    },
  });
  queues.set(kind, queue);
  return queue;
}

export interface EnqueueResult {
  jobId: string;
  jobKind: JobKind;
}

/**
 * Hash déterministe du payload pour idempotency-key.
 * Trie les clés pour garantir la stabilité quelle que soit l'ordre d'insertion.
 */
function deterministicHash(payload: object): string {
  const keys = Object.keys(payload).sort();
  return createHash("sha256").update(JSON.stringify(payload, keys)).digest("hex").slice(0, 16);
}

/**
 * Enqueue a job for async processing.
 *
 * - Vercel (VERCEL=1) OU kind Inngest → Inngest (durable, serverless-safe)
 * - Autres → BullMQ avec jobId déterministe (Railway / self-hosted)
 *
 * L'option `idempotencyKey` permet au caller de forcer une clé spécifique
 * (ex : variantId, missionId) pour éviter les double-soumissions UI.
 */
export async function enqueueJob(
  payload: JobPayload,
  opts?: { idempotencyKey?: string },
): Promise<EnqueueResult> {
  const isVercel = process.env.VERCEL === "1";
  const eventId = opts?.idempotencyKey ?? deterministicHash(payload);

  if (isVercel || INNGEST_JOB_KINDS.has(payload.jobKind)) {
    if (!process.env.INNGEST_EVENT_KEY) {
      throw new Error(
        `[Jobs] INNGEST_EVENT_KEY manquant — impossible de router ${payload.jobKind} vers Inngest`,
      );
    }
    const { inngest } = await import("./inngest/client");
    const result = await inngest.send({
      name: `app/${payload.jobKind}.requested`,
      id: eventId,
      data: payload,
    });
    return { jobId: result.ids[0] ?? eventId, jobKind: payload.jobKind };
  }

  // BullMQ path (Railway / self-hosted)
  const queue = getQueue(payload.jobKind);
  if (!queue) {
    throw new Error(
      `[Jobs] Queue ${payload.jobKind} unavailable — REDIS_URL must be configured for async job processing`,
    );
  }

  const job = await queue.add(payload.jobKind, payload, {
    jobId: eventId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  });
  return { jobId: job.id ?? eventId, jobKind: payload.jobKind };
}

/**
 * Get job state for status streaming. Used by SSE endpoint
 * /api/v2/jobs/[id]/progress.
 */
export async function getJobState(
  kind: JobKind,
  jobId: string,
): Promise<{
  state: string;
  progress: number;
  returnvalue: unknown;
  failedReason?: string;
  /** Payload original du job — utilisé pour le ownership check côté routes (F-004) */
  data?: unknown;
} | null> {
  const queue = getQueue(kind);
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const [state, progress] = await Promise.all([job.getState(), Promise.resolve(job.progress)]);

  return {
    state: String(state),
    progress: typeof progress === "number" ? progress : 0,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    data: job.data,
  };
}
