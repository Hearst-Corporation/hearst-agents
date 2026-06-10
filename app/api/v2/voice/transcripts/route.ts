/**
 * GET /api/v2/voice/transcripts — Liste les transcripts voice du user courant.
 *
 * Source canonique : table `voice_transcripts`, alimentée par
 * POST /api/v2/voice/transcripts/append et /api/v2/voice/tool-call.
 */

import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VoiceTranscriptEntry {
  timestamp?: number;
}

interface VoiceTranscriptRow {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  thread_id: string | null;
  entries: unknown;
}

function durationSeconds(row: VoiceTranscriptRow): number | undefined {
  if (row.ended_at) {
    const started = new Date(row.started_at).getTime();
    const ended = new Date(row.ended_at).getTime();
    if (Number.isFinite(started) && Number.isFinite(ended) && ended >= started) {
      return Math.round((ended - started) / 1000);
    }
  }

  const entries = Array.isArray(row.entries) ? (row.entries as VoiceTranscriptEntry[]) : [];
  const timestamps = entries
    .map((entry) => entry.timestamp)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (timestamps.length < 2) return undefined;

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return Math.max(0, Math.round((max - min) / 1000));
}

export async function GET() {
  const { scope, error: scopeError } = await requireScope({
    context: "GET /api/v2/voice/transcripts",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  try {
    const sb = requireServerSupabase();
    const { data, error } = await sb
      .from("voice_transcripts")
      .select("id, session_id, started_at, ended_at, thread_id, entries")
      .eq("user_id", scope.userId)
      .eq("tenant_id", scope.tenantId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[VoiceTranscripts] list failed", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "voice_transcripts_list_failed" }, { status: 500 });
    }

    const transcripts = ((data ?? []) as VoiceTranscriptRow[]).map((row) => ({
      id: row.session_id,
      sessionId: row.session_id,
      title: `Transcript ${row.session_id.slice(0, 8)}`,
      createdAt: row.started_at,
      created_at: row.started_at,
      durationSeconds: durationSeconds(row),
      duration_seconds: durationSeconds(row),
      threadId: row.thread_id,
    }));

    return NextResponse.json({ transcripts });
  } catch (err) {
    console.error("[VoiceTranscripts] uncaught list error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
