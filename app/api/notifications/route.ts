/**
 * GET /api/notifications — Liste les notifications in-app du tenant courant.
 *
 * Query params :
 *   unreadOnly=true  → seulement les non-lues
 *   limit=N          → max N résultats (défaut 50, max 100)
 */

import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/notifications/in-app";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { withScope } from "@/lib/platform/http/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withScope("notifications GET", async (req, { scope }) => {
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

  const notifications = await listNotifications(db, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    unreadOnly,
    limit,
  });

  return NextResponse.json(notifications);
});
