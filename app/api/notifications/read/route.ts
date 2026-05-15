/**
 * POST /api/notifications/read — Marque une notification comme lue.
 *
 * Body : { id: string }
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markRead } from "@/lib/notifications/in-app";
import { requireScope } from "@/lib/platform/auth/scope";
import { getServerSupabase } from "@/lib/platform/db/supabase";

const notificationReadSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "notifications/read POST" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = notificationReadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await markRead(db, { notificationId: parsed.data.id, tenantId: scope.tenantId });
  return NextResponse.json({ ok: true });
}
