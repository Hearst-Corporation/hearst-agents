import type { NextRequest } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { globalRunBus } from "@/lib/events/global-bus";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Re-validation de session toutes les 30s (2 heartbeats) pour couper le
// stream si la session admin expire en cours de connexion.
const SESSION_REVALIDATION_INTERVAL_MS = 30_000;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin("GET /api/admin/events-stream", {
    resource: "runs",
    action: "read",
  });
  if (isError(guard)) return guard;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let stopped = false;

      const safeEnqueue = (chunk: string) => {
        if (stopped) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller closed, ignored
        }
      };

      const closeAll = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(heartbeat);
        clearInterval(sessionCheck);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      safeEnqueue(`data: ${JSON.stringify({ type: "stream_open" })}\n\n`);

      for (const event of globalRunBus.getRecent()) {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      }

      const unsubscribe = globalRunBus.subscribe((event) => {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(`: ping\n\n`);
      }, 15000);

      // Re-validation périodique de la session — ferme le stream si la session
      // admin expire ou est révoquée pendant une connexion longue.
      const sessionCheck = setInterval(async () => {
        if (stopped || req.signal.aborted) return;
        try {
          const { error } = await requireScope({
            context: "GET /api/admin/events-stream [revalidation]",
          });
          if (error) {
            safeEnqueue(`data: ${JSON.stringify({ type: "session_expired" })}\n\n`);
            closeAll();
          }
        } catch {
          // Fail-open : ne pas casser le stream sur une erreur de revalidation transitoire.
        }
      }, SESSION_REVALIDATION_INTERVAL_MS);

      const cleanup = () => {
        closeAll();
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
