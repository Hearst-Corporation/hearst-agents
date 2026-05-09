/**
 * A8 QA Agent — couverture tests + états UI obligatoires.
 * Pas de exécution `npm test` (sortie du périmètre runtime du run HOM),
 * mais audit statique : présence tests, états error/loading/empty.
 */
import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { walkFiles, fileExists } from "../fs-utils";
import type { Finding } from "../types";
import { runAgent, makeFindingId, type AgentExecCtx, type ScanResult } from "./base";

const ROOT = process.cwd();

export async function scanQa(_ctx: AgentExecCtx): Promise<ScanResult> {
  const findings: Finding[] = [];

  // 1. Pages admin/cockpit sans état error.tsx ou loading.tsx
  const pages = await walkFiles(
    path.join(ROOT, "app"),
    (f) => f.endsWith("/page.tsx"),
  );
  let scanned = 0;

  for (const page of pages) {
    scanned += 1;
    const dir = path.dirname(page);
    const rel = path.relative(ROOT, page);

    // Skip routes secondaires (groupes (foo))
    if (!rel.startsWith("app/admin") && !rel.startsWith("app/(user)")) continue;

    const hasError = await fileExists(path.join(dir, "error.tsx"));
    const hasLoading = await fileExists(path.join(dir, "loading.tsx"));
    if (!hasError) {
      findings.push({
        id: makeFindingId(),
        agent: "qa",
        severity: "medium",
        title: "Page sans error.tsx",
        detail: `La route \`${rel}\` n'a pas de boundary \`error.tsx\`.`,
        evidence: [rel],
        scope: rel,
      });
    }
    if (!hasLoading) {
      findings.push({
        id: makeFindingId(),
        agent: "qa",
        severity: "low",
        title: "Page sans loading.tsx",
        detail: `La route \`${rel}\` n'a pas de boundary \`loading.tsx\`.`,
        evidence: [rel],
        scope: rel,
      });
    }
  }

  // 2. Tests présents
  const tests = await walkFiles(
    path.join(ROOT, "__tests__"),
    (f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"),
  );
  if (tests.length === 0) {
    findings.push({
      id: makeFindingId(),
      agent: "qa",
      severity: "high",
      title: "Aucun test unitaire détecté",
      detail: "Le dossier __tests__ ne contient aucun fichier .test.ts(x).",
      evidence: ["__tests__/"],
      scope: "__tests__/",
    });
  }
  scanned += tests.length;

  // 3. Composants exportés non utilisés (orphelins simples)
  const components = await walkFiles(
    path.join(ROOT, "app"),
    (f) =>
      f.endsWith(".tsx") &&
      !f.endsWith("/page.tsx") &&
      !f.endsWith("/layout.tsx") &&
      !f.endsWith("/loading.tsx") &&
      !f.endsWith("/error.tsx"),
  );

  // Index des imports : on lit chaque fichier, repère les imports de
  // type `from '@/...' ou './foo'` et on fait le diff.
  const allTsx = [...components, ...pages];
  const allContents = await Promise.all(
    allTsx.map((f) => fs.readFile(f, "utf8")),
  );
  const concat = allContents.join("\n");

  for (const comp of components) {
    const base = path.basename(comp).replace(/\.tsx$/, "");
    if (base.startsWith("_")) continue;
    if (!new RegExp(`\\b${base}\\b`).test(concat)) {
      findings.push({
        id: makeFindingId(),
        agent: "qa",
        severity: "low",
        title: "Composant orphelin probable",
        detail: `Aucune référence détectée à \`${base}\`. Vérifier si export inutile.`,
        evidence: [path.relative(ROOT, comp)],
        scope: path.relative(ROOT, comp),
      });
    }
  }

  return { findings, files_scanned: scanned };
}

export async function executeQa(ctx: AgentExecCtx) {
  return runAgent("qa", ctx, scanQa);
}
