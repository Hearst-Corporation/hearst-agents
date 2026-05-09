import { NextResponse } from "next/server";
import { latestScores } from "@/lib/hom/trust";
import { evaluateReleaseGates } from "@/lib/hom/policy";
import { loadDriftLog } from "@/lib/hom/drift";
import { listRuns } from "@/lib/hom/registry";
import { readJson } from "@/lib/hom/fs-utils";
import { HOM } from "@/lib/hom/paths";
import type { RunDecisionFile } from "@/lib/hom/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [scores, drift, runs] = await Promise.all([
    latestScores(),
    loadDriftLog(),
    listRuns(),
  ]);

  // Récupère decision du dernier run pour évaluer hasCritical
  const lastRun = runs[0];
  let lastDecision: RunDecisionFile | null = null;
  if (lastRun) {
    lastDecision = await readJson<RunDecisionFile>(HOM.runDecision(lastRun.run_id));
  }
  const hasCritical = (lastDecision?.severity_stack.critical ?? 0) > 0;
  const hasHighDriftUnresolved = drift.filter((d) => d.severity === "high").length > 0;

  const gates = await evaluateReleaseGates({
    trustScores: { ...scores },
    hasCritical,
    hasHighDriftUnresolved,
    manifestSynced: true,
    humanSignaturePresent: false,
    acceptedDebtValid: true,
  });

  const blocking = gates.filter((g) => g.blocking && !g.passed);
  return NextResponse.json({
    canRelease: blocking.length === 0,
    gates,
    trust: scores,
    last_run: lastRun ?? null,
    last_decision: lastDecision?.decision ?? null,
  });
}
