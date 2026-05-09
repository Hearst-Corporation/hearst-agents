# Agents — Hearst OS

Ce fichier indexe les "agents" qui touchent ce repo : Claude (toi), subagents
spawned via Agent tool, slash commands locales, et hooks.

## Agent principal
- **Claude (Code/Web)** : voir [CLAUDE.md](CLAUDE.md) pour le mode autonomie + ADD.

## Slash commands locales (.claude/commands/)
- `/feature [feature-id]` — briefing ADD avant de toucher une feature verrouillée
- `/add` — vérifier invariants ADD sur fichiers stagés avant commit
- `/ui` — audit visuel d'un écran (magic numbers, tokens)
- `/simplify` — review reuse + qualité + efficacité
- `/review`, `/security-review`, `/init`

## Hooks (.claude/settings.json)
- **PreToolUse** Edit|Write|NotebookEdit : `node scripts/check-agent-lock.mjs`
- **PreToolUse** Bash : `node scripts/check-agent-lock-bash.mjs` (commandes destructives)
  Bloquent si `docs/AGENT-LOCK.json:locked === true`.

## Subagents spawnable via Agent tool
- `Explore` — recherche code multi-fichiers sans polluer contexte principal
- `Plan` — design d'implémentation pour gros refactors
- `general-purpose` — tâches multi-étapes
- `claude-code-guide` — questions Claude Code / SDK / API

## Règles agentiques
1. Avant TOUT Edit/Write : vérifier `docs/AGENT-LOCK.json`
2. Avant de toucher une feature : `/feature <id>` puis lire `docs/features/<id>.md`
3. Après tout commit touchant `docs/features/*.md` : `npm run features:manifest`
4. Avant push : `npm run validate` (typecheck + lint + test)
5. Pour gros refactors : spawn subagent `Plan` au lieu de coder direct
