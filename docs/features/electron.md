# Electron — `electron`

## Métadonnées
| **id** | `electron` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P3 |

## Description
Wrapper Electron (v41.5.0) qui embarque le serveur Next.js standalone en production ou
pointe sur `localhost:9001` en dev. Sécurité maximale : `contextIsolation=true`,
`nodeIntegration=false`. Le bridge renderer↔main (`window.hearstBridge`) expose uniquement
`isElectron: true` et `platform`. En dev, `HEARST_DEV_AUTH_BYPASS=1` permet un login
automatique via `/api/auth/dev-login`.

## Surface publique
- **Main process** : `electron/main.ts` → `dist/electron/main.js` (CJS)
- **Preload** : `electron/preload.ts` → `dist/electron/preload.js` (CJS)
- **Build** : `scripts/build-electron.mjs` (esbuild, external: electron)
- **Scripts npm** :
  - `electron:compile` — compile main + preload
  - `electron` — compile + lance
  - `dev:electron` — concurrently next dev + electron (wait-on port 9001)
  - `electron:build` — next build + compile electron
  - `electron:dist` — build complet + electron-builder (paquet distributable)
- **Bridge** : `window.hearstBridge.isElectron`, `window.hearstBridge.platform`

## Types clés
```ts
// window.hearstBridge (exposé via contextBridge)
interface HearstBridge {
  isElectron: true;
  platform: "darwin" | "win32" | "linux";
}

// Port
// Dev  : http://localhost:9001 (next dev tourne séparément)
// Prod : http://127.0.0.1:<dynamic> (preferred 9001, fallback OS-assigned)

// Dev auth bypass URL
// isDev → startUrl = "http://localhost:9001/api/auth/dev-login"
// isProd → startUrl = base URL directement
```

## Invariants verrouillés

### I-1. contextIsolation=true, nodeIntegration=false, webSecurity=true
Ces trois flags de sécurité ne doivent jamais être modifiés. Toute fonctionnalité nécessitant
un accès Node depuis le renderer doit passer par `contextBridge` dans `preload.ts`.

### I-2. window.hearstBridge — contrat minimal figé
`isElectron: true` et `platform` sont les seules propriétés exposées aujourd'hui. Ce sont des
read-only, pas des fonctions IPC. Toute extension du bridge (ex: OAuth popup driver) nécessite
une extension explicite du preload avec validation des canaux IPC.

### I-3. HEARST_DEV_AUTH_BYPASS : dev uniquement, jamais prod
La route `/api/auth/dev-login` n'est accessible qu'avec `HEARST_DEV_AUTH_BYPASS=1`. En prod
(`isDev === false`), le startUrl est la base URL sans ce path. Ne pas activer ce bypass en prod.

### I-4. Serveur Next.js : port préféré 9001, fallback OS
En prod, `findFreePort(9001)` essaie 9001 puis laisse l'OS choisir. `NEXTAUTH_URL` est
set dynamiquement avec le port trouvé. En dev, port fixe 9001 (next dev).

### I-5. Readiness poll via /api/health (max 30s)
En prod, `waitForServer(port, 30_000)` poll `/api/health` toutes les 600ms. Si le serveur
ne répond pas en 30s, `app.quit()` est appelé. Ne pas modifier ce timeout sans mesurer
le cold start du standalone.

### I-6. Electron v41.5.0 — version inhabituelle, à ne pas bumper sans test
La version 41.5.0 est significativement en avance sur les versions stables habituelles (33-34).
Un bump de version Electron doit être testé sur macOS + Windows avant merge.

### I-7. Liens externes → shell.openExternal, liens localhost → fenêtre Electron
`setWindowOpenHandler` filtre par prefix `http://localhost:` ou `http://127.0.0.1:` pour
décider si l'ouverture reste dans l'app. Tout autre URL est délégué au navigateur système.

## Tests
Existants : aucun test e2e Electron trouvé
Manquants :
- Smoke test Playwright Electron : démarrage, chargement URL, bridge `window.hearstBridge`
- Test `findFreePort` : port occupé → fallback OS
- Test `waitForServer` : timeout 30s déclenche `app.quit()`
