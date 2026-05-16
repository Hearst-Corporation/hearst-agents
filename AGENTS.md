# Agents — Hearst OS

Compact guide for any agent (OpenCode, Claude, etc.) working in this repo.

## 🔒 Before any edit

1. **Check `docs/AGENT-LOCK.json`** — if `locked === true`, refuse all edits/destructive actions. Inform the user to unlock at `/admin/agent-driven-dev`.
2. **Check feature lock** — 32/32 features are locked. Before modifying anything, read `docs/features/<id>.md` for the feature's invariants. See `docs/AGENT-DRIVEN-DEV.md` for the full protocol.
3. **Read-only zones** — never edit `app/spatial-safe/`, `components/spatial-safe/`, `hooks/spatial-safe/`, `lib/spatial-safe/`, `providers/spatial-safe/`, `styles/spatial-safe/`, or `docs/spatial/_BACKUP_*`.

## 📦 Package manager

**pnpm@10.11.0** (specified in `packageManager`). CI uses `pnpm install --frozen-lockfile`.

Do not use `npm install` — it will ignore the pnpm lockfile.

## 🚀 Dev commands

| Command | What it does | Notes |
|---------|-------------|-------|
| `pnpm dev` | Next.js dev server | **Port 4102** (`package.json`). Scripts like `launch.sh` and `dev-stack.sh` claim port 9001 but `npm run dev` is hardcoded to 4102. |
| `pnpm dev:fresh` | `rm -rf .next && pnpm dev` | Use when HMR is stale or types are wrong. |
| `pnpm dev:stack` | Starts sibling services + hearst-os foreground | Expects `../hearst-connect` and `../Hearst-app` to exist. |
| `pnpm build` | Production build | Runs `lint:visual` first (`prebuild` hook). |

## 🧪 Test & validation pipeline

Run in this order when verifying changes:

```bash
pnpm typecheck      # tsc --noEmit --incremental (fast, cached)
pnpm lint           # biome check + lint:visual
pnpm test           # vitest unit
pnpm test:e2e       # playwright (needs dev server on port 4102)
```

Or the shorthand: `pnpm validate` (typecheck + lint + test).

**Visual regression**: `pnpm test:visual` compares cockpit Stage snapshots. Requires dev server running. Baselines in `e2e/visual/__screenshots__/`. Tag `@skip-ci` on tests that need a live dev server.

### Test naming convention

- `*.test.ts`: classic functional tests (behavior, edge cases, integration).
- `*.contract.test.ts`: **contract tests** — pin the public surface of a god node (signature, return shape, literal error codes, exhaustive type union, named exports). Designed to break early if someone modifies the contract without noticing. Covers *surface*, not *behavior* (which lives in `*.test.ts`).

## 🎨 Design system — Tailwind v4

- **No `tailwind.config.ts`** — tokens live in `app/globals.css` via `@theme inline`.
- **No arbitrary values** in strict paths — `lint-visual.mjs` blocks `text-[Npx]`, `bg-[…]` without `var(--token)`, hex colors, magic px in inline styles, raw `shadow-*` utilities.
- **Typography**: use `.t-9`, `.t-13`, `.t-15`, `.t-28` etc. (classes defined in `globals.css`).
- **Spacing**: use Tailwind utilities (`px-12`, `gap-4`) or `var(--space-N)` in inline styles.
- **Per-file opt-out**: add `// lint-visual-disable-file` in the first 5 lines.
- **Dark mode only** — no light mode, no theme toggle.

## 🏗️ Architecture quick facts

- **Next.js 16** app router, React 19, React Compiler enabled (`babel-plugin-react-compiler`).
- **Auth**: NextAuth (Google/Azure/Slack) via `SessionProvider` in `app/(user)/layout.tsx`.
- **Proxy**: `proxy.ts` is the global auth guard + Arcjet edge protection. Do not modify `PUBLIC_PATHS` without verifying auth flows.
- **Storage adapter**: Supabase Storage → R2 fallback → local dev. Wired in `instrumentation.ts`.
- **Workers**: BullMQ workers are **gated off on Vercel** (`process.env.VERCEL !== "1"`). On Vercel, async jobs go through Inngest.
- **Electron**: dev deps (`electron`, `electron-builder`) are stripped at Vercel build time via `vercel.json`.
- **Path alias**: `@/*` maps to `./*` (tsconfig + vitest).

## 📝 Conventions

- **Language**: French for commits, comments, UI microcopy, docs.
- **Commits**: Conventional Commits FR. Prefixes: `feat`, `fix`, `refactor`, `polish`, `chore`, `test`, `docs`. Example: `feat(rails): polish PulseBar Cmd+K`.
- **Pre-commit hook**: `simple-git-hooks` runs `biome check --write` on staged files + `pnpm features:manifest` (auto-stages `docs/features/_manifest.json`).
- **Push direct to `main`** is allowed (solo dev workflow). No force-push without explicit user request.
- **Never commit `.env*` files** — already in `.gitignore`.
- **`public/hearst-logo.svg`** is intouchable.

## 🎯 Claude-specific tools (optional)

This repo has Claude Code customizations in `.claude/`:
- **Slash commands** (19): `/feature`, `/audit`, `/ui`, `/nettoyage`, `/qa`, `/flow`, `/map`, `/test`, `/syscheck`, etc. Each generates reports or runs audits.
- **Hooks** (`.claude/settings.json`): auto-checks agent lock before Edit/Write/Bash.
- **Subagents**: `validator`, `route-mapper`, `llm-auditor`, and 12+ security fixers in `.claude/agents/`.

## 📚 Key docs

| File | Why read it |
|------|------------|
| `docs/AGENT-DRIVEN-DEV.md` | Master doc: feature lock protocol, 32 feature specs, 358 invariants. |
| `CLAUDE.md` | Autonomy rules, voice guidelines, batch mode, decisions that need confirmation. |
| `ARCHITECTURE.md` | Condensed system overview, stack table, route map, what not to break. |
| `CONTRIBUTING.md` | Full command reference, visual regression setup, e2e tags. |
| `RUNBOOK.md` | Incident procedures: Vercel deploy KO, Sentry, Arcjet, Supabase down. |
| `TROUBLESHOOTING.md` | Dev errors: stale tsc cache, HMR broken, Electron env, port conflicts. |
