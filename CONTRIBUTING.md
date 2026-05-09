# Contribuer — Hearst OS

Workflow solo dev assumé (push direct sur `main`). Toutes les règles agent dans [CLAUDE.md](CLAUDE.md). Protocole ADD dans [docs/AGENT-DRIVEN-DEV.md](docs/AGENT-DRIVEN-DEV.md).

## Workflow standard

```
verrou (docs/AGENT-LOCK.json) → /feature <id> → coder → validate → manifest → commit → push
```

1. **Verrou** — Lire `docs/AGENT-LOCK.json`. Si `locked === true`, refuser tout edit/destructif et signaler à Adrien.
2. **Briefing ADD** — `/feature <id>` (sans arg = général, avec arg = spec ciblée). Lire `docs/features/<id>.md` avant de toucher la feature.
3. **Coder** — Suivre les principes CLAUDE.md (tokens > magic numbers, une source de vérité par propriété, primitives DS dès 3+ duplications).
4. **Valider** — `npm run validate` (typecheck + lint + test). Sur changements UI lourds : `npm run validate:full` (ajoute e2e) + screenshot Playwright.
5. **Manifest** — Si tu as touché `docs/features/*.md` : `npm run features:manifest` puis `git add docs/features/_manifest.json`.
6. **Commit** — Conventional Commits FR (voir ci-dessous). Utiliser `/add` pour vérifier les invariants ADD avant.
7. **Push** — Direct sur `main` autorisé.

## Commandes essentielles

| Commande | Usage |
| --- | --- |
| `npm run dev` | Next dev sur port `9001` (kill port + cleanup `.next`) |
| `npm run dev:fresh` | Idem + `rm -rf .next` (quand le cache est pourri) |
| `npm run dev:stack` | Stack complète (script `scripts/dev-stack.sh`) |
| `npm run dev:electron` | Next + Electron (concurrently) |
| `npm run build` | Build Next prod (avec prebuild `lint:visual`) |
| `npm run start` | Next prod local |
| `npm run lint` | ESLint + `lint:visual` (tokens vs magic numbers) |
| `npm run lint:visual` | Lint visuel uniquement |
| `npm run typecheck` | `tsc --noEmit --incremental` (rapide, cache `tsconfig.tsbuildinfo`) |
| `npm run typecheck:watch` | Typecheck en watch |
| `npm run format` | Prettier sur tout le repo |
| `npm run format:check` | Vérifier formatage sans réécrire |
| `npm test` | Vitest unit (run once) |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright e2e (port `9001`) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run validate` | typecheck + lint + test (boucle de validation rapide) |
| `npm run validate:full` | validate + e2e CI |
| `npm run doctor` | typecheck + lint + audit deps |
| `npm run audit:deps` | `npm audit --omit=dev --audit-level=high` |
| `npm run deadcode` | knip (détection code mort) |
| `npm run circular` | madge (détection imports circulaires) |
| `npm run routes:list` | Génère `docs/api-routes.md` (auto) |
| `npm run stores:list` | Génère `docs/stores.md` (auto) |
| `npm run health` | `scripts/health-check.ts` (env, services, providers) |
| `npm run audit` | `scripts/audit-pipeline.ts` (pipeline LLM + workers) |
| `npm run workers:audit` | Inspecter workers BullMQ orphelins |
| `npm run workers:kill-orphans` | Kill workers orphelins |
| `npm run features:manifest` | Régénère `docs/features/_manifest.json` |
| `npm run features:test` | Tests features |
| `./launch.sh` | Stack complète scriptée (Adrien) |
| `./launch-stop.sh` | Stop stack |

## Conventional Commits FR

Format : `type(scope): message`

| Préfixe | Usage |
| --- | --- |
| `feat(scope):` | Nouvelle feature |
| `fix(scope):` | Bug fix |
| `refactor(scope):` | Refactor sans changement fonctionnel |
| `polish(scope):` | Polish UI / micro-amélioration |
| `chore(scope):` | Maintenance (deps, configs, scripts) |
| `test(scope):` | Tests ajoutés ou updatés |
| `docs(scope):` | Documentation |

Messages **en français**, descriptifs, focalisés sur le "pourquoi". Exemples des derniers commits : `fix(theme): expose --color-* mappings dans @theme inline`, `feat(rails): polish PulseBar Cmd+K + TimelineRail collapsed (silent luxury)`.

## Règles non négociables

- **Pas de commit `.env.local`** ni de fichiers `.env*` (déjà dans `.gitignore`, ne jamais forcer).
- **Pas de `--no-verify`** sur hooks sauf demande explicite Adrien (un hook qui fail signale un vrai problème).
- **Pas de force-push sur `main`** sauf demande explicite Adrien par message.
- **Pas de modif `proxy.ts` PUBLIC_PATHS** sans vérifier que l'auth flow tient (test login + un appel API).
- **Pas de touche `public/hearst-logo.svg`** : intouchable, jamais.
- **Toujours `npm run features:manifest`** après edit de `docs/features/*.md` (sinon le manifest dérive et le ADD perd le verrou).
- **Pas de réintroduction `--cykan`** dans des fichiers neufs (pivot silent luxury → `--accent-teal`).

## Tests e2e taggés `@skip-ci`

Les e2e taggés `@skip-ci` (notamment certains scénarios reports) sont skippés en CI. Pour les exercer, lance `npm run test:e2e` en local avec ces tags activés (voir `playwright.config.ts` pour la grep config).
