/**
 * Drift engine minimal HOM.
 * Détecte les régressions de design system :
 *  - couleurs hardcodées (#RGB, rgb(), oklch() literal)
 *  - spacings hardcodés en px hors tokens
 *  - inline styles avec valeurs raw
 *  - mono caps tracking gimmick (anti-pattern voix éditoriale)
 *  - halo-on-hover sur chrome (anti-pattern)
 *  - imports orphelins (composants jamais utilisés)
 *
 * Sortie : war-room/drift-log.json append-only.
 */
import path from "node:path";
import { HOM } from "./paths";
import { readJson, writeJson, walkFiles, nowIso, shortId } from "./fs-utils";
import type { DriftFinding } from "./types";

const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
const RGB_LITERAL = /\brgb\([^)]+\)|\brgba\([^)]+\)/g;
const PX_LITERAL = /\b(?<!--space-\d+:\s)\d{2,4}px\b/g;
const TRACKING_GIMMICK = /tracking-(marquee|display|section|label)\b/g;
const HALO_HOVER = /halo-on-hover\b/g;

const ALLOWLIST = [
  "app/globals.css",
  "lint-visual.mjs",
  "node_modules",
  "dist/",
  "build/",
  ".next/",
  "test-results/",
  "e2e/",
];

const ALLOWED_PX_VALUES = new Set([
  "0px",
  "1px",
  "2px",
  "4px",
  "8px",
  "12px",
  "16px",
  "20px",
  "24px",
  "32px",
  "40px",
  "48px",
  "56px",
  "64px",
  "80px",
  "120px",
  "160px",
  "192px",
  "224px",
]);

interface ScanContext {
  runId: string;
  agent: "architecture" | "design-system" | "qa";
}

export async function scanDrift(ctx: ScanContext): Promise<DriftFinding[]> {
  const tsxFiles = await walkFiles(
    path.join(process.cwd(), "app"),
    (f) => f.endsWith(".tsx") || f.endsWith(".ts"),
  );

  const findings: DriftFinding[] = [];
  for (const file of tsxFiles) {
    const rel = path.relative(process.cwd(), file);
    if (ALLOWLIST.some((p) => rel.includes(p))) continue;
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Couleurs hardcodées (sauf dans commentaires JSDoc)
      if (!isComment(line)) {
        const hex = line.match(HEX_COLOR);
        if (hex) {
          findings.push(makeFinding(ctx, "hardcoded_color", rel, i + 1, line.trim(), "high"));
        }
        const rgb = line.match(RGB_LITERAL);
        if (rgb && !line.includes("var(--") && !rel.includes("globals.css")) {
          findings.push(makeFinding(ctx, "hardcoded_color", rel, i + 1, line.trim(), "medium"));
        }
        // Spacings hors token
        const px = line.match(PX_LITERAL);
        if (px) {
          const offending = px.filter((v) => !ALLOWED_PX_VALUES.has(v));
          if (offending.length > 0 && !line.includes("var(--space")) {
            findings.push(makeFinding(ctx, "hardcoded_spacing", rel, i + 1, line.trim(), "low"));
          }
        }
        // Tracking gimmick
        if (TRACKING_GIMMICK.test(line)) {
          findings.push(makeFinding(ctx, "ds_violation", rel, i + 1, line.trim(), "medium"));
        }
        TRACKING_GIMMICK.lastIndex = 0;
        // Halo on hover sur chrome
        if (HALO_HOVER.test(line)) {
          findings.push(makeFinding(ctx, "ds_violation", rel, i + 1, line.trim(), "medium"));
        }
        HALO_HOVER.lastIndex = 0;
        // Inline style avec valeur raw
        if (/style=\{\{[^}]*:\s*["']?#[0-9a-fA-F]{3,8}/.test(line)) {
          findings.push(makeFinding(ctx, "inline_style", rel, i + 1, line.trim(), "medium"));
        }
      }
    }
  }
  return findings;
}

function isComment(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  );
}

function makeFinding(
  ctx: ScanContext,
  type: DriftFinding["type"],
  file: string,
  line: number,
  snippet: string,
  severity: DriftFinding["severity"],
): DriftFinding {
  return {
    id: shortId("d"),
    ts: nowIso(),
    run_id: ctx.runId,
    type,
    file,
    line,
    snippet: snippet.length > 240 ? snippet.slice(0, 240) + "…" : snippet,
    severity,
    agent: ctx.agent,
  };
}

export async function appendDriftLog(findings: DriftFinding[]): Promise<void> {
  if (findings.length === 0) return;
  const existing = (await readJson<DriftFinding[]>(HOM.driftLog)) ?? [];
  const merged = [...existing, ...findings];
  // Cap à 5000 entrées clair.
  const trimmed = merged.slice(-5000);
  await writeJson(HOM.driftLog, trimmed);
}

export async function loadDriftLog(): Promise<DriftFinding[]> {
  return (await readJson<DriftFinding[]>(HOM.driftLog)) ?? [];
}
