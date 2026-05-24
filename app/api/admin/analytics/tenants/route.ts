/**
 * GET /api/admin/analytics/tenants
 *
 * Top tenants par usage (cost USD) + drill-down sur un tenant donné via
 * `?tenantId=xxx`.
 *
 * Auth : admin (resource=metrics, action=read).
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  type DateRange,
  defaultDateRange,
  getTenantUsage,
  getTopTenants,
} from "@/lib/admin/usage/aggregate";
import { safeErrorResponse } from "@/lib/platform/errors/safe-response";
import { isError, requireAdmin } from "../../_helpers";

export const dynamic = "force-dynamic";

function parseRange(req: NextRequest): DateRange {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (start && end) {
    const sIso = new Date(start).toISOString();
    const eIso = new Date(end).toISOString();
    return { start: sIso, end: eIso };
  }
  return defaultDateRange();
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin("GET /api/admin/analytics/tenants", {
    resource: "metrics",
    action: "read",
  });
  if (isError(guard)) return guard;

  const url = new URL(req.url);
  const range = parseRange(req);
  const kind = url.searchParams.get("kind");
  const tenantId = url.searchParams.get("tenantId");
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(
    Math.max(typeof limitRaw === "string" ? parseInt(limitRaw, 10) || 10 : 10, 1),
    50,
  );

  try {
    if (tenantId) {
      const detail = await getTenantUsage(tenantId, range, kind);
      return NextResponse.json({ range, tenant: detail });
    }
    const top = await getTopTenants(range, limit, kind);
    return NextResponse.json({ range, kind: kind ?? null, top });
  } catch (err) {
    return safeErrorResponse(err, { route: "GET /api/admin/analytics/tenants" });
  }
}
