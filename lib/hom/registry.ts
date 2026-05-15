/**
 * System Registry — vérité structurelle du repo agrégée.
 * Lit l'arborescence + audits + drift + trust + tests pour produire
 * une vue unifiée alimentant /admin/orchestrator/registry.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { loadAllContracts } from "./contracts";
import { loadDriftLog } from "./drift";
import { fileExists, listDir, readJson, walkFiles } from "./fs-utils";
import { HOM } from "./paths";
import { latestScores } from "./trust";
import type { AgentContract, TrustScores } from "./types";

export interface RegistryEntry {
  kind: "page" | "component" | "api-route" | "test" | "store";
  path: string;
  owner: string | null;
  drift_findings: number;
  has_test: boolean;
}

export interface RegistrySnapshot {
  generated_at: string;
  totals: {
    pages: number;
    components: number;
    api_routes: number;
    tests: number;
    stores: number;
    drift_findings: number;
  };
  trust: TrustScores;
  agents: AgentContract[];
  features: Array<{ id: string; status: string }>;
  entries: RegistryEntry[];
  driftByFile: Record<string, number>;
}

const ROOT = process.cwd();

export async function buildRegistry(): Promise<RegistrySnapshot> {
  const [pages, components, apiRoutes, tests, stores] = await Promise.all([
    findPages(),
    findComponents(),
    findApiRoutes(),
    findTests(),
    findStores(),
  ]);

  const drift = await loadDriftLog();
  const trust = await latestScores();
  const agents = await loadAllContracts();
  const features = await loadFeatures();

  const driftByFile: Record<string, number> = {};
  for (const d of drift) {
    driftByFile[d.file] = (driftByFile[d.file] ?? 0) + 1;
  }

  const entries: RegistryEntry[] = [
    ...pages.map((p) => makeEntry("page", p, agents, driftByFile, tests)),
    ...components.map((p) => makeEntry("component", p, agents, driftByFile, tests)),
    ...apiRoutes.map((p) => makeEntry("api-route", p, agents, driftByFile, tests)),
    ...tests.map((p) => makeEntry("test", p, agents, driftByFile, tests)),
    ...stores.map((p) => makeEntry("store", p, agents, driftByFile, tests)),
  ];

  return {
    generated_at: new Date().toISOString(),
    totals: {
      pages: pages.length,
      components: components.length,
      api_routes: apiRoutes.length,
      tests: tests.length,
      stores: stores.length,
      drift_findings: drift.length,
    },
    trust,
    agents,
    features,
    entries,
    driftByFile,
  };
}

function makeEntry(
  kind: RegistryEntry["kind"],
  abs: string,
  agents: AgentContract[],
  driftByFile: Record<string, number>,
  tests: string[],
): RegistryEntry {
  const rel = path.relative(ROOT, abs);
  const owner = inferOwner(rel, agents);
  return {
    kind,
    path: rel,
    owner,
    drift_findings: driftByFile[rel] ?? 0,
    has_test: hasMatchingTest(rel, tests),
  };
}

function inferOwner(rel: string, agents: AgentContract[]): string | null {
  // Match files_allowed first, ignoring globs that match too widely.
  for (const a of agents) {
    if (a.scope.files_allowed.some((g) => globMatch(g, rel))) {
      return a.agent_id;
    }
  }
  return null;
}

function globMatch(pattern: string, file: string): boolean {
  if (pattern === file) return true;
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*") +
      "$",
  );
  return re.test(file);
}

function hasMatchingTest(rel: string, tests: string[]): boolean {
  const base = path.basename(rel).replace(/\.tsx?$/, "");
  return tests.some((t) => path.basename(t).includes(base));
}

async function findPages(): Promise<string[]> {
  return walkFiles(path.join(ROOT, "app"), (f) => f.endsWith("/page.tsx"));
}

async function findComponents(): Promise<string[]> {
  return walkFiles(
    path.join(ROOT, "app"),
    (f) =>
      f.endsWith(".tsx") &&
      !f.endsWith("/page.tsx") &&
      !f.endsWith("/layout.tsx") &&
      !f.endsWith("/loading.tsx") &&
      !f.endsWith("/error.tsx") &&
      !f.endsWith("/not-found.tsx"),
  );
}

async function findApiRoutes(): Promise<string[]> {
  return walkFiles(path.join(ROOT, "app", "api"), (f) => f.endsWith("/route.ts"));
}

async function findTests(): Promise<string[]> {
  const a = await walkFiles(
    path.join(ROOT, "__tests__"),
    (f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"),
  );
  const b = await walkFiles(path.join(ROOT, "e2e"), (f) => f.endsWith(".spec.ts"));
  return [...a, ...b];
}

async function findStores(): Promise<string[]> {
  if (!(await fileExists(path.join(ROOT, "stores")))) return [];
  return walkFiles(path.join(ROOT, "stores"), (f) => f.endsWith(".ts"));
}

async function loadFeatures(): Promise<Array<{ id: string; status: string }>> {
  const manifest = path.join(ROOT, "docs", "features", "_manifest.json");
  type Manifest = {
    features?: Array<{ id?: string; slug?: string; status?: string }>;
  };
  const data = await readJson<Manifest>(manifest);
  if (!data || !Array.isArray(data.features)) return [];
  return data.features
    .map((f) => ({
      id: String(f.id ?? f.slug ?? ""),
      status: String(f.status ?? "unknown"),
    }))
    .filter((f) => f.id);
}

export async function listRuns(): Promise<
  Array<{ run_id: string; created_at: string; decision: string | null }>
> {
  if (!(await fileExists(HOM.runs))) return [];
  const entries = await listDir(HOM.runs);
  const out: Array<{ run_id: string; created_at: string; decision: string | null }> = [];
  for (const id of entries) {
    if (id.startsWith(".")) continue;
    if (!id.startsWith("r-")) continue;
    let intake: { created_at: string } | null = null;
    try {
      intake = await readJson<{ created_at: string }>(HOM.runIntake(id));
    } catch {
      continue;
    }
    if (!intake) continue;
    const decision = await readJson<{ decision: string }>(HOM.runDecision(id)).catch(() => null);
    out.push({
      run_id: id,
      created_at: intake.created_at,
      decision: decision?.decision ?? null,
    });
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function readRunBundle(runId: string) {
  const intake = await readJson(HOM.runIntake(runId));
  const decision = await readJson(HOM.runDecision(runId));
  const snapshot = await readJson(HOM.runSnapshot(runId));
  let events = "";
  try {
    events = await fs.readFile(HOM.runEvents(runId), "utf8");
  } catch {
    /* no events */
  }
  return { intake, decision, snapshot, events };
}
