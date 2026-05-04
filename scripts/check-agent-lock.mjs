#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook — bloque Edit/Write/NotebookEdit si docs/AGENT-LOCK.json
 * a `locked: true`.
 *
 * À activer dans .claude/settings.json (ou settings.local.json) :
 *
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Edit|Write|NotebookEdit",
 *         "hooks": [
 *           { "type": "command", "command": "node scripts/check-agent-lock.mjs" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Le hook reçoit le contexte sur stdin (JSON). Il :
 *   - exit 0 → autorise l'appel
 *   - exit 2 → bloque l'appel (message vers stderr remonté à Claude)
 */

import { readFileSync } from "node:fs";
import path from "node:path";

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
    `Adrien doit déverrouiller depuis /admin/agent-driven-dev avant toute écriture.\n` +
    `Lecture (Read, Grep, Glob) reste autorisée.\n`
);
process.exit(2);
