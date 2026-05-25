/**
 * GET /api/reports/[reportId]/versions
 *
 * Liste les versions d'un report (métadonnées seulement, sans render_snapshot).
 * Triées version_number DESC.
 *
 * Query params :
 *   limit  (optionnel, défaut 50, max 200)
 */

import { type NextRequest, NextResponse } from "next/server";
import { listReportVersionsQuerySchema } from "@/lib/contracts/reports";
import { requireScope } from "@/lib/platform/auth/scope";
import { resolveAssetTenant } from "@/lib/reports/access";
import { listVersions } from "@/lib/reports/versions/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { reportId } = await ctx.params;
  const { scope, error } = await requireScope({
    context: `GET /api/reports/${reportId}/versions`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const url = new URL(req.url);
  const qParsed = listReportVersionsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? 50,
  });
  if (!qParsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: qParsed.error.issues },
      { status: 400 },
    );
  }
  const limit = qParsed.data.limit;

  const resolved = await resolveAssetTenant(reportId, scope.userId, scope.tenantId);
  if ("error" in resolved) {
    const status = resolved.error === "not_found" ? 404 : 503;
    return NextResponse.json({ error: resolved.error }, { status });
  }

  const versions = await listVersions({
    assetId: reportId,
    tenantId: resolved.tenantId,
    limit,
  });

  return NextResponse.json({ versions });
}
