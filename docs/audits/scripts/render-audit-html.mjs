#!/usr/bin/env node
/**
 * render-audit-html.mjs — Génère AUDIT-MASTER.html depuis findings.json
 *
 * Usage:
 *   node docs/audits/scripts/render-audit-html.mjs <audit-dir>
 *   node docs/audits/scripts/render-audit-html.mjs docs/audits/2026-05-10-security
 *
 *   OU sans arg : régénère TOUS les audits listés dans REGISTRY.json
 *
 * Le HTML généré est standalone (vanilla JS + CSS embedded), ouvrable dans Chrome.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
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

function renderAudit(auditDir) {
  const findingsPath = join(auditDir, "findings.json");
  if (!existsSync(findingsPath)) {
    console.error(`❌ ${findingsPath} not found`);
    return false;
  }

  const data = JSON.parse(readFileSync(findingsPath, "utf-8"));
  const findings = data.findings || [];
  const sources = data.sources || [];
  const summary = data.summary || {};
  const auditTitle = `${data.audit_id} — ${data.scope}`;

  // Build per-finding lifecycle as markdown for tooltip
  const findingsForJs = findings.map((f) => ({
    ...f,
    _evidence_str: (f.evidence || [])
      .map((e) => (e.lines ? `${e.file}:${e.lines}` : e.line ? `${e.file}:${e.line}` : e.file))
      .join(" · "),
  }));

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(auditTitle)} — Audit Master</title>
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
  header h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
  header .meta { color: #888; font-size: 12px; }
  header .meta a { color: #7ab7ff; text-decoration: none; }
  header .meta a:hover { text-decoration: underline; }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    padding: 20px 32px;
    border-bottom: 1px solid #1f1f1f;
  }
  .stat-card {
    background: #131313;
    padding: 14px 16px;
    border-radius: 8px;
    border: 1px solid #1f1f1f;
  }
  .stat-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-card .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
  .stat-card .sub { font-size: 11px; color: #666; margin-top: 2px; }

  .controls {
    display: flex;
    gap: 12px;
    padding: 16px 32px;
    flex-wrap: wrap;
    border-bottom: 1px solid #1f1f1f;
    background: #0d0d0d;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .controls input,
  .controls select {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    color: #e8e8e8;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
  }
  .controls input { flex: 1; min-width: 240px; }
  .controls input:focus,
  .controls select:focus { outline: none; border-color: #4a4a4a; }

  .table-wrap { padding: 0 32px 32px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th {
    text-align: left;
    padding: 10px 12px;
    background: #131313;
    border-bottom: 1px solid #2a2a2a;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    position: sticky;
    top: 65px;
  }
  td {
    padding: 12px;
    border-bottom: 1px solid #1a1a1a;
    vertical-align: top;
  }
  tr.finding-row { cursor: pointer; transition: background 0.1s; }
  tr.finding-row:hover { background: #131313; }
  tr.finding-row.expanded { background: #131313; }
  tr.detail-row { display: none; }
  tr.detail-row.show { display: table-row; }
  tr.detail-row td {
    background: #0d0d0d;
    padding: 16px 24px 20px;
    border-bottom: 2px solid #1f1f1f;
  }

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

  .status-pending { background: #2a2a2a; color: #aaa; }
  .status-triaged { background: rgba(123, 97, 255, 0.15); color: #a78bff; }
  .status-implementing { background: rgba(42, 74, 140, 0.3); color: #7ab7ff; }
  .status-tested { background: rgba(74, 140, 100, 0.25); color: #74cc8a; }
  .status-reaudited { background: rgba(140, 100, 74, 0.3); color: #d4a574; }
  .status-validated { background: rgba(74, 140, 74, 0.3); color: #4ade80; }
  .status-closed { background: rgba(60, 60, 60, 0.5); color: #888; text-decoration: line-through; }
  .status-wont_fix { background: rgba(140, 60, 60, 0.3); color: #ff8888; text-decoration: line-through; }

  .conv-convergent { color: #4ade80; font-weight: 600; }
  .conv-exclusive_claude { color: #60a5fa; }
  .conv-exclusive_codex { color: #fbbf24; }
  .conv-divergent { color: #ef4444; }

  .conf-max { color: #4ade80; }
  .conf-high { color: #84cc16; }
  .conf-medium { color: #facc15; }
  .conf-low { color: #f59e0b; }

  .source-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    background: #1f1f1f;
    color: #aaa;
    font-size: 10px;
    margin-right: 4px;
    font-family: "SF Mono", Monaco, monospace;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .detail-block h4 {
    margin: 0 0 8px;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }
  .detail-block p { margin: 0 0 12px; color: #ccc; font-size: 13px; }
  .detail-block code {
    background: #1a1a1a;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 12px;
    color: #d4a574;
  }
  .evidence-list { list-style: none; padding: 0; margin: 0; }
  .evidence-list li {
    background: #1a1a1a;
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 4px;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 11px;
    color: #aaa;
  }
  .evidence-list a { color: #7ab7ff; text-decoration: none; }
  .evidence-list a:hover { text-decoration: underline; }

  .blind-spot {
    background: rgba(251, 191, 36, 0.08);
    border-left: 3px solid #fbbf24;
    padding: 8px 12px;
    margin-top: 12px;
    font-size: 12px;
    color: #fbbf24;
    border-radius: 0 4px 4px 0;
  }

  .lifecycle-list { list-style: none; padding: 0; margin: 0; }
  .lifecycle-list li {
    padding: 4px 0;
    font-size: 11px;
    color: #888;
    border-bottom: 1px dashed #222;
  }
  .lifecycle-list li:last-child { border-bottom: none; }
  .lifecycle-actor {
    color: #aaa;
    font-weight: 600;
    margin-right: 6px;
  }

  .effort { color: #888; font-size: 12px; }
  .id-col { font-family: "SF Mono", Monaco, monospace; color: #888; font-size: 12px; }

  .empty-state {
    padding: 60px;
    text-align: center;
    color: #666;
  }

  .toolbar-info {
    padding: 8px 32px;
    color: #666;
    font-size: 12px;
    background: #0d0d0d;
    border-bottom: 1px solid #1a1a1a;
  }
  .toolbar-info span { color: #aaa; font-weight: 600; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(auditTitle)}</h1>
  <div class="meta">
    Sources : ${sources.map((s) => `<span class="source-tag">${escapeHtml(s.id)}</span>`).join(" ")}
    · Last updated : ${escapeHtml(data.last_updated || "—")}
    · Orchestrator : <code>${escapeHtml(data.orchestrator || "—")}</code>
  </div>
</header>

<section class="summary">
  <div class="stat-card">
    <div class="label">Total</div>
    <div class="value">${summary.total_consolidated ?? findings.length}</div>
    <div class="sub">findings consolidés</div>
  </div>
  <div class="stat-card">
    <div class="label">P0</div>
    <div class="value sev-P0" style="background:none;border:none;padding:0;">${summary.by_severity?.P0 ?? 0}</div>
    <div class="sub">critiques</div>
  </div>
  <div class="stat-card">
    <div class="label">P1</div>
    <div class="value sev-P1" style="background:none;border:none;padding:0;">${summary.by_severity?.P1 ?? 0}</div>
    <div class="sub">hauts</div>
  </div>
  <div class="stat-card">
    <div class="label">P2</div>
    <div class="value sev-P2" style="background:none;border:none;padding:0;">${summary.by_severity?.P2 ?? 0}</div>
    <div class="sub">moyens</div>
  </div>
  <div class="stat-card">
    <div class="label">Convergent</div>
    <div class="value conv-convergent">${summary.by_convergence?.convergent ?? 0}</div>
    <div class="sub">confiance max</div>
  </div>
  <div class="stat-card">
    <div class="label">Validés/Clos</div>
    <div class="value">${(summary.by_status?.validated ?? 0) + (summary.by_status?.closed ?? 0)}</div>
    <div class="sub">sur ${summary.total_consolidated ?? findings.length}</div>
  </div>
  <div class="stat-card">
    <div class="label">In progress</div>
    <div class="value">${summary.by_status?.implementing ?? 0}</div>
    <div class="sub">en cours d'implémentation</div>
  </div>
  <div class="stat-card">
    <div class="label">Pending</div>
    <div class="value">${summary.by_status?.pending ?? findings.length}</div>
    <div class="sub">à traiter</div>
  </div>
</section>

<section class="controls">
  <input type="text" id="search" placeholder="Rechercher (titre, ID, fichier)..." />
  <select id="filterSeverity">
    <option value="">Toutes sévérités</option>
    <option value="P0">P0 (critique)</option>
    <option value="P1">P1 (haut)</option>
    <option value="P2">P2 (moyen)</option>
  </select>
  <select id="filterStatus">
    <option value="">Tous statuts</option>
    <option value="pending">Pending</option>
    <option value="triaged">Triaged</option>
    <option value="implementing">Implementing</option>
    <option value="tested">Tested</option>
    <option value="reaudited">Reaudited</option>
    <option value="validated">Validated</option>
    <option value="closed">Closed</option>
    <option value="wont_fix">Won't fix</option>
  </select>
  <select id="filterCategory">
    <option value="">Toutes catégories</option>
  </select>
  <select id="filterConvergence">
    <option value="">Toutes convergences</option>
    <option value="convergent">Convergent (multi-source)</option>
    <option value="exclusive_claude">Exclusive Claude</option>
    <option value="exclusive_codex">Exclusive Codex</option>
    <option value="divergent">Divergent</option>
  </select>
</section>

<div class="toolbar-info">
  <span id="visible-count">${findings.length}</span> findings affichés ·
  Clique une ligne pour voir le détail · Source verbatim : <code><a href="sources/" style="color:#7ab7ff;text-decoration:none;">sources/</a></code>
</div>

<div class="table-wrap">
<table id="findings-table">
  <thead>
    <tr>
      <th style="width:60px;">ID</th>
      <th>Title</th>
      <th style="width:60px;">Sev</th>
      <th style="width:100px;">Status</th>
      <th style="width:120px;">Category</th>
      <th style="width:130px;">Convergence</th>
      <th style="width:100px;">Sources</th>
      <th style="width:80px;">Effort</th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>
</div>

<script>
const FINDINGS = ${JSON.stringify(findingsForJs)};
const AUDIT_DIR = ${JSON.stringify(basename(auditDir))};

const tbody = document.getElementById("tbody");
const searchInput = document.getElementById("search");
const filterSeverity = document.getElementById("filterSeverity");
const filterStatus = document.getElementById("filterStatus");
const filterCategory = document.getElementById("filterCategory");
const filterConvergence = document.getElementById("filterConvergence");
const visibleCount = document.getElementById("visible-count");

// Populate category filter
const categories = [...new Set(FINDINGS.map((f) => f.category).filter(Boolean))].sort();
for (const cat of categories) {
  const opt = document.createElement("option");
  opt.value = cat;
  opt.textContent = cat;
  filterCategory.appendChild(opt);
}

function escapeHtml(s) {
  if (typeof s !== "string") return String(s ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEvidence(evidence) {
  if (!evidence || !evidence.length) return "—";
  return '<ul class="evidence-list">' + evidence
    .map((e) => {
      const ref = e.lines ? \`\${e.file}:\${e.lines}\` : e.line ? \`\${e.file}:\${e.line}\` : e.file;
      const projectRoot = "../../../"; // from docs/audits/<scope>/AUDIT-MASTER.html
      const linkBase = e.file && !e.file.startsWith("(") ? \`\${projectRoot}\${e.file}\` : null;
      return \`<li>\${linkBase ? \`<a href="\${linkBase}">\${escapeHtml(ref)}</a>\` : escapeHtml(ref)}\${e.note ? ' — <em>' + escapeHtml(e.note) + '</em>' : ''}</li>\`;
    })
    .join("") + '</ul>';
}

function renderLifecycle(lifecycle) {
  if (!lifecycle || !lifecycle.length) return "—";
  return '<ul class="lifecycle-list">' + lifecycle
    .map((l) => \`<li><span class="lifecycle-actor">[\${escapeHtml(l.ts)}] \${escapeHtml(l.actor)}</span> · \${escapeHtml(l.action)}\${l.note ? ' — ' + escapeHtml(l.note) : ''}</li>\`)
    .join("") + '</ul>';
}

function renderRow(f, idx) {
  const sources = (f.sources || []).map((s) => \`<span class="source-tag">\${escapeHtml(s)}</span>\`).join(" ");
  return \`
    <tr class="finding-row" data-idx="\${idx}">
      <td class="id-col">\${escapeHtml(f.id)}</td>
      <td>\${escapeHtml(f.title)}</td>
      <td><span class="badge sev-\${f.severity}">\${escapeHtml(f.severity)}</span></td>
      <td><span class="badge status-\${f.status}">\${escapeHtml(f.status)}</span></td>
      <td>\${escapeHtml(f.category || "—")}</td>
      <td class="conv-\${f.convergence}">\${escapeHtml(f.convergence || "—")}</td>
      <td>\${sources}</td>
      <td class="effort">\${escapeHtml(f.estimated_effort || "—")}</td>
    </tr>
    <tr class="detail-row" data-detail-idx="\${idx}">
      <td colspan="8">
        <div class="detail-grid">
          <div class="detail-block">
            <h4>Attack scenario</h4>
            <p>\${escapeHtml(f.attack_scenario || "—")}</p>
            <h4>Production impact</h4>
            <p>\${escapeHtml(f.production_impact || "—")}</p>
            <h4>Exploitability</h4>
            <p>\${escapeHtml(f.exploitability || "—")}</p>
            <h4>Confidence</h4>
            <p class="conf-\${f.confidence}">\${escapeHtml(f.confidence || "—")}</p>
            \${f.blind_spot_note ? '<div class="blind-spot">⚠ ' + escapeHtml(f.blind_spot_note) + '</div>' : ''}
          </div>
          <div class="detail-block">
            <h4>Fix minimal</h4>
            <p>\${escapeHtml(f.fix_minimal || "—")}</p>
            \${f.fix_ideal ? '<h4>Fix idéal</h4><p>' + escapeHtml(f.fix_ideal) + '</p>' : ''}
            <h4>Evidence</h4>
            \${renderEvidence(f.evidence)}
            <h4>Lifecycle</h4>
            \${renderLifecycle(f.lifecycle)}
            <h4>Refs croisées</h4>
            <p style="font-size:12px;">
              Claude : \${(f.claude_refs || []).map((r) => '<code>' + escapeHtml(r) + '</code>').join(", ") || "—"}<br />
              Codex : \${(f.codex_refs || []).map((r) => '<code>' + escapeHtml(r) + '</code>').join(", ") || "—"}
            </p>
            <h4>Implementation doc</h4>
            <p><a href="findings/\${escapeHtml(f.id)}.md" style="color:#7ab7ff;">findings/\${escapeHtml(f.id)}.md</a> <em style="color:#666;">(à créer au démarrage de l'implémentation)</em></p>
          </div>
        </div>
      </td>
    </tr>
  \`;
}

function render() {
  const search = searchInput.value.toLowerCase();
  const sev = filterSeverity.value;
  const status = filterStatus.value;
  const cat = filterCategory.value;
  const conv = filterConvergence.value;

  const filtered = FINDINGS.filter((f) => {
    if (sev && f.severity !== sev) return false;
    if (status && f.status !== status) return false;
    if (cat && f.category !== cat) return false;
    if (conv && f.convergence !== conv) return false;
    if (search) {
      const hay = [
        f.id,
        f.title,
        f.category,
        f._evidence_str,
        f.attack_scenario,
        f.fix_minimal,
      ].join(" ").toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Aucun finding ne correspond aux filtres.</td></tr>';
  } else {
    tbody.innerHTML = filtered.map((f, i) => renderRow(f, FINDINGS.indexOf(f))).join("");
  }
  visibleCount.textContent = filtered.length;

  // Wire click-to-expand
  for (const row of tbody.querySelectorAll(".finding-row")) {
    row.addEventListener("click", () => {
      const idx = row.dataset.idx;
      const detail = tbody.querySelector(\`.detail-row[data-detail-idx="\${idx}"]\`);
      if (detail) {
        const wasShown = detail.classList.contains("show");
        // Close all
        for (const d of tbody.querySelectorAll(".detail-row.show")) d.classList.remove("show");
        for (const r of tbody.querySelectorAll(".finding-row.expanded")) r.classList.remove("expanded");
        if (!wasShown) {
          detail.classList.add("show");
          row.classList.add("expanded");
        }
      }
    });
  }
}

searchInput.addEventListener("input", render);
filterSeverity.addEventListener("change", render);
filterStatus.addEventListener("change", render);
filterCategory.addEventListener("change", render);
filterConvergence.addEventListener("change", render);

render();
</script>
</body>
</html>
`;

  const outPath = join(auditDir, "AUDIT-MASTER.html");
  writeFileSync(outPath, html, "utf-8");
  console.log(`✓ ${auditDir.replace(AUDITS_ROOT, "docs/audits")}/AUDIT-MASTER.html — ${findings.length} findings`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const dir = resolve(args[0]);
    renderAudit(dir);
    return;
  }

  // No arg : render all audits in REGISTRY.json
  const registryPath = join(AUDITS_ROOT, "REGISTRY.json");
  if (!existsSync(registryPath)) {
    console.error(`❌ ${registryPath} not found. Pass an audit dir as arg, or create REGISTRY.json.`);
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  let count = 0;
  for (const audit of registry.audits || []) {
    if (audit.status === "active" || audit.status === "implementing") {
      const dir = join(AUDITS_ROOT, audit.id);
      if (renderAudit(dir)) count++;
    }
  }
  console.log(`\n${count} audit(s) rendered.`);
}

main();
