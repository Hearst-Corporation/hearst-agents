#!/usr/bin/env node
/**
 * Build features manifest — parse docs/features/*.md → docs/features/_manifest.json
 *
 * Source de vérité pour le dashboard /admin/agent-driven-dev.
 * Chaque spec MD a une table "## Métadonnées" parsée comme métadonnées clé/valeur.
 *
 * Run : npm run features:manifest
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FEATURES_DIR = path.join(ROOT, "docs", "features");
const MANIFEST_PATH = path.join(FEATURES_DIR, "_manifest.json");

const SKIP_FILES = new Set(["_template.md", "_manifest.json"]);

const META_LINE_RE = /^\|\s*\*\*([^*]+?)\*\*\s*\|\s*(.+?)\s*\|\s*$/;
const SECTION_RE = /^##\s+(.+?)\s*$/;
const SUBSECTION_RE = /^###\s+(.+?)\s*$/;

function cleanValue(raw) {
  return raw
    .replace(/^`(.+)`$/, "$1")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/`/g, "")
    .trim();
}

function normalizeStatut(raw) {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("verrouillé") || lower.includes("locked")) return "verrouillé";
  if (lower.includes("in_progress") || lower.includes("in progress")) return "in_progress";
  if (lower.includes("review")) return "review";
  if (lower.includes("legacy")) return "legacy";
  if (lower.includes("active")) return "active";
  return lower.split(/\s+/)[0] ?? "unknown";
}

function extractVersion(raw) {
  if (!raw) return null;
  const m = raw.match(/v?(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

/**
 * Découpe le texte en sections (par titre `## `).
 * Retourne `{ [sectionTitle]: string[] }` (lignes sans le titre).
 */
function splitSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = {};
  let current = null;
  for (const line of lines) {
    const m = line.match(SECTION_RE);
    if (m) {
      current = m[1];
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function parseMetadataTable(lines) {
  const meta = {};
  for (const line of lines) {
    const m = line.match(META_LINE_RE);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const value = cleanValue(m[2]);
    meta[key] = value;
  }
  return meta;
}

function countSubsections(lines) {
  return lines.filter((l) => SUBSECTION_RE.test(l)).length;
}

function listSubsections(lines) {
  return lines
    .filter((l) => SUBSECTION_RE.test(l))
    .map((l) => l.match(SUBSECTION_RE)[1]);
}

/**
 * Compte les bullets `- ` directement dans une sous-section,
 * jusqu'à la prochaine sous-section ou fin de section.
 */
function countBulletsInSubsection(lines, subsectionTitle) {
  let inSubsection = false;
  let count = 0;
  for (const line of lines) {
    if (SUBSECTION_RE.test(line)) {
      const title = line.match(SUBSECTION_RE)[1];
      if (inSubsection) break;
      if (title.toLowerCase().includes(subsectionTitle.toLowerCase())) {
        inSubsection = true;
      }
      continue;
    }
    if (inSubsection && /^\s*-\s+/.test(line)) count += 1;
  }
  return count;
}

function classifyTestGap(missingCount) {
  if (missingCount >= 10) return "élevé";
  if (missingCount >= 4) return "moyen";
  if (missingCount > 0) return "faible";
  return "aucun";
}

async function parseFeatureFile(filename) {
  const filePath = path.join(FEATURES_DIR, filename);
  const content = await fs.readFile(filePath, "utf-8");
  const sections = splitSections(content);

  const metaLines = sections["Métadonnées"] ?? [];
  const meta = parseMetadataTable(metaLines);

  const invariantsLines = sections["Invariants verrouillés"] ?? [];
  const invariantsCount = countSubsections(invariantsLines);
  const invariantsTitles = listSubsections(invariantsLines);

  const testsLines = sections["Tests"] ?? [];
  const testsExistantsCount = countBulletsInSubsection(testsLines, "Existants");
  const testsManquantsCount = countBulletsInSubsection(testsLines, "Manquants");

  const orphansLines = sections["Code orphelin (code-ready non câblé)"] ?? [];
  const orphansCount = orphansLines.filter((l) => /^\s*-\s+/.test(l)).length;

  const id = meta.id ?? path.basename(filename, ".md");
  const statutRaw = meta.statut ?? "non verrouillé";
  const statut = normalizeStatut(statutRaw);
  const niveau = meta.niveau ?? meta["niveau"] ?? null;

  return {
    id,
    file: filename,
    href: `docs/features/${filename}`,
    statut,
    statutRaw,
    version: extractVersion(meta["version spec"]),
    owner: meta.owner ?? null,
    derniereRevue: meta["dernière revue"] ?? null,
    niveau: niveau ? niveau.replace(/\*\*/g, "").split("—")[0].trim() : null,
    invariantsCount,
    invariantsTitles,
    testsExistantsCount,
    testsManquantsCount,
    testGap: classifyTestGap(testsManquantsCount),
    orphansCount,
  };
}

async function main() {
  const files = (await fs.readdir(FEATURES_DIR)).filter(
    (f) => f.endsWith(".md") && !SKIP_FILES.has(f)
  );

  const features = [];
  for (const f of files.sort()) {
    try {
      const parsed = await parseFeatureFile(f);
      features.push(parsed);
    } catch (e) {
      console.error(`[features:manifest] Skip ${f}: ${e.message}`);
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    total: features.length,
    counts: {
      verrouillé: features.filter((x) => x.statut === "verrouillé").length,
      in_progress: features.filter((x) => x.statut === "in_progress").length,
      review: features.filter((x) => x.statut === "review").length,
      active: features.filter((x) => x.statut === "active").length,
      autres: features.filter(
        (x) => !["verrouillé", "in_progress", "review", "active"].includes(x.statut)
      ).length,
    },
    totals: {
      invariants: features.reduce((sum, x) => sum + x.invariantsCount, 0),
      testsExistants: features.reduce((sum, x) => sum + x.testsExistantsCount, 0),
      testsManquants: features.reduce((sum, x) => sum + x.testsManquantsCount, 0),
      orphans: features.reduce((sum, x) => sum + x.orphansCount, 0),
    },
    features,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `[features:manifest] ${features.length} features → ${path.relative(ROOT, MANIFEST_PATH)}`
  );
}

main().catch((e) => {
  console.error("[features:manifest] Failed:", e);
  process.exit(1);
});
