## Résumé

<!-- 1-3 bullets : qu'est-ce qui change et pourquoi -->

## Type

- [ ] feat (nouvelle feature)
- [ ] fix (bugfix)
- [ ] refactor (sans changement comportemental)
- [ ] polish (UI/UX micro-améliorations)
- [ ] chore (tooling, deps, config)
- [ ] test
- [ ] docs

## ADD (Agent Driven Dev)

- [ ] J'ai lu `docs/AGENT-LOCK.json` (locked = false ou j'ai déverrouillé)
- [ ] Si feature listée dans `docs/AGENT-DRIVEN-DEV.md` : `/feature <id>` lancé
- [ ] Si modif `docs/features/*.md` : `npm run features:manifest` exécuté

## Validation

- [ ] `npm run typecheck` passe
- [ ] `npm run lint` passe (incl. lint:visual)
- [ ] `npm run test` passe
- [ ] (si UI) screenshot avant/après ajouté ci-dessous

## Captures

<!-- avant/après si UI -->

## Risques

<!-- ce qui pourrait casser, à surveiller post-merge -->

## Checklist non régression

- [ ] `proxy.ts` PUBLIC_PATHS pas modifié sans valider l'impact auth
- [ ] `public/hearst-logo.svg` intouchable
- [ ] Migration `--cykan` → `--accent-teal` respectée si touche tokens
- [ ] Workers BullMQ gating dans `instrumentation.ts` préservé (sinon Vercel crash)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
