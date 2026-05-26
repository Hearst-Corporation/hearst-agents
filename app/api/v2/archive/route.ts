/**
 * GET /api/v2/archive
 *
 * Retourne les threads (conversations) et assets vieux de plus de 7 jours
 * pour le tenant courant.
 */

import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ArchiveItem {
  id: string;
  title: string;
  created_at: string;
}

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/v2/archive" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const sb = requireServerSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Assets du tenant vieux de +7 jours (filtré via JSONB provenance).
  const { data: assets, error: assetsErr } = await sb
    .from("assets")
    .select("id, title, created_at")
    .filter("provenance->>tenantId", "eq", scope.tenantId)
    .lt("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  // Threads = conversations liées aux agents du tenant.
  const { data: agentRows, error: agentsErr } = await sb
    .from("agents")
    .select("id")
    .eq("tenant_id", scope.tenantId);

  let threads: ArchiveItem[] = [];
  if (agentsErr) {
    // Best-effort : si agents échoue, on retourne quand même les assets.
    threads = [];
  } else {
    const agentIds = (agentRows ?? []).map((a) => a.id);
    if (agentIds.length > 0) {
      const { data: convos, error: convosErr } = await sb
        .from("conversations")
        .select("id, title, created_at")
        .in("agent_id", agentIds)
        .lt("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!convosErr && convos) {
        threads = convos.map((c) => ({
          id: c.id,
          title: c.title ?? "Conversation",
          created_at: c.created_at,
        }));
      }
    }
  }

  if (assetsErr) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({
    threads,
    assets: (assets ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      created_at: a.created_at,
    })),
  });
}
