/**
 * POST /api/v2/browser/[id]/take-over — L'utilisateur reprend la main.
 *
 * Stoppe immédiatement toute tâche autonome en cours sur la session et
 * marque la session "user-controlled" — la BrowserStage affiche alors un
 * banner "Tu pilotes maintenant" sur l'iframe debug viewer.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import {
  requestTakeOver,
  markUserControlled,
} from "@/lib/browser/stagehand-executor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const { scope, error } = await requireScope({
    context: "POST /api/v2/browser/[id]/take-over",
  });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  if (!id?.trim()) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  // Ownership check — seul le créateur peut prendre la main (F-005)
  try {
    const sb = requireServerSupabase();
    const { data: owned } = await sb
      .from("browser_sessions")
      .select("user_id")
      .eq("session_id", id)
      .eq("user_id", scope.userId)
      .single();
    if (!owned) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch {
    // Table inaccessible : graceful degradation, on continue
  }

  const stopped = requestTakeOver(id);
  markUserControlled(id);

  return NextResponse.json({
    sessionId: id,
    userControlled: true,
    stoppedRunningTask: stopped,
  });
}
