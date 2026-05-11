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
import { startAudioGenWorker } from "./audio-gen";
import { startImageGenWorker } from "./image-gen";
import { startDocumentParseWorker } from "./document-parse";
import { startCodeExecWorker } from "./code-exec";
import { startVideoGenWorker } from "./video-gen";
import { startBrowserTaskWorker } from "./browser-task";
import { startInboxFetchWorker } from "./inbox-fetch";
import { startMeetingBotWorker } from "./meeting-bot";
import { startDailyBriefWorker } from "./daily-brief";
import { startSimulationWorker } from "./simulation";
import { startInboxCron } from "../scheduled/inbox-cron";

let _started = false;
const _startedWorkers: Worker[] = [];

async function closeAllWorkers(): Promise<void> {
  console.log(`[workers] shutting down ${_startedWorkers.length} worker(s)`);
  await Promise.all(_startedWorkers.map((w) => w.close().catch(() => {})));
  _startedWorkers.length = 0;
}

function registerShutdownHandlers(): void {
  process.once("SIGTERM", () => {
    console.log("[workers] SIGTERM received — closing workers");
    void closeAllWorkers();
  });
  process.once("SIGINT", () => {
    console.log("[workers] SIGINT received — closing workers");
    void closeAllWorkers();
  });
}

export function startAllWorkers(): void {
  if (_started) return;
  _started = true;

  const push = (w: Worker | null) => {
    if (w) _startedWorkers.push(w);
  };

  push(startAudioGenWorker());
  push(startImageGenWorker());
  push(startDocumentParseWorker());
  push(startCodeExecWorker());
  push(startVideoGenWorker());
  push(startBrowserTaskWorker());
  push(startInboxFetchWorker());
  push(startMeetingBotWorker());
  push(startDailyBriefWorker());
  push(startSimulationWorker());
  void startInboxCron();
  // startMemoryIngestWorker();  // Phase B.10 (Letta + pgvector)
  // startAssetVariantWorker();  // wrapper qui re-dispatch

  if (_startedWorkers.length > 0) {
    registerShutdownHandlers();
    console.log(`[workers] ${_startedWorkers.length} worker(s) started, SIGTERM handler registered`);
  }
}
