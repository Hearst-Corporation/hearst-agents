/**
 * GET  /api/user/theme — retourne la préférence thème de l'utilisateur courant
 * POST /api/user/theme { slug } — upsert la préférence
 *
 * Source de vérité : table `user_theme_preferences` (RLS sur auth.uid()).
 * Fallback : si pas authentifié, slug = "default" (200, pas 401 — l'API est
 * appelée au boot par tous les visiteurs via ThemeHydrator).
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/platform/auth/scope";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { safeErrorResponse } from "@/lib/platform/errors/safe-response";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { DEFAULT_THEME, isKnownTheme } from "@/lib/themes";

const bodySchema = z.object({
  slug: z.string().min(1).max(80),
});

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/user/theme" });
  if (error || !scope) {
    return NextResponse.json({ slug: DEFAULT_THEME }, { status: 200 });
  }

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ slug: DEFAULT_THEME }, { status: 200 });
  }

  const { data, error: dbError } = await db
    .from("user_theme_preferences")
    .select("theme_slug")
    .eq("user_id", scope.userId)
    .maybeSingle();

  if (dbError || !data?.theme_slug) {
    return NextResponse.json({ slug: DEFAULT_THEME }, { status: 200 });
  }

  return NextResponse.json({ slug: data.theme_slug }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "POST /api/user/theme" });
  if (error || !scope) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { slug } = parsed.data;

  if (!isKnownTheme(slug)) {
    return NextResponse.json({ error: "unknown_theme" }, { status: 400 });
  }

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { error: upsertError } = await db
    .from("user_theme_preferences")
    .upsert(
      { user_id: scope.userId, theme_slug: slug, selected_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return safeErrorResponse(new Error(upsertError.message), {
      route: "POST /api/user/theme",
      scope: { userId: scope.userId },
    });
  }

  const res = NextResponse.json({ ok: true, slug }, { status: 200 });
  res.cookies.set("theme", slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
