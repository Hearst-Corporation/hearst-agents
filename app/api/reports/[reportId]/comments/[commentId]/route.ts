/**
 * DELETE /api/reports/[reportId]/comments/[commentId]
 *
 * Supprime un commentaire. Strict ownership : seul l'auteur peut supprimer
 * (cf `lib/reports/comments/store.ts` — RLS aligné).
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { resolveAssetTenant } from "@/lib/reports/access";
import { deleteComment } from "@/lib/reports/comments/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ reportId: string; commentId: string }>;
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { reportId, commentId } = await ctx.params;
  const { scope, error } = await requireScope({
    context: `DELETE /api/reports/${reportId}/comments/${commentId}`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Résoudre le tenantId effectif via l'asset (mêmes règles que GET/POST).
  // resolveAssetTenant vérifie provenance.userId === callerUserId → retourne
  // not_found (404) sur cross-user, jamais 403 (leak d'existence).
  const resolved = await resolveAssetTenant(reportId, scope.userId, scope.tenantId);
  if ("error" in resolved) {
    const status = resolved.error === "not_found" ? 404 : 503;
    return NextResponse.json({ error: resolved.error }, { status });
  }
  const { tenantId } = resolved;

  const outcome = await deleteComment({
    commentId,
    userId: scope.userId,
    tenantId,
  });
  if (!outcome.ok) {
    const status =
      outcome.reason === "not_found" ? 404 : outcome.reason === "supabase_unavailable" ? 503 : 500;
    return NextResponse.json({ error: outcome.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
