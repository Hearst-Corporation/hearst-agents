/**
 * GET /api/v2/browser — Liste les sessions Browserbase connues du user courant.
 *
 * Source canonique : table `browser_sessions`, alimentée par
 * POST /api/v2/browser/start. Les URLs live restent exposées par
 * GET /api/v2/browser/[id] quand le frontend ouvre une session précise.
 */

import { NextResponse } from "next/server";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BrowserSessionRow {
  session_id: string;
  created_at: string;
  last_seen_at: string | null;
}

export const GET = withScope("GET /api/v2/browser", async (_req, { scope }) => {
  try {
    const sb = requireServerSupabase();
    const { data, error } = await sb
      .from("browser_sessions")
      .select("session_id, created_at, last_seen_at")
      .eq("user_id", scope.userId)
      .eq("tenant_id", scope.tenantId)
      .order("last_seen_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[BrowserSessions] list failed", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "browser_sessions_list_failed" }, { status: 500 });
    }

    const sessions = ((data ?? []) as BrowserSessionRow[]).map((session) => ({
      id: session.session_id,
      sessionId: session.session_id,
      status: "tracked",
      createdAt: session.created_at,
      started_at: session.created_at,
      last_seen_at: session.last_seen_at,
    }));

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[BrowserSessions] uncaught list error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
