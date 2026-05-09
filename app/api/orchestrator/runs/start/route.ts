import { NextResponse } from "next/server";
import { startRun } from "@/lib/hom/master";
import { ALL_AGENTS, type AgentId } from "@/lib/hom/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { scope?: string[]; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  const scope = (body.scope ?? ALL_AGENTS).filter((s): s is AgentId =>
    (ALL_AGENTS as string[]).includes(s),
  );

  const result = await startRun({
    triggeredBy: "admin-ui",
    triggerKind: "manual",
    scope,
    notes: body.notes,
  });

  return NextResponse.json({
    ok: true,
    run_id: result.runId,
    decision: result.decision,
    duration_ms: result.durationMs,
    snapshot_path: result.reportPath,
  });
}
