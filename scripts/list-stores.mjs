#!/usr/bin/env node
/**
 * Scanne stores/**\/*.ts (et lib/stores/**\/*.ts si présent) pour produire un
 * index Markdown des stores Zustand.
 *
 * Usage : npm run stores:list (ou node scripts/list-stores.mjs)
 *
 * Détection : `export const useXxx[Store] = create(...)` (avec ou sans
 * générique). Description : 1ère ligne du JSDoc qui précède immédiatement
 * l'export.
 *
 * Pas de dépendance externe — Node stdlib uniquement.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = [join(ROOT, "stores"), join(ROOT, "lib", "stores")];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "__tests__", "test"]);

const EXPORT_CREATE_RE = /export\s+const\s+(use\w+)\s*=\s*create\b/g;

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
    } else if (
      st.isFile() &&
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".d.ts") &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".spec.ts")
    ) {
      yield full;
    }
  }
}

/**
 * Récupère la 1ère ligne de description du JSDoc qui précède immédiatement
 * l'index donné dans le tableau de lignes. Renvoie "" si aucun bloc trouvé.
 */
function descriptionAbove(lines, exportLineIdx) {
  // Remonte en sautant les lignes vides.
  let i = exportLineIdx - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0) return "";
  // Doit finir un bloc JSDoc.
  if (!lines[i].trim().endsWith("*/")) return "";
  // Trouve le début du bloc.
  let start = i;
  while (start >= 0 && !lines[start].trim().startsWith("/**")) start--;
  if (start < 0) return "";
  // Concatène le contenu du bloc, prend la 1ère ligne non vide.
  for (let j = start; j <= i; j++) {
    let line = lines[j].trim();
    line = line.replace(/^\/\*\*\s*/, "");
    line = line.replace(/\s*\*\/\s*$/, "");
    line = line.replace(/^\*\s?/, "");
    line = line.trim();
    if (line.length > 0) return line;
  }
  return "";
}

const stores = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    let text;
    try {
      text = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = text.split("\n");

    for (const match of text.matchAll(EXPORT_CREATE_RE)) {
      const hookName = match[1];
      // Localise la ligne.
      const upTo = text.slice(0, match.index);
      const lineIdx = upTo.split("\n").length - 1;
      const description = descriptionAbove(lines, lineIdx);
      const relFile = relative(ROOT, file).replace(/\\/g, "/");
      stores.push({
        hook: hookName,
        file: relFile,
        description,
      });
    }
  }
}

// Dédoublonne (hook + file unique) et trie par hook.
const seen = new Set();
const unique = [];
for (const s of stores) {
  const key = `${s.hook}::${s.file}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(s);
}
unique.sort((a, b) => a.hook.localeCompare(b.hook));

const out = [];
out.push("# Stores Zustand — Hearst OS");
out.push("");
out.push("Auto-généré par `npm run stores:list`. Ne pas éditer à la main.");
out.push("");
out.push(`## Index (${unique.length} stores)`);
out.push("");
out.push("| Store | Hook | Fichier | Description |");
out.push("|-------|------|---------|-------------|");
for (const s of unique) {
  const desc = s.description.replace(/\|/g, "\\|");
  out.push(`| \`${s.hook}\` | ${s.hook} | [${s.file}](${s.file}) | ${desc} |`);
}
out.push("");

process.stdout.write(out.join("\n"));
