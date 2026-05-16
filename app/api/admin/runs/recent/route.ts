import { NextResponse } from "next/server";
import { getRuns } from "@/lib/engine/runtime/state/adapter";
import { withAdmin } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withAdmin(
  "GET /api/admin/runs/recent",
  { resource: "runs", action: "read" },
  async (req) => {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 50);
    // F-109: Never trust userId from query params — use admin's scope only.

    try {
      const runs = await getRuns({ limit });
      return NextResponse.json({ runs });
    } catch (e) {
      console.error("[Admin API] GET /runs/recent error:", e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
