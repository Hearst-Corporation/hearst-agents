---
description: Inspecte le système macOS local — zombies, doublons Node, ports fantômes, caches lourds. Kill automatique des sûrs.
---

# /syscheck — Inspection système macOS

Analyse l'environnement macOS local et nettoie ce qui est sûr de tuer, sans toucher au dev en cours.

## Whitelist protégée (ne jamais killer)

Avant toute action, identifie et protège :

!ps aux | grep "npm run" | grep -v grep
!ps aux | grep "next dev\|next start\|turbopack" | grep -v grep
!lsof -i :3000 -i :3001 -i :54321 2>/dev/null | grep LISTEN

Ces processus sont **intouchables** pour toute la session.

## Passe 1 — Processus zombies

!ps aux | awk '$8 == "Z" {print $2, $11}'

Les zombies (état `Z`) sont déjà morts — leur parent ne les a pas collectés. Liste-les. S'il y en a, propose de tuer le processus parent pour les libérer. **Kill automatique si le parent n'est pas dans la whitelist.**

## Passe 2 — Doublons Node.js

!ps aux | grep -E "node|npm" | grep -v grep | awk '{print $2, $11, $12, $13}' | sort -k2

Identifie les instances Node multiples faisant le même travail (même script, même port). Garde le plus récent, propose kill des anciens.

**Kill automatique** : instances Node > 2h sans activité réseau, pas dans la whitelist.

!lsof -i -P -n | grep node | grep LISTEN

## Passe 3 — Ports fantômes

!lsof -i -P -n 2>/dev/null | grep LISTEN | grep -E ":[3-9][0-9]{3}" | awk '{print $2, $9, $1}' | sort -k2

Ports > 3000 occupés par des processus inconnus ou orphelins. Pour chaque port fantôme (processus non reconnu) :

- Identifie le PID et le chemin binaire
- Vérifie si le processus a un parent vivant
- **Kill automatique** si orphelin ET port non dans [3000, 3001, 5432, 54321, 8080]

## Passe 4 — Caches npm/node_modules

!du -sh ~/.npm/\_npx 2>/dev/null
!du -sh ~/.npm/cache 2>/dev/null
!find /Users/adrienbeyondcrypto/Dev -name "node_modules" -maxdepth 3 -type d 2>/dev/null | while read d; do echo "$(du -sh "$d" 2>/dev/null | cut -f1) $d"; done | sort -rh | head -15

Identifie :

- `node_modules` dans des projets sans `package.json` sibling → orphelins, **suppression automatique**
- Cache npm > 500 Mo → propose `npm cache clean --force`
- `node_modules` non touchés depuis > 30 jours dans des projets inactifs → propose suppression

!find /Users/adrienbeyondcrypto/Dev -name "node_modules" -maxdepth 3 -type d -not -path "_/\._" | while read d; do proj=$(dirname "$d"); if [ ! -f "$proj/package.json" ]; then echo "ORPHELIN: $d"; fi; done

## Passe 5 — Fichiers temporaires et logs lourds

!find /tmp -maxdepth 2 -name "_.log" -size +10M 2>/dev/null | head -10
!find ~/Library/Logs -name "_.log" -size +50M 2>/dev/null | head -10
!find /Users/adrienbeyondcrypto/Dev -name "_.log" -size +5M -not -path "_/node_modules/\*" 2>/dev/null | head -10

Logs > 50 Mo dans Library → **suppression automatique**.  
Logs dev > 5 Mo → liste pour confirmation.

## Rapport & actions

```
ZOMBIES     : N tués automatiquement / M en attente confirmation
DOUBLONS    : N tués / M protégés (whitelist)
PORTS       : N libérés / M inconnus (à confirmer)
CACHE NPM   : X Mo libérables → [oui/non]
NODE_MODULES orphelins : X Mo supprimés
LOGS        : X Mo supprimés
```

Pour chaque item "en attente confirmation" :

```
[CONFIRM] PID 12345 — node /chemin/script.js (port 4200, 3h d'activité)
  Tuer ? (o/N)
```

Affiche le gain total en RAM et disque après nettoyage.

## Rapport HTML — ouverture automatique Chrome

Une fois le rapport textuel produit, génère un fichier HTML complet à `/tmp/rapport-syscheck.html` et ouvre-le dans Chrome.

Le HTML doit :

- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "Inspection système macOS", date/heure
- 5 tuiles en grille : Zombies / Doublons Node / Ports / Caches / Logs — chaque tuile avec compteur "tués / protégés / en attente"
- Tuile verte = tout nettoyé, orange = items en attente confirmation, rouge = problème détecté
- Section "Whitelist active" : liste des processus protégés avec PID, commande, uptime
- Section "Actions effectuées" : log chronologique des kills/suppressions avec timestamp et RAM/disque libéré
- Section "En attente de confirmation" : items ambigus avec bouton visuel "[CONFIRMER]" (informatif, pas interactif)
- Bilan final : RAM libérée (Mo), disque libéré (Mo/Go), processus tués
- Footer : durée du scan, heure

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-syscheck.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-syscheck.html
