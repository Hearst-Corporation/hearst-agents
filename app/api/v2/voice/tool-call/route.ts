/**
 * POST /api/v2/voice/tool-call
 *
 * Exécute une function call émise par OpenAI Realtime côté browser.
 * Le client (VoicePulse) a reçu un event `response.function_call_arguments.done`
 * via le DataChannel "oai-events", parse les args, POST ici, puis renvoie
 * l'output au modèle via `conversation.item.create` (function_call_output).
 *
 * Body : {
 *   name: string,
 *   args: Record<string, unknown>,
 *   callId?: string,        // sert à apparier tool_call ↔ tool_result en transcript
 *   sessionId?: string,     // pour persister dans voice_transcripts
 *   threadId?: string,      // optionnel, lie au thread chat
 * }
 * Response : {
 *   output: string,
 *   stageRequest?: StagePayload,
 *   providerId?: string,
 *   latencyMs?: number,
 *   costUsd?: number,
 *   status?: "success" | "error",
 * }
 *
 * Side effect : persiste deux entries (tool_call pré-exec + tool_result
 * post-exec) dans voice_transcripts, append-only, scope user/tenant via
 * RLS migration 0045.
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireScope } from "@/lib/platform/auth/scope";
import { executeVoiceTool } from "@/lib/voice/tools";
import { appendTranscriptEntry } from "@/lib/voice/transcript-store";

const voiceToolCallBodySchema = z.object({
  name: z.string().min(1).max(200),
  args: z.record(z.string(), z.unknown()).optional().default({}),
  callId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  threadId: z.string().max(200).optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/voice/tool-call",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = voiceToolCallBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, args, callId, sessionId, threadId } = parsed.data;

  // 1. Persiste la tool_call entry (pending) AVANT l'exec — l'UI peut
  //    déjà afficher le receipt en pending pendant qu'on appelle Composio.
  if (sessionId) {
    void appendTranscriptEntry({
      sessionId,
      userId: scope.userId,
      tenantId: scope.tenantId,
      threadId: threadId ?? null,
      entry: {
        id: callId ?? `tc-${randomUUID()}`,
        role: "tool_call",
        text: name,
        toolName: name,
        callId,
        args,
        status: "pending",
        timestamp: Date.now(),
      },
    });
  }

  try {
    const result = await executeVoiceTool({ name, args, scope });

    // 2. Persiste la tool_result entry (success/error) avec providerId/latency.
    if (sessionId) {
      void appendTranscriptEntry({
        sessionId,
        userId: scope.userId,
        tenantId: scope.tenantId,
        threadId: threadId ?? null,
        entry: {
          id: `tr-${callId ?? randomUUID()}`,
          role: "tool_result",
          text: result.output,
          toolName: name,
          callId,
          output: result.output,
          status: result.status ?? "success",
          providerId: result.providerId,
          timestamp: Date.now(),
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice/tool-call] error:", message);

    if (sessionId) {
      void appendTranscriptEntry({
        sessionId,
        userId: scope.userId,
        tenantId: scope.tenantId,
        threadId: threadId ?? null,
        entry: {
          id: `tr-${callId ?? randomUUID()}`,
          role: "tool_result",
          text: `Erreur: ${message}`,
          toolName: name,
          callId,
          output: `Erreur: ${message}`,
          status: "error",
          timestamp: Date.now(),
        },
      });
    }

    return NextResponse.json(
      { error: "tool_failed", output: `Erreur: ${message}`, status: "error" },
      { status: 500 },
    );
  }
}
