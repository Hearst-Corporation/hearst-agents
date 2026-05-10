---
description: Analyse les gaps de couverture et génère les specs de test prioritaires (Vitest + Playwright)
---

# /test — Couverture & gaps de tests

Analyse l'état des tests existants, identifie les cas non couverts, et génère les specs prioritaires.

## Arguments optionnels

`$ARGUMENTS` — scope ciblé (ex: `app/api/` pour les routes, `components/missions/` pour un module UI, `e2e/` pour Playwright seul). Vide = analyse complète.

## Étape 1 — État des tests existants

!find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" | grep -v node_modules | sort
!find e2e/ -name "*.spec.ts" 2>/dev/null | sort
!npx vitest run --reporter=verbose 2>/dev/null | tail -30

Compte : N tests unitaires, M tests e2e. Taux de succès.

## Étape 2 — Couverture par module

!npx vitest run --coverage --reporter=json 2>/dev/null | node -e "try{const d=JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json','utf8'));Object.entries(d).forEach(([f,c])=>{if(f!=='total'&&c.lines.pct<80)console.log(c.lines.pct+'%\t'+f)})}catch(e){console.log('pas de rapport coverage')}" 2>/dev/null | sort -n | head -40

Identifie les fichiers < 80% de couverture ligne.

## Étape 3 — Zones sans aucun test

!find app/api/ -name "route.ts" | while read f; do base="${f%route.ts}"; if ! find . -name "*.test.ts" -path "*${base}*" 2>/dev/null | grep -q .; then echo "SANS TEST: $f"; fi; done | head -30

!find app/ lib/ -name "*.ts" -not -name "*.test.*" -not -path "*/node_modules/*" | while read f; do base=$(basename "$f" .ts); if ! grep -rq "$base" . --include="*.test.*" --include="*.spec.*" 2>/dev/null; then echo "SANS TEST: $f"; fi; done | head -30

## Étape 4 — Analyse des cas manquants

Pour chaque fichier identifié comme critique (routes API, stores, utilitaires core), liste les cas de test manquants :

- **Happy path** non couvert
- **Edge cases** : valeurs limites, types inattendus, payloads vides
- **Erreurs** : 400/401/403/404/500 sur les routes API
- **Concurrence** : double submit, race conditions
- **Auth** : accès sans session, session expirée, permissions insuffisantes

## Rapport & specs générées

Pour les 5 gaps les plus critiques, génère la spec complète :

**Tests unitaires Vitest :**
```typescript
// chemin/du/fichier.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('NomModule', () => {
  it('devrait ... (happy path)', async () => { ... })
  it('devrait rejeter si ... (edge case)', async () => { ... })
  it('devrait retourner 401 si non authentifié', async () => { ... })
})
```

**Tests e2e Playwright :**
```typescript
// e2e/nom-feature.spec.ts
import { test, expect } from '@playwright/test'

test('flux principal — ...', async ({ page }) => { ... })
test('cas limite — ...', async ({ page }) => { ... })
```

Priorise : routes API sans test > stores critiques > composants avec logique métier > UI pure.

## Rapport HTML — ouverture automatique Chrome

Une fois le rapport textuel produit, génère un fichier HTML complet à `/tmp/rapport-tests.html` et ouvre-le dans Chrome.

Le HTML doit :
- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "Couverture & gaps de tests", date/heure, scope analysé
- Jauge globale de couverture en % avec arc de cercle SVG (rouge < 50%, orange < 80%, vert >= 80%)
- Tableau des fichiers < 80% couverture : barre de progression par fichier, colorée selon le % (rouge/orange/vert)
- Section "Zones sans test" : liste des fichiers critiques non couverts, classés par priorité (API > stores > logique > UI)
- Section "Specs générées" : les 5 specs prêtes à copier, dans des blocs `<pre>` avec syntaxe colorée (TypeScript)
- Chaque fichier cliquable `vscode://file/...`
- Footer : N tests existants, M gaps identifiés, date

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-tests.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-tests.html
