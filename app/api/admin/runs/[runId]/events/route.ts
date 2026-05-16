import { NextResponse } from "next/server";
import { getPersistedRunEvents } from "@/lib/engine/runtime/timeline/persist";
import { withAdmin } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withAdmin<{ runId: string }>(
  "GET /api/admin/runs/[runId]/events",
  { resource: "runs", action: "read" },
  async (_req, { params }) => {
    const { runId } = params;
    if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

    try {
      const events = await getPersistedRunEvents({ runId });
      return NextResponse.json({ events });
    } catch (e) {
      console.error("[Admin API] GET /runs/[runId]/events error:", e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
