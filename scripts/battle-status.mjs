#!/usr/bin/env node
/**
 * battle-status.mjs — Status report du Battle Plan sécurité.
 *
 * Usage:
 *   node scripts/battle-status.mjs              → vue globale
 *   node scripts/battle-status.mjs --batch=B1.2 → détail d'un batch
 *   node scripts/battle-status.mjs --finding=F-001 → détail d'un finding
 *   node scripts/battle-status.mjs --json        → output JSON brut
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AUDIT_DIR = join(ROOT, "docs/audits/2026-05-10-security");
const PLAN_PATH = join(AUDIT_DIR, "BATTLE-PLAN.json");
const FINDINGS_PATH = join(AUDIT_DIR, "findings.json");

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--(\w+)(?:=(.+))?$/);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

function loadJson(p) {
  if (!existsSync(p)) {
    console.error(`❌ ${p} not found`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf-8"));
}

function findBatch(plan, batchId) {
  for (const phase of plan.phases || []) {
    for (const batch of phase.batches || []) {
      if (batch.id === batchId) return { phase, batch };
    }
  }
  return null;
}

function statusEmoji(s) {
  return (
    {
      pending: "⏳",
      in_progress: "🔵",
      blocked: "🔴",
      deferred: "💤",
      done: "✅",
      closed: "✅",
      wont_fix: "⏭",
    }[s] ?? "❓"
  );
}

function severityEmoji(s) {
  return { P0: "🔥", P1: "🟧", P2: "🟨" }[s] ?? "·";
}

function main() {
  const args = parseArgs(process.argv);
  const plan = loadJson(PLAN_PATH);
  const findings = loadJson(FINDINGS_PATH);
  const findingsById = Object.fromEntries((findings.findings || []).map((f) => [f.id, f]));

  // --finding=F-XXX → details
  if (args.finding) {
    const f = findingsById[args.finding];
    if (!f) {
      console.error(`❌ Finding ${args.finding} not found`);
      process.exit(1);
    }
    if (args.json) {
      console.log(JSON.stringify(f, null, 2));
      return;
    }
    console.log(`${severityEmoji(f.severity)} ${f.id} — ${f.title}`);
    console.log(
      `  Severity: ${f.severity} | Status: ${statusEmoji(f.status)} ${f.status} | Confidence: ${f.confidence}`,
    );
    console.log(`  Sources: ${(f.sources || []).join(", ")} | Convergence: ${f.convergence}`);
    console.log(`  Category: ${f.category}`);
    console.log(`  Effort: ${f.estimated_effort ?? "—"}`);
    if (f.evidence?.length) {
      console.log("  Evidence:");
      for (const e of f.evidence) {
        console.log(`    - ${e.file}${e.line ? `:${e.line}` : e.lines ? `:${e.lines}` : ""}`);
      }
    }
    if (f.attack_scenario) console.log(`  Attack: ${f.attack_scenario}`);
    if (f.fix_minimal) console.log(`  Fix minimal: ${f.fix_minimal}`);
    return;
  }

  // --batch=B1.2 → details
  if (args.batch) {
    const found = findBatch(plan, args.batch);
    if (!found) {
      console.error(`❌ Batch ${args.batch} not found`);
      process.exit(1);
    }
    const { phase, batch } = found;
    if (args.json) {
      console.log(JSON.stringify({ phase: phase.id, batch }, null, 2));
      return;
    }
    console.log(`${statusEmoji(batch.status)} ${batch.id} — ${batch.title}`);
    console.log(`  Phase: ${phase.id} ${phase.title}`);
    console.log(`  Status: ${batch.status} | Effort: ${batch.estimated_effort ?? "—"}`);
    if (batch.sub_agent_recommended) console.log(`  Sub-agent: ${batch.sub_agent_recommended}`);
    if (batch.pre_conditions?.length) {
      console.log(`  Pre-conditions:`);
      for (const pc of batch.pre_conditions) {
        const dep = findBatch(plan, pc);
        const depStatus = dep ? dep.batch.status : "unknown";
        const ok = depStatus === "done" ? "✅" : "❌";
        console.log(`    ${ok} ${pc} (${depStatus})`);
      }
    }
    if (batch.findings?.length) {
      console.log(`  Findings (${batch.findings.length}):`);
      for (const fid of batch.findings) {
        const f = findingsById[fid];
        if (f) {
          console.log(
            `    ${statusEmoji(f.status)} ${severityEmoji(f.severity)} ${f.id} — ${f.title.slice(0, 80)}`,
          );
        } else {
          console.log(`    ❓ ${fid} (not found)`);
        }
      }
    }
    if (batch.validation?.length) {
      console.log(`  Validation criteria:`);
      for (const v of batch.validation) console.log(`    - ${v}`);
    }
    if (batch.blast_if_skipped) {
      console.log(`  ⚠ BLAST IF SKIPPED: ${batch.blast_if_skipped}`);
    }
    return;
  }

  // Vue globale
  const allBatches = (plan.phases || []).flatMap((p) =>
    (p.batches || []).map((b) => ({ ...b, phase_id: p.id, phase_title: p.title })),
  );
  const counts = allBatches.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          total: allBatches.length,
          counts,
          phases: (plan.phases || []).map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            batches: p.batches.map((b) => ({ id: b.id, title: b.title, status: b.status })),
          })),
          findings_summary: findings.summary,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n🎯 ${plan.audit_id} — Battle Plan Status\n`);
  console.log(`Objective: ${plan.objective}`);
  console.log(`Effort total: ${plan.estimated_total_effort}\n`);
  console.log(`Total batchs: ${allBatches.length}`);
  console.log(`  ✅ done: ${counts.done || 0}`);
  console.log(`  🔵 in_progress: ${counts.in_progress || 0}`);
  console.log(`  ⏳ pending: ${counts.pending || 0}`);
  console.log(`  🔴 blocked: ${counts.blocked || 0}`);
  console.log(`  💤 deferred: ${counts.deferred || 0}\n`);

  console.log("Phases:");
  for (const phase of plan.phases || []) {
    const phaseDone = phase.batches.filter((b) => b.status === "done").length;
    const phaseTotal = phase.batches.length;
    const pct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
    const bar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));
    console.log(
      `  ${statusEmoji(phase.status)} ${phase.id.padEnd(8)} [${bar}] ${pct}% ${phaseDone}/${phaseTotal} — ${phase.title.replace(/^PHASE \d+ — /, "")}`,
    );
  }

  console.log(
    `\nFindings : ${findings.summary?.total_consolidated || 0} totaux (${findings.summary?.by_severity?.P0 || 0} P0 / ${findings.summary?.by_severity?.P1 || 0} P1 / ${findings.summary?.by_severity?.P2 || 0} P2)`,
  );
  console.log(`HTML : open docs/audits/2026-05-10-security/BATTLE-PLAN.html`);
  console.log(`Next batch : node scripts/battle-next.mjs`);
}

main();
