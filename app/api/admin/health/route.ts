/**
 * GET /api/admin/health — system health check (RBAC: read settings)
 */

import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/admin/health";
import { withAdmin } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withAdmin(
  "GET /api/admin/health",
  { resource: "settings", action: "read" },
  async (_req, { db }) => {
    try {
      const health = await getSystemHealth(db);
      const status = health.status === "healthy" ? 200 : 503;
      return NextResponse.json({ health }, { status });
    } catch (e) {
      console.error("[Admin API] GET /health error:", e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
