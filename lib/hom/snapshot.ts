/**
 * Replay snapshot HOM — fige l'état du repo + politiques + contracts
 * au démarrage d'un run pour permettre un audit replay ultérieur.
 * V1.2 minimal : on capture les hashes, pas les contenus complets.
 */
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import { fileExists, nowIso, sha256, writeJson } from "./fs-utils";
import { HOM } from "./paths";
import type { ReplaySnapshot } from "./types";
import { ALL_AGENTS } from "./types";

async function gitInfo(): Promise<{ branch: string; commit: string; dirty: boolean }> {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    const commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    return { branch, commit, dirty: status.length > 0 };
  } catch {
    return { branch: "unknown", commit: "unknown", dirty: false };
  }
}

async function hashFiles(files: string[]): Promise<string> {
  const parts: string[] = [];
  for (const f of files) {
    if (await fileExists(f)) {
      const content = await fs.readFile(f, "utf8");
      parts.push(`${f}:${sha256(content)}`);
    }
  }
  return sha256(parts.join("\n"));
}

export async function captureSnapshot(runId: string): Promise<ReplaySnapshot> {
  const git = await gitInfo();

  const policiesHash = await hashFiles([HOM.fleetPolicy, HOM.releasePolicy]);

  const contractsHash = await hashFiles(ALL_AGENTS.map((id) => HOM.agentContract(id)));

  const promptsHash = await hashFiles(ALL_AGENTS.map((id) => HOM.agentPrompts(id)));

  const lockHash = await hashFiles([`${HOM.root}/../package-lock.json`]).catch(() => "absent");

  const snap: ReplaySnapshot = {
    run_id: runId,
    taken_at: nowIso(),
    git,
    policies_hash: policiesHash,
    contracts_hash: contractsHash,
    prompts_hash: promptsHash,
    node_version: process.version,
    package_lock_hash: lockHash,
  };

  await writeJson(HOM.runSnapshot(runId), snap);
  return snap;
}
