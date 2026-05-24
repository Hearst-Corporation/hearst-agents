import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { orchestrate } from "@/lib/engine/orchestrator";
import { ensureSchedulerStarted } from "@/lib/engine/runtime/missions/scheduler-init";
import { RateLimitExceededError } from "@/lib/llm/errors";
import { getTenantUsage, secondsUntilMidnightUtc } from "@/lib/llm/usage-tracker";
import { MAX_MESSAGES_PER_CONVERSATION } from "@/lib/memory/store";
import { authOptions } from "@/lib/platform/auth/options";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 120s = réduit depuis 300s pour éviter abus. Les runs longs vont via les
// workers (jobs queue). Heartbeat 20s injecté pour hold la connexion.
export const maxDuration = 120;

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Wrap un ReadableStream SSE pour injecter `: heartbeat\n\n` toutes les 20s.
 *
 * Les commentaires SSE (lignes commençant par `:`) ne déclenchent aucun
 * handler côté client mais maintiennent la connexion vivante face aux
 * proxies (Cloudflare, Vercel, nginx) qui ferment les sockets idle au-delà
 * de ~30s. Belt-and-suspenders avec le heartbeat interne au SSEAdapter :
 * ce wrapper est le dernier rempart au niveau du Response.
 *
 * Re-validation de session toutes les SESSION_REVALIDATION_CHUNKS chunks
 * (léger : NextAuth utilise le cache JWT côté serveur). Ferme le stream si
 * la session expire en cours de run.
 */
const SESSION_REVALIDATION_CHUNKS = 20;

function withHeartbeat(
  stream: ReadableStream<Uint8Array>,
  expectedUserId: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Si le controller est fermé, on stop le timer pour éviter la fuite.
          stopHeartbeat();
        }
      }, HEARTBEAT_INTERVAL_MS);

      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunkCount++;
          // Re-validation de session périodique — pas de latence si session valide
          // (NextAuth lit le JWT depuis le cookie, pas de DB round-trip).
          if (chunkCount % SESSION_REVALIDATION_CHUNKS === 0) {
            try {
              const session = await getServerSession(authOptions);
              const sessionUserId = (session as unknown as Record<string, unknown>)?.userId as
                | string
                | undefined;
              const userIdFromUser = (session?.user as { id?: string } | undefined)?.id;
              const currentUserId = sessionUserId ?? userIdFromUser ?? null;
              if (!session || currentUserId !== expectedUserId) {
                controller.enqueue(
                  encoder.encode(
                    `event: session_expired\ndata: ${JSON.stringify({ type: "session_expired" })}\n\n`,
                  ),
                );
                controller.close();
                return;
              }
            } catch {
              // Fail-open : ne pas interrompre le stream sur une erreur transitoire de session.
            }
          }

          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      } finally {
        stopHeartbeat();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      stopHeartbeat();
      void reader.cancel();
    },
  });
}

// Start the mission scheduler exactly once (module scope, survives hot-reload).
// Primary boot is instrumentation.ts; this is a secondary guard.
void ensureSchedulerStarted();

const orchestrateBodySchema = z.object({
  message: z.string().min(1).max(20_000),
  conversation_id: z.string().uuid().optional(),
  surface: z.string().optional(),
  thread_id: z.string().uuid().optional(),
  focal_context: z
    .object({
      id: z.string(),
      objectType: z.string(),
      title: z.string(),
      status: z.string(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4_000),
      }),
    )
    .max(20)
    .optional(),
  attached_asset_ids: z.array(z.string().uuid()).max(5).optional(),
  persona_id: z.string().optional(),
});

const PRICE_CAP_USD = 0.5; // par run orchestrate

export async function POST(req: NextRequest) {
  // Resolve full scope (userId + tenantId + workspaceId) via canonical scope resolver
  const { scope, error } = await requireScope({ context: "POST /api/orchestrate" });
  if (error || !scope) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message ?? "not_authenticated" }),
      { status: error?.status ?? 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Daily cost cap — no-op si ORCHESTRATE_COST_CAP_USD absent ou à 0
  const dailyCap = Number(process.env.ORCHESTRATE_COST_CAP_USD ?? 0);
  if (dailyCap > 0) {
    const todayUsage = await getTenantUsage(scope.tenantId, 1);
    const usedToday = todayUsage?.total_cost_usd ?? 0;
    if (usedToday >= dailyCap) {
      return NextResponse.json(
        { error: "daily_cost_cap_reached", cap: dailyCap, used: usedToday },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = orchestrateBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "invalid_body",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const validatedAssetIds = parsed.data.attached_asset_ids;

  const db = requireServerSupabase();

  const cappedHistory = (parsed.data.history ?? []).slice(-MAX_MESSAGES_PER_CONVERSATION);

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = orchestrate(db, {
      userId: scope.userId,
      message: parsed.data.message,
      conversationId: parsed.data.conversation_id,
      surface: parsed.data.surface,
      threadId: parsed.data.thread_id,
      focalContext: parsed.data.focal_context,
      conversationHistory: cappedHistory.length > 0 ? cappedHistory : undefined,
      attachedAssetIds: validatedAssetIds,
      personaId: parsed.data.persona_id,
      // missionId n'est pas accepté depuis le chat public — ownership validé via /api/v2/missions/[id]/run
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      max_cost_usd: PRICE_CAP_USD,
      userName: scope.userName,
    });
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return new Response(
        JSON.stringify({ ok: false, error: "rate_limit_exceeded", limitType: err.limitType }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(secondsUntilMidnightUtc()),
          },
        },
      );
    }
    throw err;
  }

  return new Response(withHeartbeat(stream, scope.userId), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
