# Hearst OS — Instructions Claude

## 🚀 Commande à lancer avant de bosser : `/feature [feature-id]`

Pour t'imprégner du protocole ADD avant de toucher à une feature, lance la slash command **`/feature`** (sans arg = briefing général, avec arg = briefing + spec ciblée).

Elle vérifie le verrou, te fait lire le rapport maître et la spec de la feature, puis te rappelle les règles d'invariants.

## 🔒 Avant toute écriture : vérifier `docs/AGENT-LOCK.json`

Lis [docs/AGENT-LOCK.json](docs/AGENT-LOCK.json) **avant tout appel à Edit, Write, NotebookEdit, ou Bash destructif** (rm, git commit, mv, etc.).

Si `locked === true` :

- **Refuse** toute modification de fichier ou exécution destructive
- Informe l'utilisateur que les agents sont verrouillés (avec la `reason` si présente)
- Indique-lui qu'il doit aller dans `/admin/agent-driven-dev` pour déverrouiller
- Lecture (Read, Grep, Glob, Bash en lecture pure) reste autorisée

Le verrou est posé/retiré uniquement par Adrien depuis la page admin Gouvernance.

## ⚠ Avant toute modification : lire `docs/AGENT-DRIVEN-DEV.md`

[docs/AGENT-DRIVEN-DEV.md](docs/AGENT-DRIVEN-DEV.md) est le **document maître** qui liste les features verrouillées et les invariants à respecter. Avant de toucher à un fichier d'une feature listée comme `verrouillé`, ouvre `docs/features/<id>.md` et vérifie que tu ne contredis aucun invariant. Si tu en contredis un → demande update spec à Adrien avant de coder.

Pour les features non verrouillées : mode autonomie standard ci-dessous.

## Mode autonomie (défaut)

Adrien commande. Tu prends les décisions cohérentes au système et tu avances. Tu ne t'arrêtes pas pour demander sauf si :

- Une décision impacte directement l'UX visible et il y a 2 directions opposées valides
- Une action est destructive et irréversible (suppression branche, force-push prod, drop DB)
- Tu ne sais pas quoi vouloir Adrien et la question coûte moins cher que l'erreur

Pour le reste : tu décides, tu codes, tu commits, tu signales en fin.

## Pratiques codeur

### Primitives

Si tu vois 3+ patterns dupliqués qui méritent extraction, crée la primitive dans `app/(user)/components/ui/` ou un sous-dossier métier (`components/missions/`, `components/personas/`), exporte via `index.ts`, propage les usages. Pas de demande préalable.

### Mode batch

Plan de N batches validé une fois → enchaîne sans s'arrêter entre chaque. Validations techniques (`tsc + lint`) à la fin uniquement. Commit par batch ou par phase logique avec message descriptif (Conventional Commits, en français).

### Décisions sans confirmation

- Création de primitive si 3+ duplications
- Suppression de classes CSS mortes (orphelines)
- Rename variables locales / fonctions internes
- Refactor de pages massives en sous-composants
- Fix d'erreurs lint préexistantes hors scope si elles bloquent le CI

### Décisions qui méritent confirmation (cas rares)

- Refonte du shell layout
- Suppression d'une feature visible
- Changement de routes ou structure d'URL
- Modification de schémas DB / API contracts publics

### Git

- Commit par batch avec message clair (préfixes : `feat`, `fix`, `refactor`, `polish`, `chore`, `test`, `docs`)
- Push direct sur `main` autorisé (workflow solo dev assumé)
- Pas de force-push sauf si Adrien le demande explicitement par message
- Pas de `--no-verify` sur hooks sauf demande explicite
- **Avant tout commit touchant `docs/features/*.md`** : lance `npm run features:manifest` pour régénérer `docs/features/_manifest.json` et stage-le avec `git add docs/features/_manifest.json`. Utilise `/add` pour vérifier les invariants ADD avant commit.

## Stack

- **Next.js 15** (app router) + React 19
- **Tailwind v4** (`@import "tailwindcss"`) avec `@theme inline`
- **Police** : Satoshi Variable (`--font-satoshi`)
- **Tests** : Playwright e2e, Vitest unit
- **Auth** : NextAuth (SessionProvider dans [app/(user)/layout.tsx](<app/(user)/layout.tsx>))
- **Deploy** : Vercel (auto-deploy via webhook GitHub)

## Langue

Français pour tout : réponses, commits, commentaires code, microcopy UI.

## Sandbox `lab/` — zone libre, hors lint

`lab/cli-os/` (et tout futur sous-dossier de `lab/`) est une **sandbox Vite+React totalement isolée** du cockpit Hearst. Elle existe pour prototyper UX/UI/Flow **from scratch**.

- Aucune contrainte AGENT-LOCK
- Aucun import depuis `app/`, `components/`, `hooks/`, `lib/`, `stores/` du repo principal
- Stack identique (React 19 + Tailwind v4 + Framer Motion + TypeScript) pour garantir un port back trivial : composant validé → copié dans `app/(user)/components/<feature>/` avec swap d'imports
- La navigation suit `lab/cli-os/src/lib/navigation-truth.ts` qui dérive du code réel

Run : `cd lab/cli-os && pnpm install && pnpm dev` → `localhost:5173`.

## 🔒 INTERDICTION ABSOLUE — `/spatial-safe` (sauvegarde de référence)

La route **`/spatial-safe`** et tous ses fichiers associés sont une **sauvegarde figée** de la scène Spatial qui fonctionne (Spline central + panels HTML). Ils servent de filet de sécurité si on casse `/spatial` pendant un chantier R&D.

**Aucun agent, aucune slash command, aucun script ne doit modifier les fichiers suivants** sans accord explicite et écrit d'Adrien :

- `app/spatial-safe/` (page + layout)
- `components/spatial-safe/` (core, overlays, panels, orbital, materials, motion)
- `hooks/spatial-safe/`
- `lib/spatial-safe/`
- `styles/spatial-safe/`
- `providers/spatial-safe/`
- `docs/spatial/_BACKUP_SPATIAL_WORKING_2026-05-12/` (backup physique hors-git)

Ces zones sont en **lecture seule pour tous les agents**. Pas d'Edit, pas de Write, pas de `mv`, pas de `rm`. Refactor structurel global → exclure `spatial-safe/` du scope.

Si tu dois faire évoluer la sauvegarde (nouvelle version validée), Adrien exécute la mise à jour lui-même ou te donne l'autorisation explicite.
