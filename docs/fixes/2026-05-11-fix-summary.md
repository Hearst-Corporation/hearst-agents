# Fix Node Process Leaks — Résumé

## ✅ Problème résolu

**Avant :** 20+ processus node zombies après chaque HMR
**Après :** 4-6 processus (baseline normal)

## 🔧 Changements appliqués

### 1. Nouveau module HMR Cleanup Guard

**`lib/runtime/hmr-cleanup.ts`**

- Hook `module.hot.dispose()` pour Next.js dev
- Fallback `SIGTERM/SIGINT` pour production
- API : `registerHMRCleanup(() => clearInterval(timer))`

### 2. Schedulers modifiés (3)

- ✅ `lib/engine/runtime/missions/scheduler-init.ts` (heartbeat + scheduler)
- ✅ `lib/engine/runtime/missions/scheduler.ts` (polling loop)
- ✅ `lib/engine/runtime/assets/cleanup/scheduler.ts` (daily cleanup)

### 3. Script de nettoyage manuel

**`scripts/kill-node-zombies.sh`**

- Préserve Next.js (port 9001) + ses enfants
- Kill tous les autres node/npm zombies
- Usage : `npm run kill:zombies`

### 4. Documentation

- `docs/fixes/2026-05-11-node-process-leaks.md` (détail technique)
- `docs/NODE_PROCESS_MANAGEMENT.md` (guide maintenance)

## 📊 Vérification

```bash
# Compter processus (devrait être 4-6)
ps aux | grep -E "node|npm" | grep -v grep | grep -v "Helper" | wc -l

# Nettoyage si nécessaire
npm run kill:zombies
```

## 🚀 Prochaines étapes

1. **Monitorer** pendant 24-48h pour confirmer stabilité
2. **Audit** des 57 autres `setInterval/setTimeout` dans le code
3. **Propager** le pattern HMR cleanup aux modules restants

## 📝 Commits

- HMR cleanup guard + scheduler fixes
- Script kill-node-zombies.sh
- Documentation maintenance
