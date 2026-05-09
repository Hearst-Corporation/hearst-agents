#!/usr/bin/env -S npx tsx
/**
 * CLI runner HOM — déclenche un run depuis le terminal.
 * Usage : npx tsx scripts/hom-run.ts [--scope architecture,design-system,qa]
 */
import { startRun } from "../lib/hom/master";
import type { AgentId } from "../lib/hom/types";
import { ALL_AGENTS } from "../lib/hom/types";

function parseArgs(): { scope: AgentId[]; notes?: string } {
  const out: { scope: AgentId[]; notes?: string } = { scope: [...ALL_AGENTS] };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--scope") {
      const next = process.argv[++i];
      if (!next) continue;
      const ids = next.split(",").map((s) => s.trim()) as AgentId[];
      out.scope = ids.filter((id) => ALL_AGENTS.includes(id));
    } else if (arg === "--notes") {
      out.notes = process.argv[++i];
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const triggeredBy = process.env.USER ?? "cli";
  console.log(`[hom] starting run | scope=${args.scope.join(",")} | by=${triggeredBy}`);
  const start = Date.now();
  const result = await startRun({
    triggeredBy,
    triggerKind: "manual",
    scope: args.scope,
    notes: args.notes,
  });
  const ms = Date.now() - start;
  console.log(`[hom] run done in ${ms}ms`);
  console.log(`[hom] run_id   : ${result.runId}`);
  console.log(`[hom] decision : ${result.decision}`);
  if (result.reportPath) {
    console.log(`[hom] snapshot : ${result.reportPath}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[hom] FAILED:", err);
  process.exit(1);
});
