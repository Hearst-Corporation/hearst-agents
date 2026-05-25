/**
 * /api/reports/[reportId]/comments
 *
 *   GET  → liste des commentaires sur un report (asset kind=report)
 *   POST → ajoute un commentaire
 *
 * `[reportId]` désigne l'`asset.id` (text). On vérifie que l'asset existe et
 * appartient au tenant du caller (le tenant peut être absent en dev — on
 * s'aligne sur le pattern `requireScope`).
 */

import { type NextRequest, NextResponse } from "next/server";
import { createReportCommentSchema } from "@/lib/contracts/reports";
import { requireScope } from "@/lib/platform/auth/scope";
import { resolveAssetTenant } from "@/lib/reports/access";
import { addComment, listComments } from "@/lib/reports/comments/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { reportId } = await ctx.params;
  const { scope, error } = await requireScope({
    context: `GET /api/reports/${reportId}/comments`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const resolved = await resolveAssetTenant(reportId, scope.userId, scope.tenantId);
  if ("error" in resolved) {
    const status = resolved.error === "not_found" ? 404 : 503;
    return NextResponse.json({ error: resolved.error }, { status });
  }

  const comments = await listComments({
    assetId: reportId,
    tenantId: resolved.tenantId,
    limit: 100,
  });

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { reportId } = await ctx.params;
  const { scope, error } = await requireScope({
    context: `POST /api/reports/${reportId}/comments`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = createReportCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const resolved = await resolveAssetTenant(reportId, scope.userId, scope.tenantId);
  if ("error" in resolved) {
    const status = resolved.error === "not_found" ? 404 : 503;
    return NextResponse.json({ error: resolved.error }, { status });
  }

  const created = await addComment({
    assetId: reportId,
    tenantId: resolved.tenantId,
    userId: scope.userId,
    blockRef: parsed.data.blockRef ?? null,
    body: parsed.data.body,
  });
  if (!created) {
    return NextResponse.json({ error: "persistence_failed" }, { status: 500 });
  }
  return NextResponse.json({ comment: created }, { status: 201 });
}
