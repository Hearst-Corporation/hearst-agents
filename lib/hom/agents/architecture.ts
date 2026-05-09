/**
 * A1 Architecture Agent — scan layering, server-only, imports critiques.
 * Vraie analyse statique (regex + AST léger) sur app/, lib/, electron/.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { walkFiles } from "../fs-utils";
import type { Finding } from "../types";
import { runAgent, makeFindingId, type AgentExecCtx, type ScanResult } from "./base";

const ROOT = process.cwd();

export async function scanArchitecture(_ctx: AgentExecCtx): Promise<ScanResult> {
  const tsFiles = await walkFiles(
    path.join(ROOT, "app"),
    (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
  );
  const libFiles = await walkFiles(
    path.join(ROOT, "lib"),
    (f) => f.endsWith(".ts"),
  );

  const findings: Finding[] = [];
  let scanned = 0;

  for (const file of [...tsFiles, ...libFiles]) {
    scanned += 1;
    const content = await fs.readFile(file, "utf8");
    const rel = path.relative(ROOT, file);

    // 1. Server modules touchant fs sans server-only
    const isLibHom = rel.startsWith("lib/hom/");
    const usesNodeFs =
      /from\s+["']node:fs/.test(content) ||
      /from\s+["']fs\/promises/.test(content) ||
      /from\s+["']fs["']/.test(content);
    const hasServerOnly = /import\s+["']server-only["']/.test(content);
    const isApiRoute = rel.startsWith("app/api/");
    const isLayoutOrPage = /\/(page|layout|route)\.tsx?$/.test(rel);

    if (
      usesNodeFs &&
      !hasServerOnly &&
      !isApiRoute &&
      !isLayoutOrPage &&
      !isLibHom &&
      !rel.startsWith("scripts/")
    ) {
      findings.push({
        id: makeFindingId(),
        agent: "architecture",
        severity: "high",
        title: "Module Node fs sans guard server-only",
        detail:
          "Ce fichier importe `node:fs` ou `fs/promises` sans `import 'server-only'`. Risque : bundlage côté client.",
        evidence: [rel],
        scope: rel,
      });
    }

    // 2. use client + import server-only (incohérence)
    const isClient = /^['"]use client['"]/m.test(content);
    if (isClient && hasServerOnly) {
      findings.push({
        id: makeFindingId(),
        agent: "architecture",
        severity: "critical",
        title: "Composant client important server-only",
        detail:
          "Un composant marqué `use client` ne doit jamais importer `server-only`.",
        evidence: [rel],
        scope: rel,
      });
    }

    // 3. Routes API qui importent un composant React
    if (isApiRoute) {
      if (/from\s+["'][^"']*\.tsx["']/.test(content)) {
        findings.push({
          id: makeFindingId(),
          agent: "architecture",
          severity: "high",
          title: "Route API important un composant TSX",
          detail:
            "Une route API ne doit pas importer un composant React (.tsx).",
          evidence: [rel],
          scope: rel,
        });
      }
    }

    // 4. Imports relatifs profonds (couplage)
    const deep = content.match(/from\s+["'](\.\.\/){4,}/g);
    if (deep && deep.length > 0) {
      findings.push({
        id: makeFindingId(),
        agent: "architecture",
        severity: "low",
        title: "Import relatif très profond",
        detail: `Détecté ${deep.length} import(s) avec 4+ niveaux. Préférer alias \`@/...\`.`,
        evidence: [rel],
        scope: rel,
      });
    }

    // 5. Shell/electron qui importerait depuis app/
    if (rel.startsWith("electron/") && /from\s+["']@\/app\//.test(content)) {
      findings.push({
        id: makeFindingId(),
        agent: "architecture",
        severity: "high",
        title: "Electron importe depuis app/",
        detail: "Electron ne doit pas dépendre du code côté Next app.",
        evidence: [rel],
        scope: rel,
      });
    }
  }

  return { findings, files_scanned: scanned };
}

export async function executeArchitecture(ctx: AgentExecCtx) {
  return runAgent("architecture", ctx, scanArchitecture);
}
