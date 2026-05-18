import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { scope, error } = await requireScope({ context: "GET /api/conversations" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "30");
  const rawOffset = Number(searchParams.get("offset") ?? "0");
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 30, 100);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

  const db = requireServerSupabase();

  // 500 lignes max — agrégation JS reste légère à ce volume
  const { data: rows, error: dbError } = await db
    .from("chat_messages")
    .select("conversation_id, content, created_at")
    .eq("user_id", scope.userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (dbError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const convMap = new Map<
    string,
    { lastMessage: string; lastActivity: string; messageCount: number }
  >();

  for (const row of rows ?? []) {
    const existing = convMap.get(row.conversation_id);
    if (!existing) {
      convMap.set(row.conversation_id, {
        lastMessage: (row.content ?? "").slice(0, 100),
        lastActivity: row.created_at,
        messageCount: 1,
      });
    } else {
      existing.messageCount += 1;
    }
  }

  const conversations = Array.from(convMap.entries())
    .sort((a, b) => b[1].lastActivity.localeCompare(a[1].lastActivity))
    .slice(offset, offset + limit)
    .map(([id, data]) => ({ id, ...data }));

  return NextResponse.json({ conversations });
}
