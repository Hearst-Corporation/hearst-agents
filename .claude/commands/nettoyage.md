---
description: Nettoie le codebase — dead code, exports orphelins, magic numbers, dettes lint
---

# /clean — Nettoyage codebase

Analyse statique profonde du codebase pour identifier et supprimer ce qui est mort, redondant ou sale. Opère en 5 passes séquentielles.

## Arguments optionnels

`$ARGUMENTS` — chemin ou glob ciblé (ex: `app/` ou `components/missions/`). Si vide, scope = repo entier.

## Passe 1 — Exports orphelins

!npx knip --reporter json 2>/dev/null | head -200

Identifie : exports non consommés, fichiers jamais importés, re-exports circulaires.

## Passe 2 — Dead code TypeScript

!npx ts-prune --error 2>/dev/null | head -100

Croise avec les résultats knip. Liste les symboles (fonctions, types, constantes) jamais référencés.

## Passe 3 — Magic numbers & inline styles

!grep -rn "style={{" app/ --include="*.tsx" | grep -v "var(--" | head -50
!grep -rn "className=.*#[0-9a-fA-F]\{3,6\}" app/ --include="*.tsx" | head -30
!grep -rn "className=.*\b\(px\|py\|p\|m\|gap\)-\[" app/ --include="*.tsx" | head -30

Identifie les valeurs hardcodées qui devraient passer par un token `globals.css`.

## Passe 4 — Dettes lint

!npx eslint . --format json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>f.messages.forEach(m=>console.log(f.filePath+':'+m.line+' ['+m.severity+'] '+m.message)))" 2>/dev/null | head -80

## Passe 5 — TODO / FIXME obsolètes

!grep -rn "TODO\|FIXME\|HACK\|XXX" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -50

## Rapport final

Pour chaque finding, produis une entrée structurée :

```
[TYPE] fichier:ligne
  Problème : <description courte>
  Action   : <supprimer / remplacer par token / migrer vers DS>
  Risque   : faible | moyen | élevé
```

Groupe par type. Trie par risque décroissant.

**Règle de sécurité** : ne supprime jamais automatiquement un symbole marqué `@public`, un export depuis `index.ts` racine, ou un fichier dans `app/api/`. Ces items nécessitent confirmation.

Après rapport, propose un plan de nettoyage en batches avec `git commit` par batch.

## Rapport HTML — ouverture automatique Chrome

Une fois le rapport textuel produit, génère un fichier HTML complet à `/tmp/rapport-nettoyage.html` et ouvre-le dans Chrome.

Le HTML doit :
- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "Nettoyage codebase", date/heure, scope analysé
- Compteurs visuels en haut : total findings, répartis par type (exports, dead code, magic numbers, lint, TODO)
- Pour chaque finding : badge coloré par risque (rouge=élevé, orange=moyen, vert=faible), fichier cliquable `vscode://file/...`, description, action recommandée
- Section "Plan de nettoyage" avec les batches proposés dans l'ordre
- Footer : durée d'analyse, commande lancée

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-nettoyage.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-nettoyage.html
