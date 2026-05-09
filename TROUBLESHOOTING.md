# Troubleshooting — Hearst OS

Erreurs récurrentes en dev. Pour les incidents prod voir [RUNBOOK.md](RUNBOOK.md).

## `ELECTRON_RUN_AS_NODE` pollué

Symptôme : `electron .` lance Node au lieu de l'UI Electron.

```bash
unset ELECTRON_RUN_AS_NODE
npm run dev:electron
```

Les scripts `electron`, `dev:electron`, `electron:dist` font déjà l'`unset`, mais si tu lances Electron à la main, vérifie l'env.

## Build Vercel échoue sur Electron deps

Les deps Electron (`electron`, `electron-builder`) sont strippées au build Vercel via `vercel.json` (déjà en place). Si le build casse sur `electron/main.ts` ou `electron/preload.ts` :

- Vérifier que `vercel.json` contient bien la directive de strip.
- Vérifier que `next.config.ts` exclut le dossier `electron/` du tracing Next.
- Vérifier que rien dans `app/` ou `lib/` n'importe depuis `electron/`.

## `tsc` rapporte des erreurs déjà fixées

Cache TypeScript stale.

```bash
rm tsconfig.tsbuildinfo
npx tsc --noEmit
```

## `next build` lent ou hang

Vérifier que `instrumentation.ts` ne charge pas les workers BullMQ pendant le build :

- Le check `process.env.VERCEL !== "1"` doit gater `startAllWorkers()`.
- Au build local hors Vercel, les workers se chargent et peuvent ralentir / bloquer.
- Workaround local : `VERCEL=1 npm run build`.

## `npm ci` échoue sur native deps

Versions Node :

```bash
node -v   # doit être 20.x (cf. devDependencies @types/node ^20)
```

Si tu es sur Node 22+, certaines deps natives (better-sqlite3, sharp, etc.) peuvent péter. Bascule via `nvm use 20`.

## Lint visual fail sur fichier neuf

`scripts/lint-visual.mjs` détecte les magic numbers hors tokens. Trois options :

1. **Ajouter un token** dans `app/globals.css` (sous `@theme inline` ou `:root`) si la valeur est utilisée 2+ fois.
2. **Désactiver le lint pour ce fichier** : ajouter `// lint-visual-disable-file` dans les **5 premières lignes** du fichier.
3. **Ajouter le path à l'allowlist** du lint dans `scripts/lint-visual.mjs` (STRICT_PATHS) si le fichier sort du périmètre strict.

Le lint tourne aussi en `prebuild` (`npm run prebuild` → `lint:visual`), donc un magic number bloque le build prod.

## Tests Playwright timeout

Vérifier le port utilisé :

- Dev local : `9001` (pas `3000`).
- E2E : variable `E2E_BASE_URL` doit pointer sur `http://localhost:9001`.
- Si tu lances `next dev` à la main sur `3000`, les tests pétent.

```bash
E2E_BASE_URL=http://localhost:9001 npm run test:e2e
```

## Imports de chemin `@/...` cassés

Vérifier `tsconfig.json` (`paths: { "@/*": ["./*"] }`). Si tu as des erreurs IDE mais pas CLI : redémarrer le TS server (Cmd+Shift+P → "TypeScript: Restart TS Server").

## Tailwind classes non appliquées

Tailwind v4 utilise `@theme inline` dans `globals.css` — pas de `tailwind.config.ts` classique. Si une utility n'est pas reconnue :

- Vérifier qu'elle est dans le scope du `@theme inline` (tokens `--color-*`, `--space-*`, `--radius-*`).
- `npm run dev:fresh` pour purger le cache PostCSS.

## Workers BullMQ ne consomment pas

- Si `process.env.VERCEL === "1"` : normal, c'est gated. Utiliser Inngest pour les jobs async en prod.
- Si en local : vérifier `REDIS_URL` (sinon les workers font no-op silencieusement).
- `npm run workers:audit` pour inspecter les workers spawnés.
