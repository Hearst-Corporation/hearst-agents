# Audit lab/cli-os/cockpit — 2026-05-15

## Verdict global

Code proprement structuré pour un prototype sandbox : séparation en sous-composants claire, typage TypeScript solide sur CockpitScene. Les problèmes critiques sont deux classes CSS manquantes qui causent du rendu silencieusement cassé, et des variants Framer Motion définis dans le render body ce qui force des re-allocations à chaque cycle. **Score qualité : 7/10.**

---

## P0 — Bugs / risques (à corriger en priorité)

### [1] Classes CSS manquantes : `vision-rail-left` et `vision-rail-right`

**Zone** : `CockpitScene.tsx:69` (LeftRail), `CockpitScene.tsx:122` (RightRail)

**Problème** : `LeftRail` applique `vision-rail-left` et `RightRail` applique `vision-rail-right` sur leurs conteneurs. Ces deux classes ne sont définies nulle part dans `styles.css`. Les seules classes `vision-*` définies sont : `vision-glass`, `vision-btn-primary`, `vision-btn-glass`, `vision-segmented-track`, `vision-content-depth`, `vision-footer-float`.

**Impact** : Les styles prévus pour les rails (translateZ, effets glass spécifiques, bordures) ne s'appliquent pas. Le rendu peut paraître correct visuellement si les classes étaient intentionnellement vides, mais c'est une dette silencieuse — un refactor ou migration pourrait supposer qu'elles existent et ajoutent des styles.

**Reco** : Soit ajouter les définitions manquantes dans `styles.css` (si elles devaient exister), soit supprimer les classes de la JSX (si elles sont vestigiales d'une version antérieure).

---

### [2] Token CSS `--color-line` inexistant utilisé dans `App.tsx`

**Zone** : `App.tsx:41` — `border-[var(--color-line)]`

**Problème** : `--color-line` n'est pas défini dans le `@theme` de `styles.css`. Les tokens définis sont `--color-border`, `--color-border-soft`, `--color-border-strong`. La border de la liste des scènes sur la page d'index tombe donc en `undefined`, ce qui élimine silencieusement la séparation visuelle.

**Impact** : Sur la page `/` (index), les lignes séparant les scènes disparaissent. Bug visible immédiatement au chargement.

**Reco** : Remplacer `var(--color-line)` par `var(--color-border)` dans `App.tsx:41`.

---

### [3] Variants Framer Motion définis dans le render body — re-allocations à chaque render

**Zone** : `CockpitScene.tsx:108-119` (RightRail) et `CockpitScene.tsx:220-231` (CockpitScene)

**Problème** : `containerVariants`, `itemVariants`, `listVariants` sont des objets littéraux définis **à l'intérieur** des fonctions composant. À chaque render de `RightRail` ou `CockpitScene`, ces objets sont recréés. Framer Motion compare les variants par référence — si l'objet change, FM peut déclencher des ré-animations involontaires ou des sauts.

**Impact** : En sandbox visuelle le risque de régression est limité, mais sur les listes animées (10 `motion.li` avec stagger) un re-render parent (ex: `activeSlot` change dans `CockpitScene`) peut re-déclencher l'animation stagger complète.

**Reco** : Sortir ces objets en constantes module-level, hors des fonctions composant :

```ts
const LIST_VARIANTS = { hidden: ..., show: ... };
const ITEM_VARIANTS = { hidden: ..., show: ... };
```

---

## P1 — Améliorations (qualité code)

### [4] `toggle` state dans `CockpitScene` — state orphelin sans effet visible

**Zone** : `CockpitScene.tsx:218` — `const [toggle, setToggle] = useState<...>("filtre-1")`

**Problème** : `toggle` contrôle le segmented du filtre activité (ligne 322, `aria-pressed={toggle === opt}`). Mais la liste d'activités (`motion.ul` lignes 334-360) est statique — elle ne filtre rien selon `toggle`. Résultat : l'état existe, le toggle est interactif, mais il n'a aucun effet sur le contenu rendu.

**Impact** : Dans le prototype c'est acceptable (données placeholder), mais si quelqu'un porte ce composant en prod sans noter ce gap, le toggle sera silencieusement inutile.

**Reco** : Ajouter un commentaire `// TODO: filtrer activité par toggle` sur la `motion.ul` ou brancher un filtre factice pour valider le pattern.

---

### [5] Segmented control footer sans état contrôlé — active item hardcodé

**Zone** : `FloatingFooter`, `CockpitScene.tsx:175-209`

**Problème** : Les deux segmented controls du footer déterminent l'item actif via `index === 0` (hardcodé). Aucun state ne les pilote. Les `motion.button` sont interactifs (whileTap) mais un clic ne change rien.

**Impact** : UX trompeuse — les boutons sont visuellement des contrôles interactifs mais sont de fait des affichages statiques. En migration vers Hearst, le dev qui porte ce composant devra ajouter le state manquant.

**Reco** : Soit ajouter un `useState` dans `FloatingFooter` (ou remonter en props depuis `CockpitScene`), soit retirer `whileTap` pour signaler visuellement que ce n'est pas interactif.

---

### [6] Tailles de police hardcodées hors tokens

**Zone** : `CockpitScene.tsx:255` et `CockpitScene.tsx:278`

**Problème** : `text-[44px]` (h1 greeting) et `text-[32px]` (h2 hero title) sont des magic numbers hors des tokens définis dans `@theme`. Les tokens disponibles vont de `--text-cap` (11px) à `--text-xl` (40px). Ces valeurs (44px, 32px) pourraient correspondre à `--text-xl` (40px ≈ 44px) et `--text-lg` (28px ≈ 32px) avec ajustement, ou nécessitent deux nouveaux tokens `--text-2xl` et `--text-display`.

**Impact** : Incohérence système — si on change l'échelle typographique dans `@theme`, ces deux tailles ne suivent pas.

**Reco** : Ajouter `--text-display: 44px` et `--text-2xl: 32px` dans `@theme` de `styles.css`, puis utiliser `text-display` et `text-2xl` en JSX.

---

### [7] `vision-glass::before` sans `position: relative` garantie sur l'hôte

**Zone** : `styles.css:164-174`

**Problème** : `.vision-glass::before` est `position: absolute; inset: 0`. Pour que ce pseudo-élément soit contenu dans l'hôte, l'hôte doit être `position: relative` (ou absolute/fixed). Dans `CockpitScene.tsx`, tous les éléments avec `vision-glass` ont bien `relative` via `relative flex...` dans leur className — mais c'est une convention implicite. Si un futur usage de `vision-glass` omet `relative`, le `::before` s'échappe du conteneur et peut couvrir des éléments voisins.

**Impact** : Pas de bug actuel, mais fragilité documentée du pattern.

**Reco** : Ajouter `position: relative` directement dans `.vision-glass` dans `styles.css` pour le rendre self-sufficient.

---

### [8] `RightRail` — liste d'items hardcodée en JSX anonyme

**Zone** : `CockpitScene.tsx:127-133`

**Problème** : Les 5 items du rail droit sont définis en objet littéral inline à l'intérieur du JSX. Contrairement à `LEFT_RAIL_SLOTS` ou `TOGGLE_OPTIONS` qui sont des constantes module-level, ces données n'ont pas de nom.

**Impact** : Lisibilité réduite. Si on veut ajouter un 6e item ou changer `hot: true` sur un autre, on doit fouiller dans la JSX. Moins critique que les P0, mais nuit à la maintenabilité.

**Reco** : Extraire en constante module-level :

```ts
const RIGHT_RAIL_ITEMS = [
  { id: "feed-1", hot: false },
  ...
] as const;
```

---

## P2 — Polish (nice to have)

### [9] Classes ternaires longues non extraites

**Zone** : `CockpitScene.tsx:87-88` (LeftRail boutons), `CockpitScene.tsx:141-142` (RightRail items)

**Problème** : Les classes active/inactive des boutons sont des strings Tailwind très longues en ternaire inline. L'actif et l'inactif partagent 60-70% de classes communes.

**Reco** : Extraire un helper `cn(base, isActive && activeClass)` ou utiliser `clsx`. Réduit le bruit visuel et facilite les modifs futures.

---

### [10] `LeftRail` — `<aside>` sans `aria-label`

**Zone** : `CockpitScene.tsx:68`

**Problème** : `<aside className="...">` sans `aria-label`. Un lecteur d'écran annonce "complémentaire" sans contexte. `RightRail` a le même problème (ligne 122).

**Impact** : A11y mineure en prototype, mais à corriger avant port en prod.

**Reco** : Ajouter `aria-label="Navigation principale"` sur LeftRail et `aria-label="Contexte"` sur RightRail.

---

### [11] `FloatingFooter` — `<footer>` dans un `absolute` sans `aria-label`

**Zone** : `CockpitScene.tsx:163`

**Problème** : `<footer>` sans `aria-label`. Dans un layout complexe avec plusieurs landmarks, les lecteurs d'écran listent tous les `<footer>` — un label aide la navigation.

**Reco** : `aria-label="Actions cockpit"`.

---

### [12] Tokens définis dans `@theme` jamais utilisés dans CockpitScene

**Zone** : `styles.css:10-60` vs usages réels

**Problème** : Les tokens de couleur (`--color-bg-elev-1/2/3`, `--color-border`, `--color-border-soft`, `--color-border-strong`, `--color-fg-dim`, `--color-fg-mute`, `--color-fg-faint`) sont définis mais CockpitScene les ignore systématiquement — il utilise `rgba(255,255,255,0.N)` hardcodé partout. Les tokens de motion (`--ease-spring`, `--ease-out`, `--duration-fast/base/slow`) sont aussi définis mais les transitions utilisent les valeurs cubiques hardcodées directement en JSX.

**Impact** : Le système de tokens est là mais pas utilisé — si on change un token, l'UI ne suit pas. Faible impact en sandbox, dette si port en prod.

**Reco** : Pas urgent, mais lors du port Hearst, remplacer les `rgba(255,255,255,0.5)` récurrents par les tokens `--color-fg-mute` etc.

---

### [13] `lucide-react` déclarée en dep mais inutilisée

**Zone** : `package.json:18`

**Problème** : `lucide-react: ^0.460.0` est dans les deps mais aucun fichier dans `src/` ne l'importe (`grep -rn "lucide-react" src/` → vide, sauf `ChartsScene.tsx` qui ne l'importe pas non plus).

**Impact** : Bundle légèrement alourdi (lucide-react est tree-shakeable mais la dep reste dans node_modules).

**Reco** : Supprimer de `package.json` si aucune scène ne l'utilise.

---

## Points positifs

1. **Séparation composants exemplaire** : `AmbientLayers`, `LeftRail`, `RightRail`, `FloatingFooter`, `CockpitScene` ont chacun une responsabilité unique et claire. Pas de god-component.

2. **Props drilling minimal** : seul `LeftRail` reçoit `{ activeSlot, setActiveSlot }` depuis `CockpitScene`. `RightRail` et `FloatingFooter` sont totalement autonomes — bon pattern pour une sandbox prototype.

3. **`aria-hidden` sur les décorations** : `AmbientLayers` (lignes 37, 48) et le fade-scrim (ligne 367) ont tous `aria-hidden` — discipline a11y correcte sur les éléments purement visuels.

4. **`aria-pressed` sur le toggle filtre** : `CockpitScene.tsx:321` — le segmented control du filtre activité est le seul bouton toggle avec `aria-pressed`, ce qui est exactement le bon pattern ARIA pour un état binaire.

5. **`navigation-truth.ts` exhaustif et à jour** : Le fichier de cartographie est bien maintenu (stages, stores, hotkeys, routes, known gaps) et représente une vraie source de vérité utilisable pour le port back.

---

## Métriques rapides

| Métrique | Valeur |
|---|---|
| Lignes CockpitScene.tsx | 382 |
| Sous-composants | 6 (Ph, IconSlot, AmbientLayers, LeftRail, RightRail, FloatingFooter) + CockpitScene |
| Tokens `@theme` définis | ~33 déclarations CSS |
| Tokens utilisés dans CockpitScene | 0 (tous les styles sont inline rgba ou Tailwind utilitaires) |
| Classes `vision-*` définies | 6 |
| Classes `vision-*` utilisées dans CockpitScene | 8 (dont 2 manquantes : `vision-rail-left`, `vision-rail-right`) |
| Erreurs TypeScript (CockpitScene) | 0 |
| Erreurs TypeScript (ChartsScene) | 11 (hors périmètre) |
| Token CSS manquant (`--color-line`) | 1 (App.tsx) |
| Warnings console (CockpitScene runtime) | non mesurable via browser fermé — 0 warning attendu |
| Erreurs console | 0 attendu (serveur :5173 répond 200) |
