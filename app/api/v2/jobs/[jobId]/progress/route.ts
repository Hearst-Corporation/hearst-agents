/**
 * GET /api/v2/jobs/[jobId]/progress?kind=video-gen
 *
 * Stream Server-Sent Events de la progression d'un job BullMQ. Client se
 * connecte via EventSource et reçoit chaque update `reportProgress(value, label)`
 * du worker en temps réel, plus un event `completed` (avec returnvalue) ou
 * `failed` (avec failedReason) en fin de cycle.
 *
 * Pourquoi SSE plutôt que polling :
 *   - le worker Phase B émet `reportProgress(5, 20, 80, 90, 100)` avec un
 *     label métier ("Runway: tâche soumise, polling…") qui se perd dans un
 *     poll naïf 4s
 *   - SSE permet d'animer la progress bar finement (transition du label
 *     entre étapes) et de fermer la connexion proprement à la fin
 *
 * Implémentation : on combine `QueueEvents` (subscribe aux events Redis pub/sub
 * BullMQ : progress, completed, failed) + un poll de fallback toutes les 1.5s
 * sur `getJobState()` pour récupérer le `state` (waiting/active/…) au cas où
 * l'event progress arrive avant qu'on s'abonne.
 *
 * Format SSE :
 *   event: progress
 *   data: {"progress": 50, "label": "Runway: tâche soumise, polling…"}
 *
 *   event: completed
 *   data: {"returnvalue": {…}}
 *
 *   event: failed
 *   data: {"reason": "…"}
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JOB_QUEUE_CONFIGS } from "@/lib/jobs/configs";
import { getBullConnection } from "@/lib/jobs/connection";
import { getJobState } from "@/lib/jobs/queue";
import { getQueueEvents } from "@/lib/jobs/queue-events-singleton";
import type { JobKind } from "@/lib/jobs/types";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KNOWN_KINDS = [
  "image-gen",
  "audio-gen",
  "video-gen",
  "document-parse",
  "code-exec",
  "browser-task",
  "meeting-bot",
  "memory-ingest",
  "asset-variant",
] as const satisfies readonly JobKind[];

const querySchema = z.object({
  kind: z.enum(KNOWN_KINDS),
});

const POLL_FALLBACK_MS = 1_500;
const PING_INTERVAL_MS = 25_000;
// Re-validation de session toutes les 30s — coupe le stream si la session expire.
const SESSION_REVALIDATION_INTERVAL_MS = 30_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const { scope, error: scopeError } = await requireScope({
    context: `GET /api/v2/jobs/${jobId}/progress`,
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ kind: url.searchParams.get("kind") });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Query param `kind` requis (image-gen, audio-gen, video-gen, …).",
      },
      { status: 400 },
    );
  }

  const kind = parsed.data.kind;
  const connection = getBullConnection();
  if (!connection) {
    return NextResponse.json(
      { error: "queue_unavailable", message: "REDIS_URL non configuré" },
      { status: 503 },
    );
  }

  const queueName = JOB_QUEUE_CONFIGS[kind].queueName;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let stopped = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      let sessionTimer: ReturnType<typeof setInterval> | null = null;
      // Singleton QueueEvents — pas de close() ici (géré par queue-events-singleton),
      // mais on DOIT retirer nos propres listeners au close pour éviter une fuite :
      // le singleton étant partagé, chaque connexion SSE empilerait sinon 3
      // listeners (progress/completed/failed) jamais nettoyés
      // → MaxListenersExceededWarning + fuite mémoire sous charge.
      let qe: ReturnType<typeof getQueueEvents> | null = null;
      let lastProgress = -1;

      // Handlers nommés (cf. closeAll) — déclarés ici pour partager `jobId`,
      // `sendProgress`, `sendEvent`, `closeAll` du scope tout en restant
      // référençables pour `qe.off(...)`.
      const onProgress = ({ jobId: evJobId, data }: { jobId: string; data: unknown }) => {
        if (evJobId !== jobId) return;
        // BullMQ `data` peut être un nombre (progress %) ou un objet libre.
        // Notre worker-base appelle `job.updateProgress(value)` puis
        // `job.log(message)` séparément, donc ici on n'a que le %.
        // Le label vient du poll fallback via `state` qui lit le job log
        // si dispo, mais BullMQ ne l'expose pas trivialement — on se
        // rabat sur des labels canoniques côté client en fonction du %.
        if (typeof data === "number") {
          sendProgress(data);
        } else if (data && typeof data === "object" && "progress" in data) {
          const obj = data as { progress?: number; label?: string };
          if (typeof obj.progress === "number") sendProgress(obj.progress, obj.label);
        }
      };

      const onCompleted = ({
        jobId: evJobId,
        returnvalue,
      }: {
        jobId: string;
        returnvalue: unknown;
      }) => {
        if (evJobId !== jobId) return;
        sendProgress(100);
        let parsed: unknown = returnvalue;
        if (typeof returnvalue === "string") {
          try {
            parsed = JSON.parse(returnvalue);
          } catch {
            parsed = returnvalue;
          }
        }
        sendEvent("completed", { returnvalue: parsed });
        closeAll();
      };

      const onFailed = ({
        jobId: evJobId,
        failedReason,
      }: {
        jobId: string;
        failedReason?: string;
      }) => {
        if (evJobId !== jobId) return;
        sendEvent("failed", { reason: failedReason ?? "unknown_error" });
        closeAll();
      };

      const closeAll = () => {
        if (stopped) return;
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
        if (pingTimer) clearInterval(pingTimer);
        if (sessionTimer) clearInterval(sessionTimer);
        // QueueEvents singleton — ne pas close() ici, il est partagé entre
        // connexions SSE. MAIS on retire nos 3 listeners (1 off par on) sinon
        // ils restent attachés au singleton à vie → fuite mémoire.
        if (qe) {
          qe.off("progress", onProgress);
          qe.off("completed", onCompleted);
          qe.off("failed", onFailed);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", closeAll);

      const enqueue = (chunk: Uint8Array) => {
        if (stopped || req.signal.aborted) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closeAll();
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        const payload = JSON.stringify(data);
        enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
      };

      const sendProgress = (value: number, label?: string) => {
        if (value === lastProgress && !label) return;
        lastProgress = value;
        sendEvent("progress", { progress: value, label: label ?? null });
      };

      // 1. Subscribe BullMQ QueueEvents — singleton partagé, pas de leak Redis.
      // Le singleton est créé une seule fois par queueName (Pattern C).
      try {
        qe = getQueueEvents(queueName);
        if (qe) {
          await qe.waitUntilReady();

          qe.on("progress", onProgress);
          qe.on("completed", onCompleted);
          qe.on("failed", onFailed);
        }
      } catch (err) {
        console.error(`[GET /api/v2/jobs/${jobId}/progress] QueueEvents subscribe failed:`, err);
        // On continue avec le poll fallback uniquement.
      }

      // 2. Initial state — utile si le job a déjà progressé avant qu'on
      //    s'abonne (race condition typique : enqueue → fetch côté client →
      //    le worker a déjà émis progress 5).
      const initial = await getJobState(kind, jobId);
      if (!initial) {
        sendEvent("not_found", { jobId, kind });
        closeAll();
        return;
      }

      // Ownership check — retourne not_found (pas 403) pour éviter l'info disclosure (F-004)
      // F-004 PARTIAL fix : !jobUserId bloque les payloads sans userId (pas de bypass silencieux).
      const jobUserId = (initial.data as { userId?: string } | undefined)?.userId;
      if (!jobUserId || jobUserId !== scope.userId) {
        sendEvent("not_found", { jobId, kind });
        closeAll();
        return;
      }

      sendProgress(initial.progress);
      if (initial.state === "completed") {
        sendEvent("completed", { returnvalue: initial.returnvalue ?? null });
        closeAll();
        return;
      }
      if (initial.state === "failed") {
        sendEvent("failed", { reason: initial.failedReason ?? "unknown_error" });
        closeAll();
        return;
      }

      // 3. Poll fallback — couvre les cas où QueueEvents loupe un event
      //    (ex : worker en autre instance qui n'émet pas pub/sub correctement).
      pollTimer = setInterval(async () => {
        if (stopped || req.signal.aborted) return;
        try {
          const s = await getJobState(kind, jobId);
          if (!s) return;
          if (s.progress > lastProgress) {
            sendProgress(s.progress);
          }
          if (s.state === "completed") {
            sendEvent("completed", { returnvalue: s.returnvalue ?? null });
            closeAll();
          } else if (s.state === "failed") {
            sendEvent("failed", { reason: s.failedReason ?? "unknown_error" });
            closeAll();
          }
        } catch (err) {
          console.error(`[GET /api/v2/jobs/${jobId}/progress] poll failed:`, err);
        }
      }, POLL_FALLBACK_MS);

      // 4. Heartbeat — empêche les proxys (Vercel, Cloudflare) de couper
      //    une connexion silencieuse.
      pingTimer = setInterval(() => {
        if (stopped || req.signal.aborted) {
          closeAll();
          return;
        }
        enqueue(encoder.encode(":\n\n"));
      }, PING_INTERVAL_MS);

      // 5. Re-validation périodique de la session — coupe le stream si la session
      //    expire ou est révoquée pendant un job long (video-gen, etc.).
      sessionTimer = setInterval(async () => {
        if (stopped || req.signal.aborted) return;
        try {
          const { error } = await requireScope({
            context: `GET /api/v2/jobs/${jobId}/progress [revalidation]`,
          });
          if (error) {
            sendEvent("session_expired", { message: "session_expired" });
            closeAll();
          }
        } catch {
          // Fail-open : ne pas interrompre un job long sur une erreur transitoire de session.
        }
      }, SESSION_REVALIDATION_INTERVAL_MS);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
