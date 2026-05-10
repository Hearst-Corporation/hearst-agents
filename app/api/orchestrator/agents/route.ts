import { NextResponse } from "next/server";
import { loadAllContracts } from "@/lib/hom/contracts";
import { loadCC } from "@/lib/hom/cc-state";
import { loadQuarantine } from "@/lib/hom/quarantine";
import { requireAdmin, isError } from "@/app/api/admin/_helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/agents", { resource: "settings", action: "read" });
  if (isError(guard)) return guard;
  const [contracts, cc, q] = await Promise.all([
    loadAllContracts(),
    loadCC(),
    loadQuarantine(),
  ]);
  const agents = contracts.map((c) => {
    const live = cc.agents.find((a) => a.id === c.agent_id);
    const quarantine = q.agents[c.agent_id];
    return {
      id: c.agent_id,
      contract: c,
      status: live?.status ?? "stale",
      last_run: live?.last_run ?? null,
      current_task: live?.current_task ?? null,
      heartbeat: live?.heartbeat ?? null,
      quarantine: {
        state: quarantine.state,
        anomaly_score: quarantine.anomaly_score,
        triggered_at: quarantine.triggered_at,
        triggered_run: quarantine.triggered_run,
      },
    };
  });
  return NextResponse.json({ agents });
}
