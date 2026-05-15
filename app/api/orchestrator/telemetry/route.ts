import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { todayUtc } from "@/lib/hom/paths";
import { readDayLogs, readRunSpans } from "@/lib/hom/telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin("GET /api/orchestrator/telemetry", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const url = new URL(req.url);
  const runId = url.searchParams.get("run");
  const day = url.searchParams.get("day") ?? todayUtc();
  const agent = url.searchParams.get("agent") ?? "master";

  const [logs, spans] = await Promise.all([
    readDayLogs(day, agent),
    runId ? readRunSpans(runId) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    day,
    agent,
    logs: logs.slice(-200),
    spans: spans.slice(-200),
    total_logs: logs.length,
    total_spans: spans.length,
  });
}
