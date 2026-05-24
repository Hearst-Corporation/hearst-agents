/**
 * GET /api/admin/analytics/usage
 *
 * Renvoie l'overview cross-tenant + la time series sur la fenêtre demandée.
 *
 * Query params :
 *  - start, end : ISO datetimes (sinon dernier 30j)
 *  - granularity : day | week | month (défaut: day)
 *  - kind : filtre runs.kind (défaut: tous)
 *
 * Auth : admin (resource=metrics, action=read).
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  type DateRange,
  defaultDateRange,
  type Granularity,
  getCrossTenantOverview,
  getCrossTenantTimeSeries,
} from "@/lib/admin/usage/aggregate";
import { withRoute } from "@/lib/observability/logger";
import { safeErrorResponse } from "@/lib/platform/errors/safe-response";
import { isError, requireAdmin } from "../../_helpers";

const log = withRoute("GET /api/admin/analytics/usage");

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

function parseGranularity(req: NextRequest): Granularity {
  const url = new URL(req.url);
  const g = url.searchParams.get("granularity");
  if (g === "week" || g === "month") return g;
  return "day";
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin("GET /api/admin/analytics/usage", {
    resource: "metrics",
    action: "read",
  });
  if (isError(guard)) return guard;

  const range = parseRange(req);
  const granularity = parseGranularity(req);
  const kind = new URL(req.url).searchParams.get("kind");

  try {
    const [overview, timeSeries] = await Promise.all([
      getCrossTenantOverview(range, kind),
      getCrossTenantTimeSeries(range, granularity, kind),
    ]);
    return NextResponse.json({
      range,
      granularity,
      kind: kind ?? null,
      overview,
      timeSeries,
    });
  } catch (e) {
    return safeErrorResponse(e, { route: "GET /api/admin/analytics/usage" });
  }
}
