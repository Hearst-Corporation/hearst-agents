/**
 * POST /api/v2/voice/transcripts/append
 *
 * Append une entry user/assistant au transcript persisté. Les tool_call /
 * tool_result sont persistés directement par /api/v2/voice/tool-call —
 * cette route sert uniquement aux entries de dialogue.
 *
 * Body : {
 *   sessionId: string,
 *   threadId?: string,
 *   entry: { id, role: "user"|"assistant", text, timestamp }
 * }
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/platform/auth/scope";
import { appendTranscriptEntry, type VoiceTranscriptEntry } from "@/lib/voice/transcript-store";

const transcriptEntrySchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant", "tool_call", "tool_result"]),
  text: z.string().max(10_000),
  timestamp: z.number().int().optional(),
  toolName: z.string().max(200).optional(),
  callId: z.string().max(200).optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  output: z.string().max(10_000).optional(),
  status: z.enum(["pending", "success", "error"]).optional(),
  providerId: z.string().max(200).optional(),
  stageRequest: z.unknown().optional(),
});

const transcriptsAppendBodySchema = z
  .object({
    sessionId: z.string().min(1).max(200),
    threadId: z.string().max(200).optional(),
    entry: transcriptEntrySchema,
  })
  .strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/voice/transcripts/append",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = transcriptsAppendBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sessionId, threadId, entry } = parsed.data;

  const ok = await appendTranscriptEntry({
    sessionId,
    userId: scope.userId,
    tenantId: scope.tenantId,
    threadId: threadId ?? null,
    entry: entry as VoiceTranscriptEntry,
  });

  return NextResponse.json({ ok });
}
