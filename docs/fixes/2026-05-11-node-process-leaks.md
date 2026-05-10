# Fix Node Process Leaks (2026-05-11)

## Problème

Le système spawait de multiples processus node zombies après chaque hot-reload Next.js, causant :
- Surchauffe CPU
- Memory leaks
- 20+ processus node actifs au lieu de 4-5

**Cause racine :** Next.js HMR ne trigger pas SIGTERM/SIGINT, les `setInterval` restent actifs après module reload.

## Solution implémentée

### 1. HMR Cleanup Guard (`lib/runtime/hmr-cleanup.ts`)

Nouveau module pour enregistrer des callbacks de nettoyage avant HMR dispose :

```ts
import { registerHMRCleanup } from '@/lib/runtime/hmr-cleanup';

const timer = setInterval(() => { ... }, 60000);
registerHMRCleanup(() => clearInterval(timer));
```

**Hooks :**
- `module.hot.dispose()` pour Next.js dev
- `SIGTERM/SIGINT` pour production

### 2. Schedulers modifiés

#### Mission Scheduler (`lib/engine/runtime/missions/scheduler-init.ts`)
- ✅ `startHeartbeat()` enregistre cleanup du timer
- ✅ `ensureSchedulerStarted()` enregistre cleanup du scheduler principal

#### Asset Cleanup Scheduler (`lib/engine/runtime/assets/cleanup/scheduler.ts`)
- ✅ `start()` enregistre cleanup de `initialTimeout` et `timer`

#### Mission Scheduler Core (`lib/engine/runtime/missions/scheduler.ts`)
- ✅ `startScheduler()` enregistre cleanup global

### 3. Script de nettoyage manuel

**`scripts/kill-node-zombies.sh`**
- Identifie le PID du serveur Next.js actif (port 9001)
- Préserve ce PID + ses enfants
- Kill tous les autres processus node/npm (hors VSCode/Cursor helpers)

**Usage :**
```bash
npm run kill:zombies
```

## Vérification

```bash
# Avant fix : 20+ processus node
ps aux | grep -c "node"

# Après fix : 4-5 processus (Next.js + workers légitimes)
ps aux | grep -E "node|npm" | grep -v grep | grep -v "Helper" | wc -l
```

## Autres optimisations recommandées

1. **Fermer les fenêtres VSCode/Cursor inutilisées** (chacune spawn 2+ tsserver)
2. **Désactiver extensions gourmandes en dev** :
   - Pylance (si pas Python)
   - GitHub Actions
   - Docker/Containers (si pas utilisés)
3. **Limiter mémoire TypeScript** dans `.vscode/settings.json` :
   ```json
   {
     "typescript.tsserver.maxTsServerMemory": 3072,
     "typescript.disableAutomaticTypeAcquisition": true
   }
   ```

## Fichiers modifiés

- `lib/runtime/hmr-cleanup.ts` (nouveau)
- `lib/engine/runtime/missions/scheduler-init.ts`
- `lib/engine/runtime/missions/scheduler.ts`
- `lib/engine/runtime/assets/cleanup/scheduler.ts`
- `scripts/kill-node-zombies.sh` (nouveau)
- `package.json` (ajout script `kill:zombies`)
