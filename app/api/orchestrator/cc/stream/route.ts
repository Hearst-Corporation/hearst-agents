import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { loadCC } from "@/lib/hom/cc-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE stream du Command Center. Pousse l'état toutes les 2s.
 * Côté Vercel : la durée d'edge function est limitée — un client bien
 * configuré (EventSource auto-reconnect) gère cette contrainte sans bruit.
 */
export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/cc/stream", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const encoder = new TextEncoder();
  let active = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          active = false;
        }
      };

      const tick = async () => {
        if (!active) return;
        const state = await loadCC();
        send("state", state);
      };

      // First tick + interval
      await tick();
      const id = setInterval(tick, 2000);

      const cleanup = () => {
        active = false;
        clearInterval(id);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Auto-stop après 60s pour respecter les limites edge.
      setTimeout(cleanup, 60_000);
    },
    cancel() {
      active = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
