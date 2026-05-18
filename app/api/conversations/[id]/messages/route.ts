import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error } = await requireScope({ context: "GET /api/conversations/[id]/messages" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  const db = requireServerSupabase();

  // Vérifier que la conversation appartient à cet utilisateur
  const { count, error: countError } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", id)
    .eq("user_id", scope.userId);

  if (countError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (count === null || count === 0) {
    // Aucun message pour cet user dans cette conversation
    // 0 → soit conversation inexistante (404), soit accès refusé (403)
    // On distingue en vérifiant si la conversation existe pour un autre user
    const { count: globalCount, error: globalErr } = await db
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", id);

    if (globalErr) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    if (globalCount && globalCount > 0) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Fetch les messages, filtrer les rôles 'tool', limiter le contenu
  const { data: rows, error: fetchError } = await db
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .eq("user_id", scope.userId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const messages = (rows ?? []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content.slice(0, 5000),
    createdAt: row.created_at,
  }));

  return NextResponse.json({ messages });
}
