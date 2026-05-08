#!/usr/bin/env node
/**
 * features-test — lance vitest uniquement sur les tests d'une feature.
 *
 * Usage :
 *   node scripts/features-test.mjs chat
 *   node scripts/features-test.mjs auth missions
 *   node scripts/features-test.mjs --list          (affiche le mapping)
 *
 * Alias npm :
 *   npm run features:test -- chat
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

// Même mapping que build-features-manifest.mjs — chemins relatifs à __tests__/
const FEATURE_TEST_DIRS = {
  auth:            ["platform/auth", "stores/selection"],
  chat:            ["chat", "orchestrator", "stores/runtime", "stores/chat-context", "stores/working-document"],
  cockpit:         ["cockpit", "right-panel"],
  stage:           ["stores/stage", "stores/focal", "ui/context-rail"],
  missions:        ["api/missions", "engine", "orchestrator/schedule-tool", "orchestrator/run-planner"],
  assets:          ["assets", "runtime/assets", "api/assets", "jobs/audio-gen", "jobs/image-gen", "jobs/video-gen"],
  connections:     ["connectors", "connections", "composio"],
  "memory-kg":     ["memory", "embeddings"],
  reports:         ["reports", "api/reports-specs"],
  runs:            ["api/usage-today", "engine/runs"],
  personas:        ["personas"],
  notifications:   ["notifications"],
  webhooks:        ["webhooks"],
  workflows:       ["workflows"],
  voice:           ["voice"],
  meetings:        ["meeting", "meetings"],
  "daily-brief":   ["daily-brief", "inbox"],
  commandeur:      ["components/commandeur"],
  settings:        ["settings", "platform/settings"],
  "timeline-rail": ["ui/thread"],
  marketplace:     ["marketplace", "api/marketplace"],
  onboarding:      ["components"],
  pulsebar:        [],
  planner:         ["engine"],
  simulation:      [],
  artifact:        ["ui/asset"],
  datasets:        [],
  electron:        [],
  admin:           ["admin"],
  "context-rail":  ["ui/context-rail", "right-panel"],
  browser:         ["browser"],
  hospitality:     ["verticals/hospitality"],
};

const args = process.argv.slice(2);

if (args.includes("--list")) {
  console.log("\nFeatures disponibles :\n");
  for (const [id, dirs] of Object.entries(FEATURE_TEST_DIRS)) {
    const paths = dirs.map((d) => `__tests__/${d}/`).join(", ");
    console.log(`  ${id.padEnd(20)} → ${paths || "(aucun)"}`);
  }
  console.log();
  process.exit(0);
}

if (args.length === 0) {
  console.error("Usage : npm run features:test -- <feature-id> [feature-id2...]");
  console.error("        npm run features:test -- --list");
  process.exit(1);
}

const testPaths = [];
const notFound = [];

for (const featureId of args) {
  const dirs = FEATURE_TEST_DIRS[featureId];
  if (dirs === undefined) {
    notFound.push(featureId);
    continue;
  }
  if (dirs.length === 0) {
    console.warn(`[features:test] ${featureId} : aucun test répertorié (0 test sur disque)`);
    continue;
  }
  for (const d of dirs) {
    testPaths.push(path.join(ROOT, "__tests__", d));
  }
}

if (notFound.length > 0) {
  console.error(`[features:test] Feature(s) inconnue(s) : ${notFound.join(", ")}`);
  console.error("  Utilisez --list pour voir les features disponibles.");
  process.exit(1);
}

if (testPaths.length === 0) {
  console.log("[features:test] Aucun chemin de test trouvé pour les features demandées.");
  process.exit(0);
}

const uniquePaths = [...new Set(testPaths)];
console.log(`\n[features:test] Running tests for: ${args.join(", ")}`);
console.log(`  Paths: ${uniquePaths.map((p) => path.relative(ROOT, p)).join(", ")}\n`);

try {
  execSync(
    `npx vitest run ${uniquePaths.map((p) => JSON.stringify(p)).join(" ")}`,
    { stdio: "inherit", cwd: ROOT }
  );
} catch {
  process.exit(1);
}
