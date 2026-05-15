---
description: Inspection système macOS — zombies, doublons Node, ports fantômes, caches. Confirmation explicite avant kill/rm.
---

# /syscheck — Inspection système macOS

Diagnostic local. **Aucun kill/rm automatique**. Tout est proposé, l'utilisateur confirme par `o` ou `oui`.

## Whitelist protégée (jamais touchée)

!ps aux | grep -E "npm run|next dev|next start|turbopack|vitest|playwright" | grep -v grep
!lsof -i :3000 -i :3001 -i :54321 -i :5432 2>/dev/null | grep LISTEN

Ces processus + ports sont intouchables pour toute la session.

## Passe 1 — Zombies

!ps aux | awk '$8 ~ /Z/ {print $2, $11}'

Lister. Pour chaque zombie : identifier parent. **Proposer** kill parent si pas dans whitelist. Attendre `o` avant action.

## Passe 2 — Doublons Node

!ps aux | grep -E "node|npm" | grep -v grep | awk '{print $2, $9, $11, $12}' | sort -k3

Identifier instances multiples sur même script/port. **Proposer** kill des plus anciens, garder le plus récent. Attendre `o`.

## Passe 3 — Ports fantômes

!lsof -i -P -n 2>/dev/null | grep LISTEN | grep -E ":[3-9][0-9]{3}" | awk '{print $1, $2, $9}' | sort -k3

Pour chaque port hors whitelist : PID, chemin binaire, parent vivant ou non. **Proposer** kill si orphelin. Attendre `o`.

## Passe 4 — Caches & node_modules orphelins

!du -sh ~/.npm/_npx 2>/dev/null
!du -sh ~/.npm/_cacache 2>/dev/null
!find /Users/adrienbeyondcrypto/Dev -name "node_modules" -maxdepth 3 -type d 2>/dev/null | while read d; do parent=$(dirname "$d"); if [ ! -f "$parent/package.json" ]; then echo "ORPHELIN: $(du -sh "$d" | cut -f1) $d"; fi; done

**Proposer** :
- `npm cache clean --force` si cache > 500 Mo
- Supprimer `node_modules` orphelins listés ci-dessus

Attendre `o` pour chaque action.

## Passe 5 — Logs lourds

!find /tmp -maxdepth 2 -name "*.log" -size +10M 2>/dev/null | head -10
!find ~/Library/Logs -name "*.log" -size +50M 2>/dev/null | head -10
!find /Users/adrienbeyondcrypto/Dev -name "*.log" -size +5M -not -path "*/node_modules/*" 2>/dev/null | head -10

**Proposer** suppression. Attendre `o` pour chaque.

## Agrégation → render-report

```json
{
  "title": "Inspection système macOS",
  "kpis": { "p0": zombies_count, "p1": doublons_count, "p2": caches_mo_libérables },
  "sections": [
    { "name": "Whitelist active", "findings": [...] },
    { "name": "Zombies", "findings": [...] },
    { "name": "Doublons Node", "findings": [...] },
    { "name": "Ports fantômes", "findings": [...] },
    { "name": "Caches & orphelins", "findings": [...] },
    { "name": "Logs lourds", "findings": [...] }
  ]
}
```

Chaque finding `status` indique : `proposé` | `accepté` | `refusé` | `protégé`.

!node scripts/render-report.mjs --type=syscheck --data=/tmp/syscheck-data.json --open

## Réponse finale (5 lignes max)

```
Syscheck · Zombies:N Doublons:N Ports:N Caches:X Mo Logs:Y Mo
Whitelist : K processus protégés
Actions proposées : Z (en attente confirmation)
Rapport : docs/audit/syscheck-YYYY-MM-DD.html
```

## Règle absolue

**Aucun `kill`, `rm`, `npm cache clean` ne s'exécute sans `o` explicite de l'utilisateur dans la même session.** Le rapport liste les propositions ; les actions arrivent ensuite seulement sur confirmation.
