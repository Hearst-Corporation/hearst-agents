/**
 * GET  /api/user/theme — retourne la préférence thème de l'utilisateur courant
 * POST /api/user/theme { slug } — upsert la préférence
 *
 * Source de vérité : table `user_theme_preferences` (RLS sur auth.uid()).
 * Fallback : si pas authentifié, slug = "default" (200, pas 401 — l'API est
 * appelée au boot par tous les visiteurs via ThemeHydrator).
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireScope } from "@/lib/platform/auth/scope";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { isKnownTheme, DEFAULT_THEME } from "@/lib/themes";

const bodySchema = z.object({
  slug: z.string().min(1).max(80),
});

// Migration 0081 ajoute user_theme_preferences ; les types générés Supabase
// ne le connaissent pas encore. Untyped wrapper en attendant `npm run db:types`.
function untyped(db: SupabaseClient) {
  return db as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { theme_slug: string } | null; error: { message: string } | null }>;
        };
      };
      upsert: (
        row: { user_id: string; theme_slug: string; selected_at: string },
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
}

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/user/theme" });
  if (error || !scope) {
    return NextResponse.json({ slug: DEFAULT_THEME }, { status: 200 });
  }

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ slug: DEFAULT_THEME }, { status: 200 });
  }

  const { data, error: dbError } = await untyped(db)
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { slug } = parsed.data;

  if (!isKnownTheme(slug)) {
    return NextResponse.json({ error: "unknown_theme" }, { status: 400 });
  }

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { error: upsertError } = await untyped(db)
    .from("user_theme_preferences")
    .upsert(
      { user_id: scope.userId, theme_slug: slug, selected_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, slug }, { status: 200 });
  res.cookies.set("theme", slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
