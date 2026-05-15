#!/usr/bin/env node
// Render unifié des rapports slash commands.
// Source unique de vérité visuelle. Aucun template HTML inline dans les .md.
//
// Usage :
//   node scripts/render-report.mjs --type=<type> --data=<path.json> [--open] [--out=<path>]
//
// Si --out omis : docs/audit/<type>-YYYY-MM-DD.html (créé automatiquement).
// Si --data="-" : lit JSON depuis stdin.
//
// Schéma JSON attendu :
// {
//   "title": "string",
//   "scope": "string?",
//   "kpis": { "p0": n, "p1": n, "p2": n, "score": n? },
//   "sections": [
//     { "name": "string", "agent": "string?", "summary": "string?",
//       "findings": [
//         { "severity": "P0|P1|P2|critique|moyen|mineur",
//           "path": "string?", "line": n?, "rule": "string?",
//           "title": "string", "current": "string?", "suggested": "string?",
//           "why": "string?", "status": "string?" }
//       ]
//     }
//   ],
//   "quickWins": [ { "title", "path?", "effort?" } ]?,
//   "plan": [ { "name", "items": ["..."] } ]?,
//   "footer": "string?"
// }

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

const type = args.type || "report";
const dataPath = args.data;
const openInBrowser = args.open === "true";
const outPath = args.out || defaultOutPath(type);

if (!dataPath) {
  console.error("ERREUR : --data=<path.json> requis (ou --data=- pour stdin)");
  process.exit(1);
}

const raw =
  dataPath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(dataPath, "utf8");

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("ERREUR : JSON invalide —", e.message);
  process.exit(1);
}

const html = render(type, data);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(outPath);

if (openInBrowser) {
  const result = spawnSync("open", ["-a", "Google Chrome", outPath], {
    stdio: "ignore",
  });
  if (result.status !== 0) {
    spawnSync("open", [outPath], { stdio: "ignore" });
  }
}

function defaultOutPath(type) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join("docs", "audit", `${type}-${date}.html`);
}

function gitContext() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    const commit = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
    }).trim();
    return { branch, commit };
  } catch {
    return { branch: "?", commit: "?" };
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeSeverity(s) {
  const k = String(s ?? "").toLowerCase();
  if (["p0", "critique", "critical", "blocker"].includes(k)) return "p0";
  if (["p1", "moyen", "major", "warning"].includes(k)) return "p1";
  return "p2";
}

function fileLink(p, line) {
  if (!p) return "";
  const abs = path.isAbsolute(p) ? p : path.resolve(p);
  const href = `vscode://file/${abs}${line ? `:${line}` : ""}`;
  const label = line ? `${p}:${line}` : p;
  return `<a class="fp" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderFinding(f) {
  const sev = normalizeSeverity(f.severity);
  return `
    <div class="finding sev-${sev}">
      <div class="finding-head">
        <span class="badge badge-${sev}">${sev.toUpperCase()}</span>
        <span class="finding-title">${escapeHtml(f.title || f.rule || "—")}</span>
        ${f.status ? `<span class="status">${escapeHtml(f.status)}</span>` : ""}
      </div>
      ${f.path ? `<div class="finding-path">${fileLink(f.path, f.line)}</div>` : ""}
      ${f.current ? `<div class="finding-row"><span class="k">Actuel</span><code>${escapeHtml(f.current)}</code></div>` : ""}
      ${f.suggested ? `<div class="finding-row"><span class="k">Suggéré</span><code>${escapeHtml(f.suggested)}</code></div>` : ""}
      ${f.why ? `<div class="finding-row"><span class="k">Pourquoi</span><span>${escapeHtml(f.why)}</span></div>` : ""}
    </div>`;
}

function renderSection(s) {
  const sorted = [...(s.findings || [])].sort((a, b) => {
    const order = { p0: 0, p1: 1, p2: 2 };
    return order[normalizeSeverity(a.severity)] - order[normalizeSeverity(b.severity)];
  });
  const counts = sorted.reduce((acc, f) => {
    acc[normalizeSeverity(f.severity)] = (acc[normalizeSeverity(f.severity)] || 0) + 1;
    return acc;
  }, {});
  return `
    <details class="section" open>
      <summary>
        <span class="section-name">${escapeHtml(s.name)}</span>
        ${s.agent ? `<span class="section-agent">${escapeHtml(s.agent)}</span>` : ""}
        <span class="section-counts">
          ${counts.p0 ? `<span class="badge badge-p0">${counts.p0}</span>` : ""}
          ${counts.p1 ? `<span class="badge badge-p1">${counts.p1}</span>` : ""}
          ${counts.p2 ? `<span class="badge badge-p2">${counts.p2}</span>` : ""}
        </span>
      </summary>
      ${s.summary ? `<p class="section-summary">${escapeHtml(s.summary)}</p>` : ""}
      <div class="findings">
        ${sorted.map(renderFinding).join("") || `<div class="empty">Aucun finding.</div>`}
      </div>
    </details>`;
}

function renderKpi(label, value, modifier = "") {
  return `<div class="kpi ${modifier}"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>`;
}

function renderQuickWins(items) {
  if (!items?.length) return "";
  return `
    <section class="block">
      <h2>Quick wins</h2>
      <ol class="quick-wins">
        ${items
          .map(
            (q) => `<li>
              <span class="qw-title">${escapeHtml(q.title)}</span>
              ${q.path ? fileLink(q.path, q.line) : ""}
              ${q.effort ? `<span class="qw-effort">${escapeHtml(q.effort)}</span>` : ""}
            </li>`,
          )
          .join("")}
      </ol>
    </section>`;
}

function renderPlan(plan) {
  if (!plan?.length) return "";
  return `
    <section class="block">
      <h2>Plan de remédiation</h2>
      <div class="plan-grid">
        ${plan
          .map(
            (b) => `<div class="plan-batch">
              <h3>${escapeHtml(b.name)}</h3>
              <ul>${(b.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
            </div>`,
          )
          .join("")}
      </div>
    </section>`;
}

function render(type, data) {
  const ctx = gitContext();
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  const k = data.kpis || {};
  const totalFindings = (data.sections || []).reduce(
    (n, s) => n + (s.findings?.length || 0),
    0,
  );

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.title || type)} — Hearst OS</title>
<style>
  :root {
    --bg: #0a0a0a;
    --surface: #131313;
    --surface-hi: #1a1a1a;
    --border: #222;
    --fg: #e8e8e8;
    --fg-muted: #8a8a8a;
    --accent: #00e5cc;
    --p0: #ff4d6d;
    --p1: #ffb347;
    --p2: #eedd66;
    --radius: 10px;
    --space: 16px;
    --space-sm: 8px;
    --space-lg: 24px;
    --duration: 180ms;
    --ease: cubic-bezier(0.16, 1, 0.3, 1);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.55; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: var(--space-lg); }
  header { padding-bottom: var(--space-lg); border-bottom: 1px solid var(--border); margin-bottom: var(--space-lg); }
  h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 var(--space-sm); }
  h2 { font-size: 16px; font-weight: 600; margin: var(--space-lg) 0 var(--space); color: var(--fg); }
  h3 { font-size: 13px; font-weight: 600; margin: 0 0 var(--space-sm); color: var(--accent); }
  .meta { color: var(--fg-muted); font-size: 12px; display: flex; gap: var(--space); flex-wrap: wrap; }
  .meta b { color: var(--fg); font-weight: 500; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space); margin: var(--space-lg) 0; }
  .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space); }
  .kpi-value { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); margin-top: 4px; }
  .kpi.p0 .kpi-value { color: var(--p0); }
  .kpi.p1 .kpi-value { color: var(--p1); }
  .kpi.p2 .kpi-value { color: var(--p2); }
  .kpi.accent .kpi-value { color: var(--accent); }
  .block { margin: var(--space-lg) 0; }
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: var(--space); overflow: hidden; }
  .section > summary { padding: var(--space); cursor: pointer; list-style: none; display: flex; align-items: center; gap: var(--space); transition: background var(--duration) var(--ease); }
  .section > summary:hover { background: var(--surface-hi); }
  .section > summary::-webkit-details-marker { display: none; }
  .section-name { font-weight: 600; flex: 0 0 auto; }
  .section-agent { color: var(--fg-muted); font-size: 12px; }
  .section-counts { margin-left: auto; display: flex; gap: 6px; }
  .section-summary { padding: 0 var(--space) var(--space-sm); color: var(--fg-muted); font-size: 13px; margin: 0; }
  .findings { padding: 0 var(--space) var(--space); display: grid; gap: var(--space-sm); }
  .finding { background: var(--surface-hi); border: 1px solid var(--border); border-left-width: 3px; border-radius: 6px; padding: var(--space-sm) var(--space); }
  .finding.sev-p0 { border-left-color: var(--p0); }
  .finding.sev-p1 { border-left-color: var(--p1); }
  .finding.sev-p2 { border-left-color: var(--p2); }
  .finding-head { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
  .finding-title { font-weight: 500; }
  .finding-path { margin-top: 4px; font-size: 12px; }
  .finding-row { display: flex; gap: var(--space-sm); margin-top: 4px; font-size: 12px; align-items: baseline; }
  .finding-row .k { color: var(--fg-muted); flex: 0 0 64px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  .finding-row code { background: rgba(255,255,255,0.04); padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 11px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; }
  .badge-p0 { background: rgba(255,77,109,0.15); color: var(--p0); }
  .badge-p1 { background: rgba(255,179,71,0.15); color: var(--p1); }
  .badge-p2 { background: rgba(238,221,102,0.15); color: var(--p2); }
  .status { margin-left: auto; color: var(--fg-muted); font-size: 11px; }
  .fp { color: var(--accent); text-decoration: none; font-family: ui-monospace, monospace; font-size: 11px; }
  .fp:hover { text-decoration: underline; }
  .empty { color: var(--fg-muted); font-style: italic; padding: var(--space); text-align: center; }
  .quick-wins { padding-left: var(--space-lg); margin: 0; display: grid; gap: 6px; }
  .quick-wins li { display: flex; gap: var(--space); align-items: baseline; }
  .qw-title { font-weight: 500; }
  .qw-effort { color: var(--fg-muted); font-size: 11px; margin-left: auto; }
  .plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space); }
  .plan-batch { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space); }
  .plan-batch ul { padding-left: var(--space); margin: 0; }
  .plan-batch li { margin-bottom: 4px; }
  footer { margin-top: var(--space-lg); padding-top: var(--space); border-top: 1px solid var(--border); color: var(--fg-muted); font-size: 11px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${escapeHtml(data.title || type)}</h1>
    <div class="meta">
      <span><b>Date</b> ${escapeHtml(date)}</span>
      <span><b>Branche</b> ${escapeHtml(ctx.branch)}</span>
      <span><b>Commit</b> ${escapeHtml(ctx.commit)}</span>
      ${data.scope ? `<span><b>Scope</b> ${escapeHtml(data.scope)}</span>` : ""}
    </div>
  </header>

  <section class="kpis">
    ${renderKpi("Findings", totalFindings, "accent")}
    ${renderKpi("P0 — critique", k.p0 ?? 0, "p0")}
    ${renderKpi("P1 — important", k.p1 ?? 0, "p1")}
    ${renderKpi("P2 — dette", k.p2 ?? 0, "p2")}
    ${typeof k.score === "number" ? renderKpi("Score /10", k.score, "accent") : ""}
  </section>

  ${renderQuickWins(data.quickWins)}

  <section class="block">
    <h2>Détails par section</h2>
    ${(data.sections || []).map(renderSection).join("") || `<div class="empty">Aucune section.</div>`}
  </section>

  ${renderPlan(data.plan)}

  <footer>
    ${data.footer ? `${escapeHtml(data.footer)} · ` : ""}Hearst OS · ${escapeHtml(date)}
  </footer>
</div>
</body>
</html>`;
}
