/**
 * GET /api/admin/audit — list audit logs (RBAC: admin)
 */

import { NextResponse } from "next/server";
import { type AuditQueryFilters, getAuditLogs } from "@/lib/admin/audit";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { withAdmin } from "@/lib/platform/http/route-handler";

const log = withRoute("GET /api/admin/audit");

export const dynamic = "force-dynamic";

export const GET = withAdmin(
  "GET /api/admin/audit",
  { resource: "settings", action: "admin" },
  async (req, { db }) => {
    const url = new URL(req.url);

    const filters: AuditQueryFilters = {};
    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("userId");
    const severity = url.searchParams.get("severity");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    if (action) filters.action = action as AuditQueryFilters["action"];
    if (userId) filters.userId = userId;
    if (severity) filters.severity = severity as AuditQueryFilters["severity"];
    if (limit) filters.limit = parseInt(limit, 10);
    if (offset) filters.offset = parseInt(offset, 10);

    try {
      const result = await getAuditLogs(db, filters);
      return NextResponse.json({ logs: result.logs, total: result.total, filters });
    } catch (e) {
      log.error({ err: redactedError(e) }, "audit_logs_fetch_failed");
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
