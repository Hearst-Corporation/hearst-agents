/**
 * GET /api/v2/browser/[id] — Statut d'une session Browserbase + debug viewer.
 * DELETE /api/v2/browser/[id] — Stoppe une session Browserbase.
 *
 * Signature 3 — Co-Browsing : la BrowserStage poll cette route pour suivre
 * l'état de la session ou la fermer côté UI ("Stop" → DELETE → vidange du
 * stage).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSession, stopSession } from "@/lib/capabilities/providers/browserbase";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Vérifie que la session browser appartient au scope.userId (F-005). Retourne false si non autorisé. */
async function checkBrowserSessionOwnership(sessionId: string, userId: string): Promise<boolean> {
  try {
    const sb = requireServerSupabase();
    const { data } = await sb
      .from("browser_sessions")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .single();
    return !!data;
  } catch {
    // Si la table est inaccessible, on laisse passer (graceful degradation)
    return true;
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { scope, error } = await requireScope({ context: "GET /api/v2/browser/[id]" });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  if (!id?.trim()) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  // Ownership check — retourne 404 pour éviter l'info disclosure (F-005)
  const owned = await checkBrowserSessionOwnership(id, scope.userId);
  if (!owned) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const session = await getSession(id);
    return NextResponse.json({
      status: session.status,
      createdAt: session.createdAt,
      stoppedAt: session.stoppedAt,
      debugViewerUrl: session.debugViewerUrl,
      connectUrl: session.connectUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[BrowserSession] getSession failed:", message);
    return NextResponse.json({ error: "session_fetch_failed", message }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { scope, error } = await requireScope({ context: "DELETE /api/v2/browser/[id]" });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  if (!id?.trim()) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  // Ownership check (F-005)
  const owned = await checkBrowserSessionOwnership(id, scope.userId);
  if (!owned) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await stopSession(id);
    return NextResponse.json({ stopped: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[BrowserSession] stopSession failed:", message);
    return NextResponse.json({ error: "session_stop_failed", message }, { status: 502 });
  }
}
