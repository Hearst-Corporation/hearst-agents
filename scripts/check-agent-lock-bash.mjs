#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook — bloque les commandes Bash destructives si
 * docs/AGENT-LOCK.json a `locked: true`.
 *
 * À activer dans .claude/settings.json (ou settings.local.json) :
 *
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Bash",
 *         "hooks": [
 *           { "type": "command", "command": "node scripts/check-agent-lock-bash.mjs" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Le hook reçoit le contexte sur stdin (JSON Claude Code). Il :
 *   - exit 0 → autorise l'appel (lecture, ou commande non destructive, ou lock off)
 *   - exit 2 → bloque l'appel (message vers stderr remonté à Claude)
 *
 * Patterns destructifs détectés : rm -r/-rf, git reset --hard, git push --force/-f,
 * git branch -D, git clean -fd, drop table/database, truncate table, mv … /dev/null,
 * redirection vers /dev/sda, mkfs, dd if=…
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const DESTRUCTIVE_RE =
  /(\brm\s+-r|\brm\s+-rf|\bgit\s+reset\s+--hard|\bgit\s+push\s+--force|\bgit\s+push\s+-f\b|\bgit\s+branch\s+-D\b|\bgit\s+clean\s+-fd|\bdrop\s+(table|database)|\btruncate\s+table|\bmv\s+.+\s+\/dev\/null|>\s*\/dev\/sda|\bmkfs|\bdd\s+if=)/i;

// Lecture stdin (synchronously via fd 0). Si vide ou JSON invalide → autorise.
let raw = "";
try {
  raw = readFileSync(0, "utf-8");
} catch {
  process.exit(0);
}

if (!raw.trim()) {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command;
if (typeof command !== "string" || command.length === 0) {
  process.exit(0);
}

if (!DESTRUCTIVE_RE.test(command)) {
  process.exit(0);
}

// Commande destructive détectée → on regarde le verrou.
const LOCK_PATH = path.join(process.cwd(), "docs", "AGENT-LOCK.json");

let state = { locked: false };
try {
  state = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
} catch {
  // Pas de fichier lock → considère déverrouillé.
  process.exit(0);
}

if (!state.locked) {
  process.exit(0);
}

const reason = state.reason ? ` Raison : « ${state.reason} »` : "";
const lockedAt = state.lockedAt ? ` (depuis ${state.lockedAt})` : "";

process.stderr.write(
  `🔒 Agents verrouillés${lockedAt}.${reason}\n` +
    `Commande Bash destructive bloquée : ${command}\n` +
    `Adrien doit déverrouiller depuis /admin/agent-driven-dev avant toute action destructive.\n` +
    `Lecture (Read, Grep, Glob, Bash en lecture pure) reste autorisée.\n`
);
process.exit(2);
