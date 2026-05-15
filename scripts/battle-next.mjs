#!/usr/bin/env node
/**
 * battle-next.mjs — Recommande le prochain batch à exécuter.
 *
 * Logique :
 * 1. Filtrer les batchs status=pending (ou in_progress)
 * 2. Garder ceux dont toutes les pre_conditions sont status=done
 * 3. Exclure phase status=deferred
 * 4. Trier par phase ID puis ordre dans la phase
 * 5. Retourner le top 1 + alternatives
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AUDIT_DIR = join(ROOT, "docs/audits/2026-05-10-security");
const PLAN_PATH = join(AUDIT_DIR, "BATTLE-PLAN.json");
const FINDINGS_PATH = join(AUDIT_DIR, "findings.json");

function loadJson(p) {
  if (!existsSync(p)) {
    console.error(`❌ ${p} not found`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf-8"));
}

function statusEmoji(s) {
  return { pending: "⏳", in_progress: "🔵", blocked: "🔴", deferred: "💤", done: "✅" }[s] ?? "❓";
}

function severityEmoji(s) {
  return { P0: "🔥", P1: "🟧", P2: "🟨" }[s] ?? "·";
}

function main() {
  const isJson = process.argv.includes("--json");
  const plan = loadJson(PLAN_PATH);
  const findings = loadJson(FINDINGS_PATH);
  const findingsById = Object.fromEntries((findings.findings || []).map((f) => [f.id, f]));

  // Index batches by id for pre_condition lookup
  const batchById = {};
  for (const phase of plan.phases || []) {
    for (const batch of phase.batches || []) {
      batchById[batch.id] = { batch, phase };
    }
  }

  // Filter eligible batchs
  const eligible = [];
  for (const phase of plan.phases || []) {
    if (phase.status === "deferred") continue;

    for (const batch of phase.batches || []) {
      if (batch.status !== "pending" && batch.status !== "in_progress") continue;

      // Check pre_conditions
      const preConds = batch.pre_conditions || [];
      const unmet = preConds.filter((pc) => {
        if (pc === "GO-LIVE") return true; // GO-LIVE batchs are last anyway
        const dep = batchById[pc];
        return !dep || dep.batch.status !== "done";
      });

      if (unmet.length > 0) continue;

      eligible.push({ batch, phase, unmet_count: 0 });
    }
  }

  if (eligible.length === 0) {
    if (isJson) {
      console.log(
        JSON.stringify(
          { next: null, message: "No eligible batch — all done or all blocked" },
          null,
          2,
        ),
      );
    } else {
      console.log("\n🎉 Aucun batch éligible.\n");
      console.log(
        "Soit tout est done (🚀 GO-LIVE prêt), soit tous les pendings sont bloqués par pre-conditions.\n",
      );
      console.log("Lance `node scripts/battle-status.mjs` pour vue globale.");
    }
    return;
  }

  // Sort: phase order (P0 → P1 → ...) then batch order in phase
  eligible.sort((a, b) => {
    const phaseAIdx = (plan.phases || []).indexOf(a.phase);
    const phaseBIdx = (plan.phases || []).indexOf(b.phase);
    if (phaseAIdx !== phaseBIdx) return phaseAIdx - phaseBIdx;
    const batchAIdx = a.phase.batches.indexOf(a.batch);
    const batchBIdx = b.phase.batches.indexOf(b.batch);
    return batchAIdx - batchBIdx;
  });

  const next = eligible[0];
  const alternatives = eligible.slice(1, 4); // top 3 alternatives

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          next: { phase: next.phase.id, batch: next.batch },
          alternatives: alternatives.map(({ batch, phase }) => ({
            phase: phase.id,
            batch_id: batch.id,
            title: batch.title,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n🎯 Prochain batch recommandé\n`);
  console.log(`${statusEmoji(next.batch.status)} ${next.batch.id} — ${next.batch.title}`);
  console.log(`  Phase: ${next.phase.id} ${next.phase.title}`);
  console.log(`  Status actuel: ${next.batch.status}`);
  console.log(`  Effort estimé: ${next.batch.estimated_effort ?? "—"}`);
  if (next.batch.sub_agent_recommended) {
    console.log(`  Sub-agent recommandé: ${next.batch.sub_agent_recommended}`);
  }

  if (next.batch.findings?.length) {
    console.log(`  Findings (${next.batch.findings.length}):`);
    for (const fid of next.batch.findings) {
      const f = findingsById[fid];
      if (f) {
        console.log(`    ${severityEmoji(f.severity)} ${f.id} — ${f.title.slice(0, 80)}`);
      }
    }
  }

  if (next.batch.validation?.length) {
    console.log(`  Validation:`);
    for (const v of next.batch.validation.slice(0, 3)) {
      console.log(`    - ${v}`);
    }
  }

  if (next.batch.blast_if_skipped) {
    console.log(`\n  ⚠ Si skipped : ${next.batch.blast_if_skipped}`);
  }

  console.log(`\n→ Pour exécuter : /battle-exec ${next.batch.id}`);
  console.log(`→ Ou détail finding : node scripts/battle-status.mjs --finding=F-XXX\n`);

  if (alternatives.length > 0) {
    console.log("Alternatives (mêmes pre-conditions satisfaites) :");
    for (const alt of alternatives) {
      console.log(
        `  · ${alt.batch.id} — ${alt.batch.title.slice(0, 70)} (${alt.batch.estimated_effort ?? "?"})`,
      );
    }
  }
}

main();
