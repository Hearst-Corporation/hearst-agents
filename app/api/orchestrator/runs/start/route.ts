import { NextResponse } from "next/server";
import { startRun } from "@/lib/hom/master";
import { ALL_AGENTS } from "@/lib/hom/types";
import { requireAdmin, isError } from "@/app/api/admin/_helpers";
import { startRunSchema } from "@/lib/contracts/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireAdmin("POST /api/orchestrator/runs/start", { resource: "settings", action: "update" });
  if (isError(guard)) return guard;

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    /* empty body OK — schema laissera les champs optionnels à undefined */
  }

  const parsed = startRunSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { scope: scopeInput, notes } = parsed.data;
  const scope = scopeInput ?? ALL_AGENTS;

  const result = await startRun({
    triggeredBy: "admin-ui",
    triggerKind: "manual",
    scope,
    notes,
  });

  return NextResponse.json({
    ok: true,
    run_id: result.runId,
    decision: result.decision,
    duration_ms: result.durationMs,
    snapshot_path: result.reportPath,
  });
}
