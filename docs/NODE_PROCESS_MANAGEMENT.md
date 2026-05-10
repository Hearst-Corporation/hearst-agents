# Node Process Management

## Monitoring

### Compter les processus actifs
```bash
ps aux | grep -E "node|npm" | grep -v grep | grep -v "Helper" | wc -l
```

**Baseline sain :** 4-6 processus
- 1× npm run dev
- 1× next dev -p 9001
- 1-2× webpack-loaders (Turbopack)
- 0-1× tsc --noEmit (si typecheck actif)

**⚠️ Alerte :** 10+ processus = zombies détectés

### Détail des processus
```bash
ps aux | grep -E "node|npm" | grep -v grep | grep -v "Helper"
```

## Nettoyage

### Automatique (recommandé)
```bash
npm run kill:zombies
```

Script `scripts/kill-node-zombies.sh` :
- Identifie Next.js sur port 9001
- Préserve son arbre de processus
- Kill le reste

### Manuel (si script échoue)
```bash
# Identifier le PID du serveur Next.js
lsof -ti tcp:9001

# Kill tous les node sauf ce PID
pkill -9 node  # ⚠️ Nucléaire : relancer npm run dev après
```

## Prévention

### HMR Cleanup Guard

Tout module avec `setInterval`/`setTimeout` DOIT enregistrer un cleanup :

```ts
import { registerHMRCleanup } from '@/lib/runtime/hmr-cleanup';

const timer = setInterval(() => { ... }, 60_000);

// ✅ Cleanup automatique avant HMR
registerHMRCleanup(() => clearInterval(timer));
```

**Modules critiques déjà couverts :**
- ✅ Mission Scheduler (`lib/engine/runtime/missions/scheduler-init.ts`)
- ✅ Asset Cleanup Scheduler (`lib/engine/runtime/assets/cleanup/scheduler.ts`)
- ✅ Mission Scheduler Core (`lib/engine/runtime/missions/scheduler.ts`)

### Audit des timers

```bash
# Chercher setInterval/setTimeout sans cleanup
rg "setInterval|setTimeout" --type ts | \
  grep -v "registerHMRCleanup" | \
  grep -v "clearInterval" | \
  grep -v "clearTimeout"
```

## Troubleshooting

### Symptômes : Mac surchauffe, fans à fond
```bash
# 1. Compter les processus
ps aux | grep node | wc -l

# Si > 10 : nettoyage d'urgence
npm run kill:zombies

# 2. Vérifier VSCode/Cursor instances
ps aux | grep -E "Visual Studio Code|Cursor" | wc -l

# Si > 3 : fermer fenêtres inutilisées
```

### Symptômes : `kill` ne répond pas (timeout)
Système trop surchargé pour les commandes shell.

**Solution :**
1. Ouvrir **Activity Monitor** (`⌘ + Space` → "Activity Monitor")
2. Trier par CPU
3. Force Quit les processus `node`/`npm` un par un (sauf Next.js sur port 9001)

### Symptômes : Zombies réapparaissent après kill
- HMR cleanup non enregistré pour un scheduler
- Audit via `rg "setInterval|setTimeout"` + ajouter `registerHMRCleanup`

## Optimisations complémentaires

### Limiter TypeScript memory (`.vscode/settings.json`)
```json
{
  "typescript.tsserver.maxTsServerMemory": 3072,
  "typescript.disableAutomaticTypeAcquisition": true
}
```

### Désactiver extensions gourmandes (dev uniquement)
- Pylance (si pas Python)
- GitHub Actions
- Docker/Containers

### Fermer fenêtres VSCode/Cursor inutilisées
Chaque instance spawn :
- 2+ tsserver (syntaxique + sémantique)
- 5-10 language servers (ESLint, Tailwind, JSON, YAML...)

## Historique

**2026-05-11 :** Fix Node process leaks via HMR cleanup guard
- [Documentation complète](docs/fixes/2026-05-11-node-process-leaks.md)
