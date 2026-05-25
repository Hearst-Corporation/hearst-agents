/**
 * GET /api/v2/voice/transcripts/[sessionId]
 *   → Charge un transcript persisté par sessionId.
 *
 * PATCH /api/v2/voice/transcripts/[sessionId]
 *   Body: { threadId: string }
 *   → Lie le transcript à un thread chat actif (clic "Lier au thread").
 *
 * RLS migration 0045 — l'user n'accède qu'à ses propres rows.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { getTranscript, linkTranscriptToThread } from "@/lib/voice/transcript-store";

const transcriptPatchBodySchema = z
  .object({
    threadId: z.string().min(1).max(200),
  })
  .strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const { scope, error: scopeError } = await requireScope({
    context: `GET /api/v2/voice/transcripts/${sessionId}`,
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const transcript = await getTranscript(sessionId);
  if (!transcript) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Sécurité : 404 uniforme (pas 403) pour éviter la fuite d'existence cross-user.
  if (transcript.userId !== scope.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(transcript);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const { scope, error: scopeError } = await requireScope({
    context: `PATCH /api/v2/voice/transcripts/${sessionId}`,
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const parsedPatch = await parseJsonBody(req, transcriptPatchBodySchema);
  if (!parsedPatch.ok) return parsedPatch.response;
  const { threadId } = parsedPatch.data;

  // Vérifie ownership avant link (la migration RLS le fait aussi, mais on
  // évite un round-trip update qui ne change rien).
  const existing = await getTranscript(sessionId);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Sécurité : 404 uniforme (pas 403) pour éviter la fuite d'existence cross-user.
  if (existing.userId !== scope.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ok = await linkTranscriptToThread(sessionId, threadId);
  if (!ok) {
    return NextResponse.json({ error: "link_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sessionId, threadId });
}
