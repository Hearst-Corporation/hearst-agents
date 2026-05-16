import { NextResponse } from "next/server";
import { getAllRuns } from "@/lib/engine/runtime/runs/store";
import { getRuns } from "@/lib/engine/runtime/state/adapter";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withScope("GET /api/v2/runs", async (req, { scope }) => {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 200);
    const missionId = req.nextUrl.searchParams.get("mission_id") ?? undefined;

    // Canonical source: Supabase persistence — scoped to current user
    const persisted = await getRuns({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      limit,
      missionId,
    });

    if (persisted.length > 0) {
      const runs = persisted.map((r) => ({
        id: r.id,
        input: r.input.slice(0, 200),
        surface: r.surface,
        executionMode: r.executionMode,
        agentId: r.agentId,
        backend: r.backend,
        missionId: r.missionId,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        assetCount: r.assets.length,
        metrics: r.metrics,
      }));

      return NextResponse.json({ runs });
    }

    // Fallback: in-memory store — filtered by userId (+ missionId si fourni)
    console.warn("[v2/runs] Persistent store empty — falling back to in-memory");
    const memRuns = getAllRuns(limit)
      .filter((r) => r.userId === scope.userId && (!missionId || r.missionId === missionId))
      .map((r) => ({
        id: r.id,
        input: r.input.slice(0, 200),
        surface: r.surface,
        executionMode: r.executionMode,
        agentId: r.agentId,
        backend: r.backend,
        missionId: r.missionId,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        eventCount: r.events.length,
        assetCount: r.assets.length,
        metrics: r.metrics,
      }));

    return NextResponse.json({ runs: memRuns });
  } catch (e) {
    console.error("GET /api/v2/runs: uncaught", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
