import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { loadCC } from "@/lib/hom/cc-state";
import { loadDriftLog } from "@/lib/hom/drift";
import { quickHealthCheck } from "@/lib/hom/master";
import { listQuarantined } from "@/lib/hom/quarantine";
import { listRuns } from "@/lib/hom/registry";
import { latestScores, loadHistory } from "@/lib/hom/trust";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/overview", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const [health, scores, history, drift, cc, runs, quarantined] = await Promise.all([
    quickHealthCheck(),
    latestScores(),
    loadHistory(),
    loadDriftLog(),
    loadCC(),
    listRuns(),
    listQuarantined(),
  ]);

  const recentRuns = runs.slice(0, 5);
  const lastTrust = history.at(-1);

  return NextResponse.json({
    ok: true,
    health,
    trust: scores,
    trust_delta: lastTrust?.delta ?? {},
    drift_count: drift.length,
    cc: {
      phase: cc.phase,
      run_id: cc.run_id,
      degraded: cc.degraded_mode,
      heartbeat: cc.master_heartbeat,
    },
    runs_recent: recentRuns,
    runs_total: runs.length,
    quarantined: quarantined.length,
    blockers: cc.blockers,
  });
}
