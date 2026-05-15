#!/usr/bin/env node
/**
 * render-battle-plan-html.mjs — Génère BATTLE-PLAN.html depuis BATTLE-PLAN.json
 *
 * Cross-référence avec findings.json pour pull les détails de chaque finding.
 *
 * Usage:
 *   node docs/audits/scripts/render-battle-plan-html.mjs <audit-dir>
 *   node docs/audits/scripts/render-battle-plan-html.mjs docs/audits/2026-05-10-security
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDITS_ROOT = resolve(__dirname, "..");

function escapeHtml(s) {
  if (typeof s !== "string") return String(s ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBattlePlan(auditDir) {
  const planPath = join(auditDir, "BATTLE-PLAN.json");
  const findingsPath = join(auditDir, "findings.json");

  if (!existsSync(planPath)) {
    console.error(`❌ ${planPath} not found`);
    return false;
  }
  if (!existsSync(findingsPath)) {
    console.error(`❌ ${findingsPath} not found`);
    return false;
  }

  const plan = JSON.parse(readFileSync(planPath, "utf-8"));
  const findingsData = JSON.parse(readFileSync(findingsPath, "utf-8"));

  // Index findings by ID for quick lookup
  const findingsById = {};
  for (const f of findingsData.findings || []) {
    findingsById[f.id] = f;
  }

  // Stats
  const allBatches = (plan.phases || []).flatMap((p) =>
    (p.batches || []).map((b) => ({ ...b, phase_id: p.id, phase_status: p.status })),
  );
  const totalBatches = allBatches.length;
  const doneBatches = allBatches.filter((b) => b.status === "done").length;
  const inProgressBatches = allBatches.filter((b) => b.status === "in_progress").length;
  const blockedBatches = allBatches.filter((b) => b.status === "blocked").length;
  const deferredBatches = allBatches.filter((b) => b.status === "deferred").length;
  const pendingBatches = allBatches.filter((b) => b.status === "pending").length;

  const allFindingIds = new Set();
  for (const b of allBatches) {
    for (const fid of b.findings || []) {
      allFindingIds.add(fid);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(plan.audit_id)} — Battle Plan</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0a0a0a;
    color: #e8e8e8;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  header {
    padding: 24px 32px 16px;
    border-bottom: 1px solid #1f1f1f;
    background: linear-gradient(180deg, #111 0%, #0a0a0a 100%);
  }
  header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 600; }
  header .objective { color: #aaa; font-size: 13px; margin: 4px 0 8px; }
  header .meta { color: #666; font-size: 12px; }
  header .meta a { color: #7ab7ff; text-decoration: none; }

  .progress-section {
    padding: 16px 32px;
    border-bottom: 1px solid #1f1f1f;
    background: #0d0d0d;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
  .stat-card {
    background: #131313;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid #1f1f1f;
  }
  .stat-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-card .value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  .stat-card .sub { font-size: 11px; color: #666; margin-top: 2px; }

  .progress-bar {
    height: 6px;
    background: #1a1a1a;
    border-radius: 3px;
    overflow: hidden;
    margin-top: 8px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
    transition: width 0.3s;
  }

  main { padding: 24px 32px 60px; }

  .phase {
    margin-bottom: 28px;
    background: #0d0d0d;
    border: 1px solid #1f1f1f;
    border-radius: 10px;
    overflow: hidden;
  }
  .phase-header {
    padding: 16px 20px;
    background: #131313;
    border-bottom: 1px solid #1f1f1f;
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    user-select: none;
  }
  .phase-header:hover { background: #181818; }
  .phase-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    flex: 1;
  }
  .phase-header .objective {
    font-size: 12px;
    color: #888;
    margin-top: 4px;
  }
  .phase-header .effort {
    color: #666;
    font-size: 12px;
    font-family: "SF Mono", Monaco, monospace;
  }
  .phase-content {
    padding: 16px 20px;
    display: block;
  }
  .phase-content.hidden { display: none; }

  .phase-objective {
    color: #aaa;
    font-size: 13px;
    margin: 0 0 16px;
    padding: 10px 14px;
    background: #131313;
    border-left: 3px solid #2a4a8c;
    border-radius: 0 4px 4px 0;
  }

  .batch {
    margin-bottom: 14px;
    background: #131313;
    border: 1px solid #1f1f1f;
    border-radius: 8px;
    overflow: hidden;
  }
  .batch-header {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }
  .batch-header:hover { background: #181818; }
  .batch-header .id {
    font-family: "SF Mono", Monaco, monospace;
    color: #888;
    font-size: 12px;
    min-width: 60px;
  }
  .batch-header .title {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }
  .batch-header .effort {
    color: #888;
    font-size: 11px;
    font-family: "SF Mono", Monaco, monospace;
  }
  .batch-content {
    padding: 14px 18px 18px;
    border-top: 1px solid #1f1f1f;
    background: #0d0d0d;
    display: none;
  }
  .batch-content.show { display: block; }

  .batch-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .batch-block h4 {
    margin: 0 0 8px;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }
  .batch-block p, .batch-block ul {
    margin: 0 0 12px;
    color: #ccc;
    font-size: 12px;
  }
  .batch-block ul { padding-left: 18px; }
  .batch-block code {
    background: #1a1a1a;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 11px;
    color: #d4a574;
  }

  .findings-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .findings-list li {
    background: #1a1a1a;
    padding: 8px 10px;
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .findings-list .fid {
    font-family: "SF Mono", Monaco, monospace;
    color: #888;
    font-size: 11px;
    min-width: 50px;
  }
  .findings-list .ftitle {
    flex: 1;
    color: #ccc;
  }
  .findings-list .fsev {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 600;
  }
  .findings-list a {
    color: #7ab7ff;
    text-decoration: none;
    font-size: 10px;
    margin-left: 4px;
  }
  .findings-list a:hover { text-decoration: underline; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .sev-P0 { background: rgba(255, 68, 68, 0.15); color: #ff5555; border: 1px solid rgba(255, 68, 68, 0.3); }
  .sev-P1 { background: rgba(255, 170, 0, 0.12); color: #ffaa33; border: 1px solid rgba(255, 170, 0, 0.25); }
  .sev-P2 { background: rgba(255, 215, 0, 0.1); color: #ffdd55; border: 1px solid rgba(255, 215, 0, 0.2); }

  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-right: 8px;
  }
  .status-pending { background: #2a2a2a; color: #aaa; }
  .status-in_progress { background: rgba(42, 74, 140, 0.3); color: #7ab7ff; border: 1px solid rgba(42, 74, 140, 0.5); }
  .status-blocked { background: rgba(140, 60, 60, 0.3); color: #ff8888; border: 1px solid rgba(140, 60, 60, 0.5); }
  .status-deferred { background: rgba(60, 60, 60, 0.5); color: #888; }
  .status-done { background: rgba(74, 140, 74, 0.3); color: #4ade80; border: 1px solid rgba(74, 140, 74, 0.5); }

  .blast-warning {
    background: rgba(255, 68, 68, 0.08);
    border-left: 3px solid #ff5555;
    padding: 8px 12px;
    margin: 8px 0;
    font-size: 12px;
    color: #ff8888;
    border-radius: 0 4px 4px 0;
  }

  .pre-conditions {
    color: #fbbf24;
    font-size: 11px;
    font-family: "SF Mono", Monaco, monospace;
  }

  .sub-agent-tag {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(123, 97, 255, 0.15);
    color: #a78bff;
    border-radius: 3px;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 11px;
    margin-right: 4px;
  }

  .phase-go-live {
    background: linear-gradient(135deg, rgba(74, 140, 74, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
    border: 2px solid rgba(74, 140, 74, 0.3);
  }
  .phase-go-live .phase-header { background: rgba(74, 140, 74, 0.15); }

  .phase-deferred .phase-header { opacity: 0.7; }

  .toolbar {
    padding: 12px 32px;
    background: #0d0d0d;
    border-bottom: 1px solid #1a1a1a;
    color: #aaa;
    font-size: 12px;
  }
  .toolbar code {
    background: #1a1a1a;
    padding: 2px 6px;
    border-radius: 3px;
    color: #7ab7ff;
    font-family: "SF Mono", Monaco, monospace;
  }

  .principles {
    padding: 12px 16px;
    background: #131313;
    border-radius: 8px;
    margin-bottom: 24px;
    font-size: 12px;
    color: #aaa;
    border-left: 3px solid #7ab7ff;
  }
  .principles strong { color: #e8e8e8; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(plan.audit_id)} — 🎯 Battle Plan</h1>
  <div class="objective">${escapeHtml(plan.objective)}</div>
  <div class="meta">
    Effort estimé : <strong>${escapeHtml(plan.estimated_total_effort)}</strong>
    · Last updated : ${escapeHtml(plan.last_updated || "—")}
    · Source de vérité findings : <a href="AUDIT-MASTER.html">AUDIT-MASTER.html</a>
  </div>
</header>

<section class="progress-section">
  <div class="stat-card">
    <div class="label">Total batchs</div>
    <div class="value">${totalBatches}</div>
    <div class="sub">à travers ${plan.phases.length} phases</div>
  </div>
  <div class="stat-card">
    <div class="label">Done</div>
    <div class="value" style="color:#4ade80;">${doneBatches}</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${((doneBatches / totalBatches) * 100).toFixed(0)}%"></div></div>
  </div>
  <div class="stat-card">
    <div class="label">In progress</div>
    <div class="value" style="color:#7ab7ff;">${inProgressBatches}</div>
  </div>
  <div class="stat-card">
    <div class="label">Pending</div>
    <div class="value">${pendingBatches}</div>
  </div>
  <div class="stat-card">
    <div class="label">Blocked</div>
    <div class="value" style="color:#ff8888;">${blockedBatches}</div>
  </div>
  <div class="stat-card">
    <div class="label">Deferred (post-go-live)</div>
    <div class="value" style="color:#888;">${deferredBatches}</div>
  </div>
  <div class="stat-card">
    <div class="label">Findings tracked</div>
    <div class="value">${allFindingIds.size}</div>
    <div class="sub">sur ${(findingsData.findings || []).length} totaux</div>
  </div>
</section>

<div class="toolbar">
  Workflow par batch : <code>1. Lire findings.json</code> → <code>2. Status implementing</code> → <code>3. Implémenter</code> → <code>4. Tests</code> → <code>5. Re-audit (modèle ≠ implémenteur)</code> → <code>6. Validator agent</code> → <code>7. Status done + npm run battle:render</code>
</div>

<main>

<div class="principles">
  <strong>Principe d'ordre</strong> : ${escapeHtml(plan.principle)}
</div>

${(plan.phases || [])
  .map((phase) => {
    const isGoLive = phase.id === "GO-LIVE";
    const isDeferred = phase.status === "deferred";
    const phaseDoneCount = (phase.batches || []).filter((b) => b.status === "done").length;
    const phaseTotalCount = (phase.batches || []).length;
    const _phaseProgress =
      phaseTotalCount > 0 ? ((phaseDoneCount / phaseTotalCount) * 100).toFixed(0) : 0;

    return `
    <div class="phase ${isGoLive ? "phase-go-live" : ""} ${isDeferred ? "phase-deferred" : ""}" data-phase-id="${escapeHtml(phase.id)}">
      <div class="phase-header" onclick="togglePhase('${escapeHtml(phase.id)}')">
        <span class="status-badge status-${phase.status}">${escapeHtml(phase.status)}</span>
        <div style="flex:1;">
          <h2>${escapeHtml(phase.title)} — ${phaseDoneCount}/${phaseTotalCount} batchs</h2>
          <div class="objective">${escapeHtml(phase.objective)}</div>
        </div>
        <span class="effort">${escapeHtml(phase.estimated_effort || "")}</span>
      </div>
      <div class="phase-content" id="phase-${escapeHtml(phase.id)}">
        ${phase.batches
          .map(
            (batch) => `
          <div class="batch">
            <div class="batch-header" onclick="toggleBatch('${escapeHtml(batch.id)}')">
              <span class="status-badge status-${batch.status}">${escapeHtml(batch.status)}</span>
              <span class="id">${escapeHtml(batch.id)}</span>
              <span class="title">${escapeHtml(batch.title)}</span>
              <span class="effort">${escapeHtml(batch.estimated_effort || "")}</span>
            </div>
            <div class="batch-content" id="batch-${escapeHtml(batch.id)}">
              ${batch.blast_if_skipped ? `<div class="blast-warning">⚠ <strong>Si non fait :</strong> ${escapeHtml(batch.blast_if_skipped)}</div>` : ""}
              <div class="batch-grid">
                <div class="batch-block">
                  <h4>Findings inclus (${(batch.findings || []).length})</h4>
                  <ul class="findings-list">
                    ${(batch.findings || [])
                      .map((fid) => {
                        const f = findingsById[fid];
                        if (!f) {
                          return `<li><span class="fid">${escapeHtml(fid)}</span><span class="ftitle" style="color:#666;">(non trouvé dans findings.json)</span></li>`;
                        }
                        return `<li>
                          <span class="fid">${escapeHtml(fid)}</span>
                          <span class="badge sev-${f.severity}">${escapeHtml(f.severity)}</span>
                          <span class="ftitle">${escapeHtml(f.title)}</span>
                          <a href="AUDIT-MASTER.html#${escapeHtml(fid)}">→</a>
                        </li>`;
                      })
                      .join("")}
                    ${(batch.findings || []).length === 0 ? '<li style="color:#666;">Pas de findings (checklist meta)</li>' : ""}
                  </ul>
                  ${batch.pre_conditions && batch.pre_conditions.length > 0 ? `<h4>Pre-conditions</h4><div class="pre-conditions">Doit avoir : ${batch.pre_conditions.map((p) => `<code>${escapeHtml(p)}</code>`).join(", ")}</div>` : ""}
                </div>
                <div class="batch-block">
                  ${
                    batch.sub_agent_recommended
                      ? `<h4>Sub-agent recommandé</h4><p>${batch.sub_agent_recommended
                          .split(/\\s*\\+\\s*|\\s*,\\s*/)
                          .map((a) => `<span class="sub-agent-tag">${escapeHtml(a.trim())}</span>`)
                          .join("")}</p>`
                      : ""
                  }
                  <h4>Validation criteria</h4>
                  <ul>
                    ${(batch.validation || []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}
                    ${(batch.validation || []).length === 0 ? '<li style="color:#666;">À définir en démarrage de batch</li>' : ""}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
    `;
  })
  .join("")}

</main>

<script>
function togglePhase(phaseId) {
  const el = document.getElementById('phase-' + phaseId);
  if (el) el.classList.toggle('hidden');
}
function toggleBatch(batchId) {
  const el = document.getElementById('batch-' + batchId);
  if (el) el.classList.toggle('show');
}

// Auto-collapse deferred phases on load
document.querySelectorAll('.phase-deferred .phase-content').forEach((el) => el.classList.add('hidden'));
</script>
</body>
</html>
`;

  const outPath = join(auditDir, "BATTLE-PLAN.html");
  writeFileSync(outPath, html, "utf-8");
  console.log(
    `✓ ${outPath.replace(AUDITS_ROOT, "docs/audits")} — ${totalBatches} batchs / ${allFindingIds.size} findings`,
  );
  console.log(
    `   ${doneBatches}/${totalBatches} done · ${pendingBatches} pending · ${deferredBatches} deferred`,
  );
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    renderBattlePlan(resolve(args[0]));
    return;
  }

  // No arg : render all active audits
  const registryPath = join(AUDITS_ROOT, "REGISTRY.json");
  if (!existsSync(registryPath)) {
    console.error(`❌ ${registryPath} not found. Pass an audit dir as arg.`);
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  for (const audit of registry.audits || []) {
    if (audit.status === "active" || audit.status === "implementing") {
      const dir = join(AUDITS_ROOT, audit.id);
      if (existsSync(join(dir, "BATTLE-PLAN.json"))) {
        renderBattlePlan(dir);
      }
    }
  }
}

main();
