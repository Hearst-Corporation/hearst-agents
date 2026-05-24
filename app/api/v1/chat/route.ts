/**
 * POST /api/v1/chat — Endpoint SDK serveur-à-serveur pour lancer un tour de chat.
 *
 * Réutilise `orchestrate()` de lib/engine/orchestrator (même logique que
 * /api/orchestrate) mais résout le tenant depuis withApiAuth (clé API SDK)
 * plutôt que depuis la session NextAuth.
 *
 * Retourne un stream SSE text/event-stream identique à /api/orchestrate.
 * Pas de re-validation de session (clé API = auth stateless).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { orchestrate } from "@/lib/engine/orchestrator";
import { RateLimitExceededError } from "@/lib/llm/errors";
import { getTenantUsage, secondsUntilMidnightUtc } from "@/lib/llm/usage-tracker";
import { MAX_MESSAGES_PER_CONVERSATION } from "@/lib/memory/store";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { hasApiScope, withApiAuth } from "@/lib/platform/http/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const chatBodySchema = z.object({
  message: z.string().min(1).max(20_000),
  conversationId: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4_000),
      }),
    )
    .max(20)
    .optional(),
});

const PRICE_CAP_USD = 0.5;

export const POST = withApiAuth("POST /api/v1/chat", async (req: NextRequest, { tenant }) => {
  if (!hasApiScope(tenant, "write")) {
    return NextResponse.json({ error: "insufficient_scope" }, { status: 403 });
  }

  // Daily cost cap — no-op si ORCHESTRATE_COST_CAP_USD absent ou à 0
  const dailyCap = Number(process.env.ORCHESTRATE_COST_CAP_USD ?? 0);
  if (dailyCap > 0) {
    const todayUsage = await getTenantUsage(tenant.tenantId, 1);
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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = requireServerSupabase();

  const cappedHistory = (parsed.data.history ?? []).slice(-MAX_MESSAGES_PER_CONVERSATION);

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = orchestrate(db, {
      userId: tenant.userId ?? tenant.tenantId,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      conversationHistory: cappedHistory.length > 0 ? cappedHistory : undefined,
      tenantId: tenant.tenantId,
      max_cost_usd: PRICE_CAP_USD,
    });
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "rate_limit_exceeded", limitType: err.limitType },
        {
          status: 429,
          headers: { "Retry-After": String(secondsUntilMidnightUtc()) },
        },
      );
    }
    throw err;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
