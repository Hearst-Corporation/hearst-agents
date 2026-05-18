/**
 * Worker base pattern — pose le contrat que chaque worker Phase B suit.
 *
 * Un worker concret (audio-gen, image-gen, etc.) :
 *  1. Définit `processJob(payload, ctx)` qui retourne un JobResult
 *  2. Optionnel : `validateInput(payload)` pour reject precoce
 *  3. Optionnel : `onProgress(value)` mappe vers SSE event
 *
 * La base prend en charge :
 *  - Settlement automatique des crédits (settle_credits) au succès/échec
 *  - Tracking métadonnées (provider used, cost actual)
 *  - Heartbeat BullMQ pour empêcher les long-jobs d'être considérés stuck
 *  - Error logging consistant
 */

import { type Job, type Processor, UnrecoverableError, Worker } from "bullmq";
import { settleCredits } from "@/lib/credits/client";
import { JOB_QUEUE_CONFIGS } from "./configs";
import { getBullConnection } from "./connection";
import { isPermanentError } from "./permanent-error";
import type { JobKind, JobPayload, JobResult } from "./types";

/**
 * Kinds dont le handler s'auto-termine via une borne temporelle interne
 * (boucle de poll bornée + cleanup garanti). Pour eux, le Promise.race
 * P1-5 est DÉSACTIVÉ : il introduisait une régression P1-B.
 *
 * Cas concret : meeting-bot a config.maxDurationMs = 7_200_000 (2h pile,
 * cf. lib/jobs/configs.ts) ET une boucle interne
 * `while (Date.now() - startedAt < TIMEOUT_MS)` avec TIMEOUT_MS = 2h,
 * vérifiée tous les POLL_INTERVAL_MS = 30s (cf. workers/meeting-bot.ts).
 * Pour un vrai meeting qui dure ~2h, le setTimeout dur du race fire à
 * 2h PILE pendant que la boucle gracieuse ne sort qu'à ~2h+30s (granularité
 * du poll) → le race gagnait → UnrecoverableError → job failed AVANT
 * debrief/transcript/persist → aucune donnée sauvée et bot supprimé en
 * pleine finalisation.
 *
 * Plutôt qu'une marge arbitraire fragile (option b), on exclut ces kinds
 * du race : leur boucle s'auto-termine déjà et leur cleanup est garanti
 * (deleteBot en finally, P1-6). Le timeout race reste actif pour TOUS les
 * autres kinds — c'est lui qui corrige le bug P1-5 originel (handler qui
 * hang sans auto-terminaison, ex appel provider bloqué).
 */
const SELF_TERMINATING_KINDS: ReadonlySet<JobKind> = new Set<JobKind>([
  "meeting-bot",
]);

export interface WorkerContext<P extends JobPayload = JobPayload> {
  /** BullMQ job — useful pour `job.updateProgress()`. */
  job: Job<P, JobResult>;
  payload: P;
  /** Update progress (0-100) and broadcast SSE event. */
  reportProgress: (value: number, message?: string) => Promise<void>;
}

export interface WorkerHandler<P extends JobPayload = JobPayload> {
  kind: JobKind;
  process: (ctx: WorkerContext<P>) => Promise<JobResult>;
  validateInput?: (payload: P) => void;
}

/**
 * Start a worker for the given JobKind. Returns the BullMQ Worker
 * instance — caller can `worker.close()` for graceful shutdown.
 */
export function startWorker<P extends JobPayload>(
  handler: WorkerHandler<P>,
): Worker<P, JobResult> | null {
  const connection = getBullConnection();
  if (!connection) {
    console.warn(`[Jobs] Worker ${handler.kind} skipped — REDIS_URL not set`);
    return null;
  }

  const config = JOB_QUEUE_CONFIGS[handler.kind];
  const processor: Processor<P, JobResult> = async (job) => {
    const payload = job.data;

    if (handler.validateInput) {
      handler.validateInput(payload);
    }

    const ctx: WorkerContext<P> = {
      job,
      payload,
      reportProgress: async (value: number, message?: string) => {
        await job.updateProgress(value);
        if (message) await job.log(message);
      },
    };

    let result: JobResult;

    if (SELF_TERMINATING_KINDS.has(handler.kind)) {
      // P1-B — Pas de Promise.race : le handler borne lui-même sa durée
      // (boucle de poll bornée) et garantit son cleanup en finally. Le
      // race tuait les meetings allant au bout de leur durée. Les erreurs
      // remontent telles quelles et sont mappées plus bas (catch commun).
      try {
        result = await handler.process(ctx);
      } catch (err) {
        if (err instanceof UnrecoverableError) {
          throw err;
        }
        if (isPermanentError(err)) {
          throw new UnrecoverableError((err as Error).message);
        }
        throw err;
      }

      // Settle credits (chemin succès) — voir bloc commun plus bas.
      if (payload.userId && payload.tenantId) {
        await settleCredits({
          userId: payload.userId,
          tenantId: payload.tenantId,
          reservedUsd: payload.estimatedCostUsd,
          actualUsd: result.actualCostUsd,
          jobId: String(job.id),
          jobKind: handler.kind,
          description: `${handler.kind} via ${result.providerUsed}`,
        }).catch((err) => {
          console.error(
            `[Jobs] settle_credits failed for ${handler.kind} job ${job.id}:`,
            err,
          );
        });
      }

      return result;
    }

    // Timeout réel sur handler.process : lockDuration empêche BullMQ de
    // considérer le job stalled mais ne tue PAS un handler qui hang. Sans
    // ce garde-fou, un appel provider bloqué tient le lock jusqu'à
    // lockDuration (= maxDurationMs × 2, jusqu'à 4h) avant libération.
    // On race contre un timeout de config.maxDurationMs ; le dépassement
    // est traité comme PERMANENT (UnrecoverableError) → pas de retry et
    // worker.on('failed') déclenche le refund crédit.
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new UnrecoverableError(
              `${handler.kind} job timed out after ${config.maxDurationMs}ms`,
            ),
          );
        }, config.maxDurationMs);
      });
      // P1-C — On capture la promesse du handler AVANT le race et on lui
      // attache un .catch() défensif. Quand le timeout gagne le race,
      // handler.process(ctx) continue de tourner (aucun abort câblé) ; s'il
      // rejette plus tard, plus rien ne l'attend → unhandledRejection qui
      // peut tuer le process worker (Node 16+) et emporter TOUS les jobs
      // concurrents in-flight. Le .catch() absorbe ce rejet tardif.
      //
      // Pas de double-settle : ce .catch() ne fait QUE logger. Le settle
      // succès (plus bas) est gated derrière `result` = race gagné par le
      // handler ; si le timeout gagne, on `throw` dans le catch ci-dessous
      // AVANT d'atteindre le settle succès. Le refund passe uniquement par
      // worker.on('failed') → settle_credits idempotent sur job_id
      // (migration 0085). Aucune corruption de balance possible.
      const processPromise = handler.process(ctx);
      processPromise.catch((err) => {
        console.warn(
          `[Jobs] ${handler.kind} job ${job.id} handler rejected (race may already be lost):`,
          err instanceof Error ? err.message : err,
        );
      });
      result = await Promise.race([processPromise, timeoutPromise]);
    } catch (err) {
      // Timeout → déjà une UnrecoverableError, on la relaie telle quelle.
      if (err instanceof UnrecoverableError) {
        throw err;
      }
      // PermanentJobError (4xx provider, input invalide) → BullMQ UnrecoverableError
      // pour ne pas retry (évite de double-facturer ElevenLabs / fal / e2b).
      if (isPermanentError(err)) {
        throw new UnrecoverableError((err as Error).message);
      }
      throw err;
    } finally {
      // Toujours nettoyer le timer (succès comme échec) pour ne pas fuiter
      // un setTimeout pendant lockDuration après un job rapide.
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    // Settle credits avec coût réel post-job. Le caller a déjà reservé
    // `payload.estimatedCostUsd` côté requireCredits ; ici on ajuste.
    if (payload.userId && payload.tenantId) {
      await settleCredits({
        userId: payload.userId,
        tenantId: payload.tenantId,
        reservedUsd: payload.estimatedCostUsd,
        actualUsd: result.actualCostUsd,
        jobId: String(job.id),
        jobKind: handler.kind,
        description: `${handler.kind} via ${result.providerUsed}`,
      }).catch((err) => {
        console.error(`[Jobs] settle_credits failed for ${handler.kind} job ${job.id}:`, err);
      });
    }

    return result;
  };

  const worker = new Worker<P, JobResult>(config.queueName, processor, {
    connection,
    concurrency: config.concurrency,
    // lockDuration doit couvrir le processing réel le plus long. Sinon
    // BullMQ considère le job stalled et le retry — ce qui facture le
    // provider 2× (ElevenLabs, fal, HeyGen, etc.) pour le même travail.
    // On prend 2× la durée max attendue pour absorber un débordement
    // ponctuel (upload R2 lent, blocking call provider).
    lockDuration: config.maxDurationMs * 2,
    stalledInterval: 30_000,
  });

  worker.on("failed", (job, err) => {
    console.error(`[Jobs] ${handler.kind} job ${job?.id} failed:`, err.message);
    // Sur échec, on libère la réservation crédit complète (refund partiel).
    if (job?.data?.userId && job?.data?.tenantId) {
      void settleCredits({
        userId: job.data.userId,
        tenantId: job.data.tenantId,
        reservedUsd: job.data.estimatedCostUsd,
        actualUsd: 0, // pas de coût facturé sur échec
        jobId: String(job.id),
        jobKind: handler.kind,
        description: `${handler.kind} failed: ${err.message}`,
      }).catch(() => {});
    }
  });

  worker.on("error", (err) => {
    console.error(`[Jobs] ${handler.kind} worker error:`, err.message);
  });

  console.log(`[Jobs] Worker ${handler.kind} started (concurrency=${config.concurrency})`);
  return worker;
}
