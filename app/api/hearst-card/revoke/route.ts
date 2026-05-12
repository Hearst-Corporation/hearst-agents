/**
 * POST /api/hearst-card/revoke
 *
 * F-112 : Révocation anticipée d'un token de partage Hearst Card.
 * Hash le token en SHA-256, l'insère dans hearst_card_revoked.
 * Seul le propriétaire du token (uid dans le payload) ou un admin peut révoquer.
 *
 * Body : { token: string }
 */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { verifyCardToken } from "@/lib/cockpit/monthly-card-token";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { scope, error } = await requireScope({ context: "POST /api/hearst-card/revoke" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  let token: string;
  try {
    const body = (await req.json()) as { token?: unknown };
    if (!body.token || typeof body.token !== "string") {
      return NextResponse.json({ error: "token_required" }, { status: 400 });
    }
    token = body.token;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Vérifier que le token est valide et appartient à l'appelant
  const verify = verifyCardToken(token);
  if (!verify.ok) {
    // Token déjà expiré ou malformé → pas besoin de révoquer
    if (verify.reason === "expired" || verify.reason === "malformed") {
      return NextResponse.json({ revoked: false, reason: verify.reason }, { status: 200 });
    }
    return NextResponse.json({ error: verify.reason }, { status: 400 });
  }

  // Seul le propriétaire de la card peut révoquer son token
  if (verify.payload.uid !== scope.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { error: dbError } = await sb
    .from("hearst_card_revoked")
    .upsert({ token_hash: tokenHash }, { onConflict: "token_hash" });

  if (dbError) {
    console.error("[hearst-card/revoke] DB error:", dbError.message);
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }

  return NextResponse.json({ revoked: true, token_hash: tokenHash });
}

/**
 * DELETE /api/hearst-card/revoke — cleanup des entrées expirées (> 8j).
 * Appelé par un cron (Inngest ou Vercel Cron). Protégé par CRON_SECRET.
 */
export async function DELETE(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  // Supprime les entrées dont revoked_at < now() - 8 jours
  // (TTL naturelle du token = 7j, 8j = marge d'un jour après expiration)
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const { error: dbError, count } = await sb
    .from("hearst_card_revoked")
    .delete({ count: "exact" })
    .lt("revoked_at", cutoff);

  if (dbError) {
    console.error("[hearst-card/revoke] Cleanup error:", dbError.message);
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }

  return NextResponse.json({ cleaned: count ?? 0 });
}
