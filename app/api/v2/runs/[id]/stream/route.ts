/**
 * GET /api/v2/runs/[id]/stream — SSE temps réel d'une run (table `runs`).
 *
 * Suit l'avancement d'une run en direct, source de vérité = la table `runs`
 * (mise à jour par les fonctions Inngest, ex: swarm-run). Contrairement à
 * /api/v2/jobs/[jobId]/progress (BullMQ/Redis), celui-ci poll Postgres → marche
 * sur Vercel serverless + Inngest. Pensé pour les swarms (4-8 min) : le run
 * apparaît "running" puis "completed" avec son output, sans refresh.
 *
 * Format SSE :
 *   event: status   data: {"status":"running"}
 *   event: completed data: {"status":"completed","output":{…}}
 *   event: failed    data: {"status":"failed","error":"…"}
 *
 * Garde-fous : ownership (run.user_id === scope.userId), heartbeat anti-proxy,
 * abort client, re-validation session, timeout dur (max ~10 min).
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const POLL_MS = 2_000;
const PING_MS = 25_000;
const SESSION_REVALIDATION_MS = 30_000;
const MAX_STREAM_MS = 9 * 60 * 1000; // borne dure (swarm ≤ 8 min)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;

  const { scope, error: scopeError } = await requireScope({
    context: `GET /api/v2/runs/${runId}/stream`,
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const sb = requireServerSupabase();
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let stopped = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      let sessionTimer: ReturnType<typeof setInterval> | null = null;
      let lastStatus = "";

      const closeAll = () => {
        if (stopped) return;
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
        if (pingTimer) clearInterval(pingTimer);
        if (sessionTimer) clearInterval(sessionTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", closeAll);

      const send = (event: string, data: unknown) => {
        if (stopped || req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closeAll();
        }
      };

      // Lit la run + vérifie l'ownership. Émet l'event terminal le cas échéant.
      const tick = async (): Promise<void> => {
        if (stopped || req.signal.aborted) return;
        if (Date.now() - startedAt > MAX_STREAM_MS) {
          send("timeout", { runId });
          closeAll();
          return;
        }
        const { data, error } = await sb
          .from("runs")
          .select("status, output, error, user_id")
          .eq("id", runId)
          .maybeSingle();

        if (error) return; // transitoire → on retentera au prochain poll
        if (!data) {
          send("not_found", { runId });
          closeAll();
          return;
        }
        // Ownership — not_found plutôt que 403 (pas d'info disclosure).
        if (!data.user_id || data.user_id !== scope.userId) {
          send("not_found", { runId });
          closeAll();
          return;
        }

        const status = String(data.status);
        if (status !== lastStatus) {
          lastStatus = status;
          send("status", { status });
        }
        if (status === "completed") {
          send("completed", { status, output: data.output ?? {} });
          closeAll();
        } else if (status === "failed") {
          send("failed", { status, error: data.error ?? "unknown" });
          closeAll();
        }
      };

      // Snapshot initial immédiat (le run peut déjà être terminé).
      await tick();
      if (stopped) return;

      pollTimer = setInterval(() => void tick(), POLL_MS);

      pingTimer = setInterval(() => {
        if (stopped || req.signal.aborted) {
          closeAll();
          return;
        }
        try {
          controller.enqueue(encoder.encode(":\n\n"));
        } catch {
          closeAll();
        }
      }, PING_MS);

      sessionTimer = setInterval(async () => {
        if (stopped || req.signal.aborted) return;
        try {
          const { error } = await requireScope({
            context: `GET /api/v2/runs/${runId}/stream [revalidation]`,
          });
          if (error) {
            send("session_expired", { type: "session_expired" });
            closeAll();
          }
        } catch {
          /* fail-open : pas couper sur erreur transitoire */
        }
      }, SESSION_REVALIDATION_MS);
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
