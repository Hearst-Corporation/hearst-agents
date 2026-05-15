#!/usr/bin/env node
/**
 * battle-mark.mjs — Change le status d'un batch ou d'un finding + cascade lifecycle.
 *
 * Usage:
 *   node scripts/battle-mark.mjs --batch=B1.2 --status=in_progress
 *   node scripts/battle-mark.mjs --batch=B1.2 --status=done
 *   node scripts/battle-mark.mjs --batch=B1.2 --status=blocked --reason="..."
 *   node scripts/battle-mark.mjs --finding=F-001 --status=closed --by="batch-orchestrator"
 *
 * Statuts batch valides: pending | in_progress | blocked | done | deferred
 * Statuts finding valides: pending | triaged | implementing | tested | reaudited | validated | closed | wont_fix
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AUDIT_DIR = join(ROOT, "docs/audits/2026-05-10-security");
const PLAN_PATH = join(AUDIT_DIR, "BATTLE-PLAN.json");
const FINDINGS_PATH = join(AUDIT_DIR, "findings.json");

const VALID_BATCH_STATUSES = ["pending", "in_progress", "blocked", "done", "deferred"];
const VALID_FINDING_STATUSES = [
  "pending",
  "triaged",
  "implementing",
  "tested",
  "reaudited",
  "validated",
  "closed",
  "wont_fix",
];

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

function saveJson(p, data) {
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function nowIso() {
  return new Date().toISOString();
}

function checkAgentLock() {
  const lockPath = join(ROOT, "docs/AGENT-LOCK.json");
  if (!existsSync(lockPath)) return;
  const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
  if (lock.locked === true) {
    console.error(
      `❌ AGENT-LOCK actif (reason: ${lock.reason ?? "—"}) — aucune écriture autorisée.`,
    );
    process.exit(1);
  }
}

function markBatch(batchId, newStatus, reason, actor) {
  const plan = loadJson(PLAN_PATH);
  let foundBatch = null;
  let foundPhase = null;

  for (const phase of plan.phases || []) {
    for (const batch of phase.batches || []) {
      if (batch.id === batchId) {
        foundBatch = batch;
        foundPhase = phase;
        break;
      }
    }
    if (foundBatch) break;
  }

  if (!foundBatch) {
    console.error(`❌ Batch ${batchId} not found`);
    process.exit(1);
  }

  const previousStatus = foundBatch.status;
  foundBatch.status = newStatus;

  // Timestamps
  if (newStatus === "in_progress" && !foundBatch.started_at) {
    foundBatch.started_at = nowIso();
  }
  if (newStatus === "done") {
    foundBatch.closed_at = nowIso();
  }

  // Lifecycle
  foundBatch.lifecycle = foundBatch.lifecycle || [];
  foundBatch.lifecycle.push({
    ts: nowIso(),
    actor: actor ?? "battle-mark-cli",
    from: previousStatus,
    to: newStatus,
    ...(reason ? { reason } : {}),
  });

  // Update phase status if all batches done
  const allDone = (foundPhase.batches || []).every(
    (b) => b.status === "done" || b.status === "deferred",
  );
  if (allDone && foundPhase.status !== "deferred") {
    foundPhase.status = "done";
  } else if (foundPhase.status !== "deferred") {
    const anyInProgress = (foundPhase.batches || []).some((b) => b.status === "in_progress");
    foundPhase.status = anyInProgress ? "in_progress" : "pending";
  }

  // Update plan last_updated
  plan.last_updated = nowIso();

  saveJson(PLAN_PATH, plan);
  console.log(
    `✓ Batch ${batchId}: ${previousStatus} → ${newStatus} (phase ${foundPhase.id} → ${foundPhase.status})`,
  );
}

function markFinding(findingId, newStatus, reason, actor) {
  const findings = loadJson(FINDINGS_PATH);
  const found = (findings.findings || []).find((f) => f.id === findingId);

  if (!found) {
    console.error(`❌ Finding ${findingId} not found`);
    process.exit(1);
  }

  const previousStatus = found.status;
  found.status = newStatus;

  // Lifecycle
  found.lifecycle = found.lifecycle || [];
  found.lifecycle.push({
    ts: nowIso(),
    actor: actor ?? "battle-mark-cli",
    from: previousStatus,
    to: newStatus,
    ...(reason ? { reason } : {}),
  });

  // Update summary counts
  const summary = findings.summary || {};
  summary.by_status = summary.by_status || {};
  summary.by_status[previousStatus] = Math.max(0, (summary.by_status[previousStatus] || 1) - 1);
  summary.by_status[newStatus] = (summary.by_status[newStatus] || 0) + 1;
  findings.summary = summary;
  findings.last_updated = nowIso();

  saveJson(FINDINGS_PATH, findings);
  console.log(`✓ Finding ${findingId}: ${previousStatus} → ${newStatus}`);
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.status) {
    console.error("❌ --status=<status> required");
    process.exit(1);
  }

  checkAgentLock();

  if (args.batch) {
    if (!VALID_BATCH_STATUSES.includes(args.status)) {
      console.error(
        `❌ Invalid batch status: ${args.status}. Valid: ${VALID_BATCH_STATUSES.join(", ")}`,
      );
      process.exit(1);
    }
    markBatch(args.batch, args.status, args.reason, args.by);
    return;
  }

  if (args.finding) {
    if (!VALID_FINDING_STATUSES.includes(args.status)) {
      console.error(
        `❌ Invalid finding status: ${args.status}. Valid: ${VALID_FINDING_STATUSES.join(", ")}`,
      );
      process.exit(1);
    }
    markFinding(args.finding, args.status, args.reason, args.by);
    return;
  }

  console.error("❌ --batch=<id> ou --finding=<id> required");
  process.exit(1);
}

main();
