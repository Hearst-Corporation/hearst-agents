/**
 * War Room snapshot generator — HTML statique self-contained.
 * Vit dans hom/war-room/snapshots/<run-id>/index.html.
 * Pas de JS, pas de fonts externes, CSS inline pour archivage offline.
 * Indexé dans hom/war-room/index.json.
 */
import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { HOM } from "./paths";
import { ensureDir, readJson, sha256, writeJson, nowIso } from "./fs-utils";
import type { RunDecisionFile, TrustScores } from "./types";

interface SnapshotIndexEntry {
  run_id: string;
  generated_at: string;
  decision: string;
  hash: string;
  path: string;
}

export async function generateWarRoomSnapshot(
  runId: string,
  decision: RunDecisionFile,
): Promise<string> {
  const dir = HOM.warRoomSnapshot(runId);
  await ensureDir(dir);
  const html = renderHTML(runId, decision);
  const file = path.join(dir, "index.html");
  await fs.writeFile(file, html, "utf8");

  const manifest = {
    run_id: runId,
    generated_at: nowIso(),
    decision: decision.decision,
    files: ["index.html"],
    hash: sha256(html),
  };
  await writeJson(path.join(dir, "manifest.json"), manifest);

  await appendIndex({
    run_id: runId,
    generated_at: manifest.generated_at,
    decision: decision.decision,
    hash: manifest.hash,
    path: path.relative(process.cwd(), file),
  });

  return path.relative(process.cwd(), file);
}

async function appendIndex(entry: SnapshotIndexEntry): Promise<void> {
  const list = (await readJson<SnapshotIndexEntry[]>(HOM.warRoomIndex)) ?? [];
  list.push(entry);
  await writeJson(HOM.warRoomIndex, list);
}

function renderHTML(runId: string, d: RunDecisionFile): string {
  const trust = d.trust_after as TrustScores;
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const trustRows = (Object.entries(trust) as [keyof TrustScores, number][])
    .map(
      ([k, v]) => `
        <div class="trust-cell">
          <div class="trust-key">${escape(k)}</div>
          <div class="trust-value ${v >= 90 ? "ok" : v >= 75 ? "warn" : "bad"}">${v}</div>
        </div>`,
    )
    .join("");

  const severityRows = (Object.entries(d.severity_stack) as [string, number][])
    .map(
      ([k, v]) => `
        <div class="sev-cell">
          <div class="sev-key">${escape(k)}</div>
          <div class="sev-value ${k === "critical" || k === "high" ? "bad" : k === "medium" ? "warn" : "ok"}">${v}</div>
        </div>`,
    )
    .join("");

  const agentRows = d.agents
    .map(
      (a) => `
        <tr>
          <td>${escape(a.agent)}</td>
          <td><span class="status status-${a.status}">${escape(a.status)}</span></td>
          <td>${a.score}</td>
          <td>${escape(a.severity_max)}</td>
          <td>${a.findings_count}</td>
          <td>${a.duration_ms}ms</td>
          <td>${a.report_path ? `<code>${escape(a.report_path)}</code>` : "—"}</td>
        </tr>`,
    )
    .join("");

  const blockers =
    d.blockers.length === 0
      ? '<p class="muted">Aucun blocker.</p>'
      : `<ul>${d.blockers.map((b) => `<li>${escape(b)}</li>`).join("")}</ul>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>HOM Snapshot — ${runId}</title>
<style>
  :root {
    --bg: #050709;
    --bg-elev: #131318;
    --bg-soft: #1B1B22;
    --line: rgba(255,255,255,0.06);
    --line-strong: rgba(255,255,255,0.12);
    --text: #ffffff;
    --text-muted: rgba(255,255,255,0.65);
    --text-faint: rgba(255,255,255,0.45);
    --accent-teal: #4A8B86;
    --gold: #C8A961;
    --warn: #ffcc00;
    --danger: #ff3333;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 64px 48px;
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 24px; margin-bottom: 32px; }
  h1 { font-size: 22px; font-weight: 300; margin: 0 0 4px 0; letter-spacing: -0.01em; }
  h2 { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.18em;
       color: var(--text-faint); margin: 32px 0 12px 0; }
  .meta { color: var(--text-muted); font-size: 12px; font-family: ui-monospace, monospace; }
  .meta span { margin-right: 16px; }
  .status {
    display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px;
    font-family: ui-monospace, monospace; text-transform: lowercase;
  }
  .status-green { background: rgba(74,139,134,0.15); color: var(--accent-teal); }
  .status-amber { background: rgba(255,204,0,0.15); color: var(--warn); }
  .status-red { background: rgba(255,51,51,0.15); color: var(--danger); }
  .status-quarantined { background: rgba(167,139,250,0.15); color: #a78bfa; }
  .status-stale { background: rgba(255,255,255,0.06); color: var(--text-faint); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  .trust-cell, .sev-cell {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px;
  }
  .trust-key, .sev-key {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-faint);
    margin-bottom: 8px;
  }
  .trust-value, .sev-value {
    font-size: 28px;
    font-weight: 300;
  }
  .ok { color: var(--accent-teal); }
  .warn { color: var(--warn); }
  .bad { color: var(--danger); }
  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  th, td {
    text-align: left;
    padding: 12px 16px;
    font-size: 12px;
    border-bottom: 1px solid var(--line);
  }
  th { color: var(--text-faint); font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; }
  tr:last-child td { border-bottom: 0; }
  code { font-family: ui-monospace, monospace; font-size: 11px; color: var(--text-muted); }
  .muted { color: var(--text-faint); }
  .decision-pill {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .decision-release_candidate { background: rgba(74,139,134,0.15); color: var(--accent-teal); }
  .decision-needs_review { background: rgba(255,204,0,0.15); color: var(--warn); }
  .decision-release_blocked { background: rgba(255,51,51,0.15); color: var(--danger); }
  .decision-aborted { background: rgba(255,255,255,0.06); color: var(--text-faint); }
  .signature { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--text-faint); font-size: 11px; font-family: ui-monospace, monospace; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Hearst Operations Mesh — Run snapshot</h1>
    <div class="meta">
      <span>${escape(runId)}</span>
      <span>${escape(d.started_at)} → ${escape(d.ended_at)}</span>
      <span class="decision-pill decision-${escape(d.decision)}">${escape(d.decision)}</span>
    </div>
  </header>

  <section>
    <h2>Trust scores</h2>
    <div class="grid">${trustRows}</div>
  </section>

  <section>
    <h2>Severity stack</h2>
    <div class="grid">${severityRows}</div>
  </section>

  <section>
    <h2>Agents</h2>
    <table>
      <thead>
        <tr>
          <th>Agent</th><th>Status</th><th>Score</th><th>Severity max</th>
          <th>Findings</th><th>Durée</th><th>Rapport</th>
        </tr>
      </thead>
      <tbody>${agentRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Blockers</h2>
    ${blockers}
  </section>

  <section>
    <h2>Drift findings cumulés</h2>
    <p>${d.drift_findings} drift finding(s) actifs dans le journal.</p>
  </section>

  <div class="signature">
    Signed by <code>${escape(d.signed_by)}</code> · hash <code>${escape(d.hash)}</code>
  </div>
</div>
</body>
</html>`;
}
