#!/usr/bin/env node
/**
 * Scanne app/api/**\/route.{ts,tsx,js} et émet un index Markdown sur stdout.
 *
 * Usage : npm run routes:list (ou node scripts/list-api-routes.mjs)
 *
 * Pour chaque route :
 *   - dérive le path public depuis le chemin disque (segments [param] → :param,
 *     groupes (group) ignorés)
 *   - détecte les méthodes HTTP exportées (export const|function GET|POST|…)
 *   - regroupe par premier segment fonctionnel (admin, v2, auth, …)
 *
 * Pas de dépendance externe — Node stdlib uniquement.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app", "api");

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
const METHOD_RE = new RegExp(
  `export\\s+(?:async\\s+)?(?:const|function)\\s+(${HTTP_METHODS.join("|")})\\b`,
  "g",
);

const ROUTE_FILE_RE = /^route\.(ts|tsx|js)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walk(full);
    } else if (st.isFile() && ROUTE_FILE_RE.test(entry)) {
      yield full;
    }
  }
}

/**
 * Convertit un chemin disque (app/api/foo/[id]/bar/route.ts) en URL publique
 * (/api/foo/:id/bar). Les groupes (group) sont ignorés. Les catch-all
 * [...slug] et [[...slug]] deviennent :slug* / :slug?.
 */
function diskPathToRoute(file) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const parts = rel.split("/");
  // Drop "app" prefix and "route.ts" suffix.
  const segments = parts.slice(1, -1);
  const out = [];
  for (const seg of segments) {
    if (seg.startsWith("(") && seg.endsWith(")")) continue; // groupe
    if (seg.startsWith("[[...") && seg.endsWith("]]")) {
      out.push(`:${seg.slice(5, -2)}?`);
    } else if (seg.startsWith("[...") && seg.endsWith("]")) {
      out.push(`:${seg.slice(4, -1)}*`);
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      out.push(`:${seg.slice(1, -1)}`);
    } else {
      out.push(seg);
    }
  }
  return `/${out.join("/")}`;
}

function detectMethods(file) {
  let text;
  try {
    text = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const found = new Set();
  for (const match of text.matchAll(METHOD_RE)) {
    found.add(match[1]);
  }
  return HTTP_METHODS.filter((m) => found.has(m));
}

const routes = [];
for (const file of walk(API_DIR)) {
  const route = diskPathToRoute(file);
  const methods = detectMethods(file);
  const relFile = relative(ROOT, file).replace(/\\/g, "/");
  routes.push({ route, methods, file: relFile });
}

routes.sort((a, b) => a.route.localeCompare(b.route));

const out = [];
out.push("# API Routes — Hearst OS");
out.push("");
out.push("Auto-généré par `npm run routes:list`. Ne pas éditer à la main.");
out.push("");
out.push(`## Index (${routes.length} routes)`);
out.push("");
out.push("| Route | Méthodes | Fichier |");
out.push("|-------|----------|---------|");
for (const r of routes) {
  const methods = r.methods.length > 0 ? r.methods.join(", ") : "—";
  out.push(`| \`${r.route}\` | ${methods} | [${r.file}](${r.file}) |`);
}
out.push("");

// Regroupement par premier segment fonctionnel après /api/
const groups = new Map();
for (const r of routes) {
  const parts = r.route.split("/").filter(Boolean); // ["api", "admin", …]
  const key = parts[1] ?? "(racine)";
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));

out.push("## Par domaine");
out.push("");
for (const key of groupKeys) {
  out.push(`### ${key}/`);
  out.push("");
  for (const r of groups.get(key)) {
    const methods = r.methods.length > 0 ? r.methods.join(", ") : "—";
    out.push(`- \`${r.route}\` — ${methods}`);
  }
  out.push("");
}

process.stdout.write(out.join("\n"));
