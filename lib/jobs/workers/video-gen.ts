import { updateVariant } from "@/lib/assets/variants";
import { heygenGenerateVideo, heygenGetStatus } from "@/lib/capabilities/providers/heygen";
import { runwayGenerateVideo, runwayGetTask } from "@/lib/capabilities/providers/runway";
import { getGlobalStorage } from "@/lib/engine/runtime/assets/storage";
import type { JobResult, VideoGenInput } from "@/lib/jobs/types";
import { startWorker, type WorkerHandler } from "@/lib/jobs/worker-base";
import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";
import { logger } from "@/lib/observability/logger";

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 60;

/**
 * Estimation du coût en USD selon le provider et la durée.
 * Sources (mai 2026) :
 * - Runway Gen-3 turbo : $0.05/sec (duration 5s = $0.25, 10s = $0.50)
 * - HeyGen Creator : ~$0.30/vidéo standard (60s avatar)
 *
 * Note : ces valeurs sont des estimations, les API ne renvoient pas le coût
 * exact. À mettre à jour quand les providers exposent un champ cost dans
 * leur response.
 */
function estimateVideoCostUsd(provider: string, durationSec: number): number {
  if (provider === "runway") return durationSec * 0.05;
  if (provider === "heygen") return 0.3;
  return 0;
}

async function pollHeyGen(videoId: string): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const { status, videoUrl } = await heygenGetStatus(videoId);
    if (status === "completed" && videoUrl) return videoUrl;
    if (status === "failed") throw new Error(`[HeyGen] Vidéo échouée`);
  }
  throw new Error("[HeyGen] Timeout polling vidéo");
}

async function pollRunway(taskId: string): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const { status, videoUrl, error } = await runwayGetTask(taskId);
    if (status === "SUCCEEDED" && videoUrl) return videoUrl;
    if (status === "FAILED") throw new Error(`[Runway] Tâche échouée: ${error ?? ""}`);
  }
  throw new Error("[Runway] Timeout polling tâche");
}

async function tryHeyGen(params: {
  scriptText: string;
  avatarId?: string;
  voiceId?: string;
  idempotencyKey: string;
  progressMessage: string;
  reportProgress: (pct: number, msg: string) => Promise<void>;
}): Promise<string> {
  if (defaultCircuitBreaker.isOpen("heygen")) {
    throw new Error("[video-gen] HeyGen circuit breaker OPEN");
  }
  try {
    const { videoId } = await heygenGenerateVideo({
      scriptText: params.scriptText,
      avatarId: params.avatarId,
      voiceId: params.voiceId,
      idempotencyKey: params.idempotencyKey,
    });
    await params.reportProgress(20, `${params.progressMessage}: job ${videoId} soumis, polling…`);
    const videoUrl = await pollHeyGen(videoId);
    defaultCircuitBreaker.recordSuccess("heygen");
    return videoUrl;
  } catch (heygenErr) {
    defaultCircuitBreaker.recordFailure("heygen", heygenErr as Error);
    if (defaultCircuitBreaker.getState("heygen") === "OPEN") {
      logger.warn("[video-gen] HeyGen circuit OPEN");
    }
    throw heygenErr;
  }
}

const handler: WorkerHandler<VideoGenInput> = {
  kind: "video-gen",

  validateInput(payload) {
    if (!payload.prompt && !payload.scriptText) {
      throw new Error("video-gen: prompt ou scriptText requis");
    }
    if (!payload.provider) {
      throw new Error("video-gen: provider requis (heygen | runway)");
    }
  },

  async process(ctx): Promise<JobResult> {
    const { payload, reportProgress } = ctx;
    const jobId = String(ctx.job.id);
    const variantId =
      (payload as VideoGenInput & { variantId?: string }).variantId ??
      (typeof payload === "object" && payload !== null && "metadata" in payload
        ? (payload as { metadata?: { variantId?: string } }).metadata?.variantId
        : undefined);

    const provider = payload.provider ?? "runway";

    await reportProgress(5, "Génération vidéo en cours");

    let videoUrl: string;
    let providerUsed: string;

    if (provider === "heygen") {
      videoUrl = await tryHeyGen({
        scriptText: payload.scriptText ?? payload.prompt,
        avatarId: payload.avatarId,
        voiceId: payload.voiceId,
        idempotencyKey: jobId,
        progressMessage: "HeyGen",
        reportProgress,
      });
      providerUsed = "heygen";
    } else {
      // Runway avec fallback HeyGen
      const runwayOpen = defaultCircuitBreaker.isOpen("runway");
      if (!runwayOpen) {
        try {
          const { taskId } = await runwayGenerateVideo({
            promptText: payload.prompt,
            duration: payload.durationSeconds === 10 ? 10 : 5,
            ratio: payload.ratio ?? "1280:720",
            idempotencyKey: jobId,
          });
          await reportProgress(20, `Runway: tâche ${taskId} soumise, polling…`);
          videoUrl = await pollRunway(taskId);
          defaultCircuitBreaker.recordSuccess("runway");
          providerUsed = "runway";
        } catch (runwayErr) {
          defaultCircuitBreaker.recordFailure("runway", runwayErr as Error);
          if (defaultCircuitBreaker.getState("runway") === "OPEN") {
            logger.warn("[video-gen] Runway circuit OPEN — fallback HeyGen");
          } else {
            logger.warn({ err: runwayErr }, "[video-gen] Runway failed — falling back to HeyGen");
          }
          // Fallback HeyGen
          if (defaultCircuitBreaker.isOpen("heygen")) {
            throw new Error("[video-gen] Both Runway and HeyGen circuit breakers are OPEN");
          }
          videoUrl = await tryHeyGen({
            scriptText: payload.scriptText ?? payload.prompt,
            avatarId: payload.avatarId,
            voiceId: payload.voiceId,
            idempotencyKey: `${jobId}-fallback`,
            progressMessage: "HeyGen (fallback)",
            reportProgress,
          });
          providerUsed = "heygen";
        }
      } else {
        // Runway circuit ouvert → skip directement au fallback HeyGen
        logger.warn("[video-gen] Runway circuit OPEN — skip direct vers HeyGen");
        if (defaultCircuitBreaker.isOpen("heygen")) {
          throw new Error("[video-gen] Both Runway and HeyGen circuit breakers are OPEN");
        }
        videoUrl = await tryHeyGen({
          scriptText: payload.scriptText ?? payload.prompt,
          avatarId: payload.avatarId,
          voiceId: payload.voiceId,
          idempotencyKey: `${jobId}-fallback`,
          progressMessage: "HeyGen (fallback Runway OPEN)",
          reportProgress,
        });
        providerUsed = "heygen";
      }
    }

    await reportProgress(80, "Vidéo prête, téléchargement…");

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`[video-gen] Téléchargement vidéo échoué: ${videoRes.status}`);
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const storage = getGlobalStorage();
    const variantKey = variantId ?? `video-${ctx.job.id}`;
    const storageKey = `video/${payload.assetId ?? "orphan"}/${variantKey}.mp4`;

    const upload = await storage.upload(storageKey, videoBuffer, {
      contentType: "video/mp4",
      tenantId: payload.tenantId,
      metadata: {
        userId: payload.userId,
        provider: providerUsed,
      },
    });

    await reportProgress(90, "Upload terminé, persistance");

    if (variantId) {
      await updateVariant(variantId, {
        status: "ready",
        storageUrl: upload.url,
        mimeType: "video/mp4",
        sizeBytes: upload.size,
        generatedAt: Date.now(),
        provider: providerUsed,
        metadata: {
          sourceUrl: videoUrl,
          provider: providerUsed,
        },
      });
    }

    await reportProgress(100, "Vidéo persistée");

    return {
      assetId: payload.assetId,
      variantId,
      storageUrl: upload.url,
      actualCostUsd: estimateVideoCostUsd(providerUsed, payload.durationSeconds ?? 5),
      providerUsed,
      metadata: {
        sourceUrl: videoUrl,
        provider: providerUsed,
      },
    };
  },
};

export function startVideoGenWorker() {
  return startWorker(handler);
}
