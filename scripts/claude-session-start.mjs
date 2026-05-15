#!/usr/bin/env node
/**
 * Claude Code SessionStart hook — auto-priming du contexte au début de session.
 *
 * Affiche :
 *   - État du verrou ADD (docs/AGENT-LOCK.json)
 *   - Liste des agents custom disponibles (.claude/agents/*.md)
 *   - Résumé d'AGENTS.md
 *   - Pointeurs lecture pour gros refactors
 *
 * Activé via .claude/settings.json :
 *
 * {
 *   "hooks": {
 *     "SessionStart": [
 *       {
 *         "hooks": [
 *           { "type": "command", "command": "node scripts/claude-session-start.mjs" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Sortie : stdout (Claude le lit en début de session). Exit 0 toujours
 * (le hook ne doit jamais bloquer le démarrage).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function safeRead(relPath) {
  try {
    return readFileSync(path.join(ROOT, relPath), "utf-8");
  } catch {
    return null;
  }
}

function lockBadge() {
  const raw = safeRead("docs/AGENT-LOCK.json");
  if (!raw) return "État ADD : (lock file absent — considéré déverrouillé)";
  try {
    const state = JSON.parse(raw);
    if (!state.locked) return "État ADD : 🔓 déverrouillé";
    const reason = state.reason ? ` — raison : « ${state.reason} »` : "";
    const since = state.lockedAt ? ` (depuis ${state.lockedAt})` : "";
    return `État ADD : 🔒 verrouillé${since}${reason}`;
  } catch {
    return "État ADD : (lock file illisible — fail-open)";
  }
}

function listCustomAgents() {
  const dir = path.join(ROOT, ".claude/agents");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  return files
    .map((f) => {
      const raw = safeRead(`.claude/agents/${f}`);
      if (!raw) return null;
      const nameMatch = raw.match(/^name:\s*(.+)$/m);
      const descMatch = raw.match(/^description:\s*(.+)$/m);
      const modelMatch = raw.match(/^model:\s*(.+)$/m);
      if (!nameMatch || !descMatch) return null;
      return {
        name: nameMatch[1].trim(),
        description: descMatch[1].trim(),
        model: modelMatch ? modelMatch[1].trim() : "default",
      };
    })
    .filter(Boolean);
}

function agentsIndexSummary() {
  const raw = safeRead("AGENTS.md");
  if (!raw) return null;
  // Première ligne après le H1 + section "Règles agentiques" si présente
  const rules = raw.match(/## Règles agentiques[\s\S]*?(?=\n## |\n#|$)/);
  return rules ? rules[0].trim() : null;
}

const lines = [];
lines.push("🤖 Hearst OS — Briefing session");
lines.push("");
lines.push(lockBadge());
lines.push("");

const agents = listCustomAgents();
if (agents.length > 0) {
  lines.push("Agents custom disponibles :");
  for (const a of agents) {
    lines.push(`- **${a.name}** (${a.model}) — ${a.description}`);
  }
} else {
  lines.push("Agents custom : aucun (créer dans .claude/agents/<name>.md avec frontmatter)");
}
lines.push("");

lines.push("Lecture recommandée avant gros refactor :");
lines.push("- ARCHITECTURE.md (vue condensée du système)");
lines.push("- AGENTS.md (index agents + hooks + règles)");
lines.push("- docs/AGENT-DRIVEN-DEV.md (protocole ADD complet)");
lines.push("- CLAUDE.md (mode autonomie + voix éditoriale)");
lines.push("");

const rulesBlock = agentsIndexSummary();
if (rulesBlock) {
  lines.push(rulesBlock);
  lines.push("");
}

lines.push("Validation rapide : `npm run validate` (typecheck + lint + test)");
lines.push("Manifest features : `npm run features:manifest` après edit docs/features/*.md");
lines.push("");
lines.push("Commandes slash disponibles (tapez / dans le chat) :");
lines.push("- `/nettoyage` — dead code, exports orphelins, magic numbers, dettes lint");
lines.push("- `/audit`     — sécurité, perf, architecture, dépendances (P0/P1/P2)");
lines.push("- `/map`       — cartographie routes, stores, modules, surface API");
lines.push("- `/test`      — gaps de couverture + specs Vitest/Playwright générées");
lines.push("- `/syscheck`  — zombies, doublons Node, ports fantômes, caches macOS");
lines.push("- `/qa`        — audit QA UI/UX complet (alignements, spacing, cohérence, états)");
lines.push("- `/flow`      — QA flows utilisateur (navigation, friction, logique UX, CTA)");
lines.push("→ Chaque commande génère un rapport HTML qui s'ouvre dans Chrome.");

process.stdout.write(`${lines.join("\n")}\n`);
process.exit(0);
