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
import { z } from "zod";
import { verifyCardToken } from "@/lib/cockpit/monthly-card-token";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

const log = withRoute("POST|DELETE /api/hearst-card/revoke");

export const runtime = "nodejs";

const revokeBodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: Request) {
  const { scope, error } = await requireScope({ context: "POST /api/hearst-card/revoke" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const parsedBody = await parseJsonBody(req, revokeBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { token } = parsedBody.data;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (sb as any)
    .from("hearst_card_revoked")
    .upsert({ token_hash: tokenHash }, { onConflict: "token_hash" });

  if (dbError) {
    log.error({ err: redactedError(dbError) }, "card_revoke_db_failed");
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError, count } = await (sb as any)
    .from("hearst_card_revoked")
    .delete({ count: "exact" })
    .lt("revoked_at", cutoff);

  if (dbError) {
    log.error({ err: redactedError(dbError) }, "card_revoke_cleanup_failed");
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }

  return NextResponse.json({ cleaned: count ?? 0 });
}
