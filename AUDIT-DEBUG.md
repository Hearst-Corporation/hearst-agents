# AUDIT DEBUG — Cockpit Dashboard vs Design Ref

## Contexte
Le dashboard cockpit (`app/(user)/cockpit-x/CockpitXClient.tsx`) a été partiellement modifié mais reste très éloigné du design de référence "Master Vault". Seul le cockpit mode a un layout basique (PageLayout + KpiGrid). Tous les autres stages (12 stages) n'ont AUCUN layout standardisé.

## Design de référence (HTML fourni par l'utilisateur)
Le design cible "Cockpit Master Vault" contient :
- `ct-rail-left` : logo + 1 bouton "+" + avatar (PAS 12 icônes)
- `ct-page-area` : eyebrow + title + subtitle + KPI grid 4x2 + sparkline + source bars + grids 2col/3col
- `ct-rail-right` : header "Assistant · Hearst Cortex" + 3 boutons + chat
- `ct-bottom-bar` : navigation par onglets (Overview/Search/Graph/Projects/Patterns/Ingest/Connectors/Admin/Cost)
- `ct-hub-bar` : label "Cockpit" + segments Overview/Catalog
- `ct-ambient-lights` : blobs animés en arrière-plan

## Écarts actuels (non corrigés)

### 1. Layout — SEULEMENT le cockpit a PageLayout
- ✅ Cockpit mode : utilise `PageLayout` + `KpiGrid`
- ❌ 12 stages (chat, mission, asset, browser, voice, meeting, kg, artifact, signal, asset_compare, simulation, connections) : AUCUN layout standardisé
- Chaque stage a son propre header maison avec des styles différents
- Aucun max-width centré, aucune cohérence visuelle

### 2. Fontes — NON uniformisées
- Le CSS global définit `--font-satoshi: "Satoshi Variable", "Satoshi", sans-serif` avec `letter-spacing: -0.01em`
- Mais les stages utilisent des styles Tailwind arbitraires (`t-30`, `t-28`, etc.) sans cohérence
- Les composants créés (PageLayout, KpiGrid) utilisent des styles inline qui ne reprennent pas les tokens du design system

### 3. Couleurs — INCohérentes
- Design ref utilise `#3FA7E0` (bleu)
- Code actuel utilise `#2ecFC2` (cyan) — confirmé par l'utilisateur comme la bonne couleur
- Mais les tokens CSS définissent `--accent-teal: #4a8b86` (vert-bleu foncé)
- Les stages utilisent des couleurs hardcodées différentes

### 4. Header du chat — PARTIELLEMENT fait
- ✅ Titre "Assistant · Hearst Cortex" + dot
- ✅ Boutons historique, paramètres, nouveau
- ❌ Manque la fonctionnalité réelle des boutons (juste des placeholders)

### 5. Bottom bar / Hub bar — SUPPRIMÉS (pas refaits)
- L'utilisateur a demandé de les enlever temporairement
- À réintégrer proprement quand le design sera finalisé

### 6. Ambiance lumineuse — FAITE mais basique
- 2 blobs animés ajoutés dans AmbientLayers
- Peut être enrichie (plus de blobs, couleurs, etc.)

## Fichiers à modifier

### Priorité 1 — Uniformiser le layout de TOUS les stages
`app/(user)/cockpit-x/CockpitXClient.tsx` :
- Le wrapper ajouté (`<div style={{ width: "100%", maxWidth: "720px"... }}>`) est une rustine
- Il faut que chaque stage utilise `PageLayout` avec eyebrow/title/subtitle cohérents
- OU créer un `StageLayout` wrapper qui standardise le header de chaque stage

### Priorité 2 — Créer un vrai design system partagé
`app/(user)/_shell/` :
- `PageLayout.tsx` : OK mais incomplet (pas de support pour les grids 2col/3col)
- Créer : `CtGrid.tsx` (grille 2col/3col), `CtSparkline.tsx`, `CtSourceBar.tsx`
- Créer : `StageLayout.tsx` (wrapper pour tous les stages avec header standard)

### Priorité 3 — Refactoriser chaque stage
Les 12 stages dans `app/(user)/_stages/` :
- Chacun a son propre header maison à remplacer par `StageLayout`
- Chacun utilise des styles différents ( Tailwind classes arbitraires)
- À uniformiser avec les tokens du design system

## Tokens CSS du design system (depuis `app/globals.css`)
```css
--font-satoshi: "Satoshi Variable", "Satoshi", sans-serif;
--font-sans: "Satoshi Variable", "Satoshi", sans-serif;
--font-mono: "Satoshi Variable", "Satoshi", sans-serif;

--bg: #000000;
--text: #ffffff;
--text-soft: rgba(255,255,255,0.88);
--text-muted: rgba(255,255,255,0.65);
--text-faint: rgba(255,255,255,0.45);
--text-ghost: rgba(255,255,255,0.42);

--accent-teal: #4a8b86;  /* WARNING: user wants #2ecFC2 */
--surface-1: rgba(255,255,255,0.025);
--border-shell: rgba(255,255,255,0.06);
```

## Notes
- L'utilisateur veut garder le menu gauche avec les 12 icônes (pas le design ref à 1 bouton)
- L'utilisateur confirme `#2ecFC2` comme couleur accent (pas `#3FA7E0` du ref)
- Le chat doit rester persistant sur TOUTES les pages
- Push direct sur main autorisé (solo dev)
