/**
 * Workers boot — démarre tous les workers Phase B.
 *
 * Appelé une seule fois côté serveur (instrumentation.ts).
 * Sans REDIS_URL : aucun worker ne démarre, les jobs throw à l'enqueue.
 *
 * Pattern D — SIGTERM handler :
 * Tous les workers démarrés sont trackés dans `_startedWorkers[]`.
 * SIGTERM / SIGINT → worker.close() propre sur chacun pour éviter le
 * stalled-job BullMQ qui retry après redémarrage et double-facture le
 * provider (ElevenLabs, fal, HeyGen, etc.).
 */

import type { Worker } from "bullmq";
import { logger } from "@/lib/observability/logger";
import { INNGEST_JOB_KINDS } from "../queue";
import { startInboxCron } from "../scheduled/inbox-cron";
import { startAudioGenWorker } from "./audio-gen";
import { startBrowserTaskWorker } from "./browser-task";
import { startCodeExecWorker } from "./code-exec";
import { startDailyBriefWorker } from "./daily-brief";
import { startDocumentParseWorker } from "./document-parse";
import { startImageGenWorker } from "./image-gen";
import { startInboxFetchWorker } from "./inbox-fetch";
import { startMeetingBotWorker } from "./meeting-bot";
import { startSimulationWorker } from "./simulation";
import { startVideoGenWorker } from "./video-gen";

let _started = false;
const _startedWorkers: Worker[] = [];

async function closeAllWorkers(): Promise<void> {
  logger.info({ count: _startedWorkers.length }, "[workers] shutting down workers");
  await Promise.all(_startedWorkers.map((w) => w.close().catch(() => {})));
  _startedWorkers.length = 0;
}

function registerShutdownHandlers(): void {
  process.once("SIGTERM", () => {
    logger.info("[workers] SIGTERM received — closing workers");
    void closeAllWorkers();
  });
  process.once("SIGINT", () => {
    logger.info("[workers] SIGINT received — closing workers");
    void closeAllWorkers();
  });
}

export function startAllWorkers(): void {
  if (_started) return;
  _started = true;

  const push = (w: Worker | null) => {
    if (w) _startedWorkers.push(w);
  };

  // Les kinds Inngest-routed (audio/image/doc/code/daily-brief) sont
  // systématiquement enqueuesés via inngest.send() côté queue.ts. Démarrer
  // leur Worker BullMQ ne sert à rien (queue jamais consommée) et brouille
  // la frontière Inngest↔BullMQ. On ne démarre que les Workers responsables
  // d'un kind hors INNGEST_JOB_KINDS.
  const startIfBullMQ = (
    kind: Parameters<typeof INNGEST_JOB_KINDS.has>[0],
    starter: () => Worker | null,
  ): void => {
    if (INNGEST_JOB_KINDS.has(kind)) {
      logger.info({ kind }, "[workers] skipping BullMQ worker (Inngest-routed)");
      return;
    }
    push(starter());
  };

  startIfBullMQ("audio-gen", startAudioGenWorker);
  startIfBullMQ("image-gen", startImageGenWorker);
  startIfBullMQ("document-parse", startDocumentParseWorker);
  startIfBullMQ("code-exec", startCodeExecWorker);
  startIfBullMQ("daily-brief", startDailyBriefWorker);
  // Kinds restés en BullMQ (pas dans INNGEST_JOB_KINDS) :
  push(startVideoGenWorker());
  push(startBrowserTaskWorker());
  push(startInboxFetchWorker());
  push(startMeetingBotWorker());
  push(startSimulationWorker());
  void startInboxCron();
  // startMemoryIngestWorker();  // Phase B.10 (Letta + pgvector)
  // startAssetVariantWorker();  // wrapper qui re-dispatch

  if (_startedWorkers.length > 0) {
    registerShutdownHandlers();
    logger.info(
      { count: _startedWorkers.length },
      "[workers] workers started, SIGTERM handler registered",
    );
  }
}
