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
- **SessionStart** : `node scripts/claude-session-start.mjs`
  Auto-priming en début de session : état du verrou ADD, liste des agents
  custom, pointeurs lecture (ARCHITECTURE.md, AGENTS.md, docs/AGENT-DRIVEN-DEV.md).

## Subagents spawnable via Agent tool

### Subagents custom (.claude/agents/)
- `validator` (haiku) — Lance `npm run validate` (typecheck + lint + test) et
  retourne un JSON `{status, blockers[], warnings[], next_steps[]}`.
  Inputs : `scope` ("all" | "diff" | path). Read-only, terminal.
- `llm-auditor` (sonnet) — Audit exhaustif du runtime LLM sur 8 dimensions
  (caching Anthropic, circuit breaker, failover, retry exponentiel, Langfuse
  wireup, rate-limit, token budget, streaming watchdog). Inputs : `provider`
  ("anthropic" | "openai" | "gemini" | "all"). Retourne verdicts yes/no/partial
  avec preuves `file:line`. Read-only.
- `route-mapper` (haiku) — Pour un set de fichiers modifiés (`changed_paths[]`),
  retourne routes API impactées + stores Zustand affectés + layouts touchés
  + recommandations de tests. Read-only strict (Read, Grep, Glob).

### Subagents génériques
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
