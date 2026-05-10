---
description: Audit transversal — sécurité, perf, architecture, dépendances. Sortie P0/P1/P2.
---

# /audit — Audit transversal

Audit multi-axe du codebase. Chaque finding reçoit une sévérité et un effort estimé. Opère en 4 axes.

## Arguments optionnels

`$ARGUMENTS` — axe ciblé : `security` | `perf` | `arch` | `deps` | vide = tous les axes.

## Axe 1 — Sécurité (OWASP top 10)

!grep -rn "process\.env\." app/ --include="_.tsx" --include="_.ts" | grep -v "NEXT_PUBLIC" | head -30

Vérifie :

- Variables d'env exposées côté client sans préfixe `NEXT_PUBLIC_`
- `eval()`, `dangerouslySetInnerHTML` sans sanitisation
- SQL/NoSQL injection dans les routes API (`app/api/`)
- Auth manquante sur des routes qui manipulent des données utilisateur
- Secrets hardcodés (regex: `(password|secret|key|token)\s*=\s*["'][^"']{8,}`)

!grep -rn "dangerouslySetInnerHTML" app/ --include="_.tsx" | head -20
!grep -rn "eval(" app/ lib/ --include="_.ts" --include="_.tsx" | head -20
!grep -rEn "(password|secret|apikey|api_key)\s_=\s*[\"'][^\"']{6,}" app/ lib/ --include="*.ts" | head -20

## Axe 2 — Performance

!find app/ -name "\*.tsx" -exec wc -l {} + | sort -rn | head -20

Vérifie :

- Composants > 300 lignes (candidats à la découpe)
- `useEffect` sans dépendances stables (boucles infinies potentielles)
- Images sans `next/image` ou sans `sizes`
- `JSON.parse` / `JSON.stringify` dans des render loops
- Imports barrel qui tirent tout un module pour un seul symbole

!grep -rn "useEffect" app/ --include="_.tsx" | wc -l
!grep -rn "<img " app/ --include="_.tsx" | grep -v "next/image" | head -20

## Axe 3 — Cohérence architecture (ADD)

@docs/AGENT-DRIVEN-DEV.md

Vérifie :

- Fichiers modifiés dans des zones verrouillées sans spec correspondante
- Imports cross-feature qui violent l'isolation des modules
- Stores Zustand avec état dupliqué entre plusieurs stores
- Routes API sans typage des entrées/sorties (pas de `zod` ou équivalent)

!node scripts/list-stores.mjs 2>/dev/null | head -40
!node scripts/list-api-routes.mjs 2>/dev/null | head -40

## Axe 4 — Dépendances

!npm audit --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=d.vulnerabilities||{};Object.entries(v).forEach(([k,v])=>console.log('['+v.severity.toUpperCase()+'] '+k+' — '+v.via[0]?.title||'?'))" 2>/dev/null | head -30
!npx depcheck --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log('Unused:',d.dependencies.join(', '));console.log('Missing:',Object.keys(d.missing).join(', '))" 2>/dev/null

## Rapport final

Chaque finding :

```
[P0|P1|P2] AXE — Titre court
  Fichier  : chemin:ligne
  Problème : description
  Impact   : <ce qui casse si on ne corrige pas>
  Fix      : <action concrète, 1 phrase>
  Effort   : XS | S | M | L
```

**P0** = bloquant prod / faille exploitable  
**P1** = dégradation silencieuse / bug potentiel  
**P2** = dette technique / opportunité d'amélioration

Termine par un résumé : N findings, X P0, Y P1, Z P2.

## Rapport HTML — ouverture automatique Chrome

Une fois le rapport textuel produit, génère un fichier HTML complet à `/tmp/rapport-audit.html` et ouvre-le dans Chrome.

Le HTML doit :

- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "Audit transversal", date/heure, axes analysés
- Compteurs en haut : total findings, avec 3 jauges visuelles P0 / P1 / P2 (barres colorées rouge/orange/jaune)
- Tableau par axe (Sécurité / Perf / Architecture / Dépendances) avec badge sévérité, fichier cliquable `vscode://file/...`, description du problème, fix recommandé, effort estimé
- Les P0 apparaissent en premier, fond légèrement rouge, bordure gauche rouge vif
- Section résumé exécutif en bas : quoi faire en priorité absolue cette semaine
- Footer : date, commande lancée, axes couverts

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-audit.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-audit.html
