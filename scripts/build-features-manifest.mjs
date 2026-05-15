#!/usr/bin/env node
/**
 * Build features manifest — parse docs/features/*.md → docs/features/_manifest.json
 *
 * Source de vérité pour le dashboard /admin/agent-driven-dev.
 * Deux couches de données :
 *
 *   1. Données documentaires (spec MD) : invariants, testGap déclaré, orphelins.
 *      Les "testsManquants" viennent des bullet points ### Manquants dans les specs.
 *      Ce sont des intentions documentées, pas l'exhaustivité des gaps réels.
 *
 *   2. Données filesystem (réalité disque) : nombre de fichiers .test.ts/tsx dans
 *      __tests__/ qui importent des chemins liés à chaque feature, et count de
 *      cas it/test réels. Ces chiffres reflètent ce qui tourne vraiment.
 *
 * Le manifest expose les deux pour que le dashboard les affiche sans les confondre.
 *
 * Run : npm run features:manifest
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FEATURES_DIR = path.join(ROOT, "docs", "features");
const TESTS_DIR = path.join(ROOT, "__tests__");
const MANIFEST_PATH = path.join(FEATURES_DIR, "_manifest.json");

const SKIP_FILES = new Set(["_template.md", "_manifest.json"]);

const META_LINE_RE = /^\|\s*\*\*([^*]+?)\*\*\s*\|\s*(.+?)\s*\|\s*$/;
const SECTION_RE = /^##\s+(.+?)\s*$/;
const SUBSECTION_RE = /^###\s+(.+?)\s*$/;

// ── Mapping feature id → chemins de test canoniques ──────────────────────────
//
// Pour chaque feature, liste les dossiers ou patterns dans __tests__/ qui lui
// correspondent. Best-effort : couvre les vrais cas, pas exhaustif.
// Un fichier peut être compté dans plusieurs features s'il teste plusieurs
// domaines (ex. orchestrator/ couvre à la fois chat et missions).
//
const FEATURE_TEST_DIRS = {
  auth: ["platform/auth", "stores/selection"],
  chat: [
    "chat",
    "orchestrator",
    "stores/runtime",
    "stores/chat-context",
    "stores/working-document",
  ],
  cockpit: ["cockpit", "right-panel"],
  stage: ["stores/stage", "stores/focal", "ui/context-rail"],
  missions: ["api/missions", "engine", "orchestrator/schedule-tool", "orchestrator/run-planner"],
  assets: [
    "assets",
    "runtime/assets",
    "api/assets",
    "jobs/audio-gen",
    "jobs/image-gen",
    "jobs/video-gen",
  ],
  connections: ["connectors", "connections", "composio"],
  "memory-kg": ["memory", "embeddings"],
  reports: ["reports", "api/reports-specs"],
  runs: ["api/usage-today", "engine/runs"],
  personas: ["personas"],
  notifications: ["notifications"],
  webhooks: ["webhooks"],
  workflows: ["workflows"],
  voice: ["voice"],
  meetings: ["meeting", "meetings"],
  "daily-brief": ["daily-brief", "inbox"],
  commandeur: ["components/commandeur"],
  settings: ["settings", "platform/settings"],
  "timeline-rail": ["ui/thread"],
  marketplace: ["marketplace", "api/marketplace"],
  onboarding: ["components"],
  pulsebar: [],
  planner: ["engine"],
  simulation: [],
  artifact: ["ui/asset"],
  datasets: [],
  electron: [],
  admin: ["admin"],
  "context-rail": ["ui/context-rail", "right-panel"],
  browser: ["browser"],
  hospitality: ["verticals/hospitality"],
};

// ── Scan __tests__/ pour obtenir les vrais chiffres ───────────────────────────

async function getAllTestFiles() {
  const result = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (/\.test\.(ts|tsx)$/.test(e.name)) result.push(full);
    }
  }
  await walk(TESTS_DIR);
  return result;
}

/** Compte les cas de test (it/test) dans un fichier. */
async function countTestCasesInFile(filePath) {
  const content = await fs.readFile(filePath, "utf-8").catch(() => "");
  const matches = content.match(/^\s*(it|test)\s*\(/gm);
  return matches ? matches.length : 0;
}

/** Trouve les fichiers de test correspondant à une feature. */
function matchTestFilesForFeature(featureId, allTestFiles) {
  const patterns = FEATURE_TEST_DIRS[featureId] ?? [];
  if (patterns.length === 0) {
    // Fallback : cherche __tests__/{featureId}/ ou *{featureId}*
    const lc = featureId.toLowerCase().replace(/-/g, "[-_]?");
    return allTestFiles.filter((f) => {
      const rel = path.relative(TESTS_DIR, f).toLowerCase();
      return (
        rel.startsWith(`${lc}/`) ||
        rel.startsWith(`${lc}.`) ||
        rel.includes(`/${lc}/`) ||
        rel.includes(`/${lc}.`)
      );
    });
  }
  return allTestFiles.filter((f) => {
    const rel = path.relative(TESTS_DIR, f).toLowerCase().replace(/\\/g, "/");
    return patterns.some((p) => {
      const lp = p.toLowerCase();
      return (
        rel.startsWith(`${lp}/`) ||
        rel.startsWith(`${lp}.`) ||
        rel.includes(`/${lp}/`) ||
        rel.includes(`/${lp}.`)
      );
    });
  });
}

// ── Parsers spec MD ───────────────────────────────────────────────────────────

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
    meta[m[1].trim().toLowerCase()] = cleanValue(m[2]);
  }
  return meta;
}

function countSubsections(lines) {
  return lines.filter((l) => SUBSECTION_RE.test(l)).length;
}

function listSubsections(lines) {
  return lines.filter((l) => SUBSECTION_RE.test(l)).map((l) => l.match(SUBSECTION_RE)[1]);
}

function countBulletsInSubsection(lines, subsectionTitle) {
  let inSubsection = false;
  let count = 0;
  for (const line of lines) {
    if (SUBSECTION_RE.test(line)) {
      const title = line.match(SUBSECTION_RE)[1];
      if (inSubsection) break;
      if (title.toLowerCase().includes(subsectionTitle.toLowerCase())) inSubsection = true;
      continue;
    }
    if (inSubsection && /^\s*-\s+/.test(line)) count += 1;
  }
  return count;
}

// ── Parse feature + enrichissement filesystem ─────────────────────────────────

async function parseFeatureFile(filename, allTestFiles) {
  const filePath = path.join(FEATURES_DIR, filename);
  const content = await fs.readFile(filePath, "utf-8");
  const sections = splitSections(content);

  const metaLines = sections.Métadonnées ?? [];
  const meta = parseMetadataTable(metaLines);

  const invariantsLines = sections["Invariants verrouillés"] ?? [];
  const invariantsCount = countSubsections(invariantsLines);
  const invariantsTitles = listSubsections(invariantsLines);

  const testsLines = sections.Tests ?? [];
  // Chiffres documentaires (bullet points dans les specs — intention, pas réalité)
  const testsDocExistants = countBulletsInSubsection(testsLines, "Existants");
  const testsManquantsCount = countBulletsInSubsection(testsLines, "Manquants");

  const orphansLines = sections["Code orphelin (code-ready non câblé)"] ?? [];
  const orphansCount = orphansLines.filter((l) => /^\s*-\s+/.test(l)).length;

  const id = meta.id ?? path.basename(filename, ".md");
  const statutRaw = meta.statut ?? "non verrouillé";
  const statut = normalizeStatut(statutRaw);
  const niveau = meta.niveau ?? null;

  // Chiffres filesystem (réalité disque)
  const matchedFiles = matchTestFilesForFeature(id, allTestFiles);
  let testsOnDisk = 0;
  for (const f of matchedFiles) {
    testsOnDisk += await countTestCasesInFile(f);
  }

  // testsExistantsCount = filesystem si > 0, sinon doc (rétrocompat dashboard)
  const testsExistantsCount = testsOnDisk > 0 ? testsOnDisk : testsDocExistants;

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
    // Filesystem (source de vérité)
    testsExistantsCount,
    testsOnDisk,
    testFilesOnDisk: matchedFiles.length,
    // Documentaire (intention spec)
    testsDocExistants,
    testsManquantsCount,
    testGap:
      testsOnDisk === 0 && testsManquantsCount === 0
        ? "aucun"
        : testsOnDisk === 0
          ? "élevé"
          : testsManquantsCount >= 10
            ? "moyen"
            : testsManquantsCount >= 4
              ? "faible"
              : "aucun",
    orphansCount,
  };
}

// ── Totaux réels disque ───────────────────────────────────────────────────────

async function getActualTestTotals(allTestFiles) {
  let totalCases = 0;
  for (const f of allTestFiles) totalCases += await countTestCasesInFile(f);
  return { files: allTestFiles.length, cases: totalCases };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allTestFiles = await getAllTestFiles();
  const actualTotals = await getActualTestTotals(allTestFiles);

  const specFiles = (await fs.readdir(FEATURES_DIR)).filter(
    (f) => f.endsWith(".md") && !SKIP_FILES.has(f),
  );

  const features = [];
  for (const f of specFiles.sort()) {
    try {
      features.push(await parseFeatureFile(f, allTestFiles));
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
        (x) => !["verrouillé", "in_progress", "review", "active"].includes(x.statut),
      ).length,
    },
    // Chiffres documentaires (bullet points dans les specs — intention)
    totals: {
      invariants: features.reduce((sum, x) => sum + x.invariantsCount, 0),
      testsExistants: features.reduce((sum, x) => sum + x.testsExistantsCount, 0),
      testsManquants: features.reduce((sum, x) => sum + x.testsManquantsCount, 0),
      orphans: features.reduce((sum, x) => sum + x.orphansCount, 0),
    },
    // Réalité disque — source de vérité
    actualTests: {
      files: actualTotals.files,
      cases: actualTotals.cases,
      note: "Scan __tests__/**/*.test.ts(x) — reflète ce qui tourne vraiment",
    },
    features,
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[features:manifest] ${features.length} features | ` +
      `${actualTotals.files} test files | ${actualTotals.cases} test cases → ${path.relative(ROOT, MANIFEST_PATH)}`,
  );
}

main().catch((e) => {
  console.error("[features:manifest] Failed:", e);
  process.exit(1);
});
