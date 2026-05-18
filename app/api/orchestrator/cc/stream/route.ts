import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { loadCC } from "@/lib/hom/cc-state";
import { requireScope } from "@/lib/platform/auth/scope";

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

      // id défini après setInterval — on utilise un wrapper pour éviter la
      // référence forward entre cleanup ↔ tick.
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        active = false;
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      let tickCount = 0;
      const tick = async () => {
        if (!active) return;
        tickCount++;
        // Re-validation de session toutes les 15 ticks (~30s à 2s/tick) —
        // ferme le stream si la session admin expire en cours de connexion.
        if (tickCount % 15 === 0) {
          try {
            const { error } = await requireScope({
              context: "GET /api/orchestrator/cc/stream [revalidation]",
            });
            if (error) {
              send("session_expired", { message: "session_expired" });
              cleanup();
              return;
            }
          } catch {
            // Fail-open : ne pas casser le stream sur une erreur transitoire de session.
          }
        }
        const state = await loadCC();
        send("state", state);
      };

      // First tick + interval
      await tick();
      intervalId = setInterval(tick, 2000);

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
