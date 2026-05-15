---
description: Mode design — audit DS, sandbox HTML interactif, itération visuelle, prompt Sonnet (nettoyage) ou Gemini Pro (3D/avancé).
argument-hint: [sandbox|sonnet|gemini] (vide = flow complet)
---

# /design — Mode design

Trois temps :

1. **Audit** — état réel du design system (tokens, gaps, hardcoding)
2. **Sandbox** — HTML interactif standalone pour explorer les directions visuelles
3. **Prompt** — selon la direction validée : Sonnet (nettoyage/tokens) ou Gemini Pro (3D/avancé)

L'agent **ne touche pas au code** pendant la phase d'itération. Il dialogue, montre, propose. Le commit vient après.

## Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → audit + sandbox OK, pas de modification code.

## Raccourcis via argument

- `$ARGUMENTS` = `sandbox` → saute l'audit, régénère le sandbox uniquement
- `$ARGUMENTS` = `sonnet` → génère directement le prompt Sonnet sans audit
- `$ARGUMENTS` = `gemini` → génère directement le prompt Gemini sans audit
- Vide → flow complet (audit → sandbox → itération → prompt)

---

## Phase 1 — Audit design system

Lire en parallèle (subagent_type: `Explore`) :

### Agent A — Tokens globals.css

Lire [app/globals.css](app/globals.css) intégralement.

Cartographier :

- **Couleurs** : `--cykan`, `--accent-teal`, `--text-*`, `--surface-*`, `--border-*`, etc.
- **Spacing** : `--space-*` (lister toutes les valeurs)
- **Typographie** : classes `.t-*`, `--font-*`
- **Radius** : `--radius-*`
- **Shadows** : `--shadow-*`
- **Motion** : `--duration-*`, `--ease-*`

Identifier les **trous** : tokens manquants utilisés dans le code mais non définis, valeurs redondantes, incohérences.

### Agent B — Hardcoding scan

Grep ciblé sur les 10 fichiers les plus modifiés récemment :

- `git diff --name-only HEAD~10 | head -10`
- Pour chacun : couleurs hex/rgb, px bruts, radius hardcodés

Quantifier : N valeurs hardcodées vs N tokens utilisés → \*\*taux de conformité DS %.

### Agent C — Composants primitifs

Lister les primitives DS existantes :

- `grep -rEn "export.*function|export const" app/(user)/components/ui/ components/ --include="*.tsx" 2>/dev/null | head -40`

Cartographier : quels composants existent, lesquels manquent, quels patterns sont dupliqués 3+ fois sans primitive.

## Sortie Phase 1 (5 lignes dans le terminal)

```
DS état : <N tokens définis> · conformité <X>% · <N> trous
Primitives : <N> existantes · <M> patterns non extraits
Hardcoding : <K> valeurs brutes dans les <10> fichiers récents
Direction suggérée : [nettoyage tokens | refonte typo | exploration 3D | stabilisation]
→ Sandbox en cours de génération...
```

---

## Phase 2 — Génération du sandbox HTML

Créer `docs/design/sandbox-YYYY-MM-DD.html` — un outil de design standalone, beau, interactif.

Le sandbox doit être **premium et utilisable** : pas un doc de référence ennuyeux, un vrai canvas de travail.

### Structure du sandbox

```html
<!-- Structure générale -->
<header>Hearst OS Design Sandbox · date · version</header>
<nav sticky>Palette · Typo · Spacing · Radius/Shadow · Motion · Composants · Explorer</nav>

<!-- Section Palette -->
<!-- Toutes les couleurs du DS en swatches cliquables -->
<!-- Clic → copie le var(--token) dans le clipboard -->
<!-- Chaque swatch : carré 80px, nom token, valeur hex, preview sur fond dark + fond clair -->

<!-- Section Typographie -->
<!-- Chaque classe .t-* en preview live avec le texte "Hearst OS — Silent luxury" -->
<!-- Taille réelle, weight, tracking, leading affichés -->
<!-- Toggle entre dark/semi pour voir le contraste -->

<!-- Section Spacing -->
<!-- Barres visuelles proportionnelles pour chaque --space-* -->
<!-- Valeur en px affichée, nom token -->

<!-- Section Radius & Shadows -->
<!-- Grid de cards avec chaque combo radius/shadow -->
<!-- Hover pour voir les états card-hover -->

<!-- Section Motion -->
<!-- Boutons qui déclenchent des animations live avec chaque --duration-* et --ease-* -->
<!-- Comparatif côte-à-côte : rapide vs lent, ease vs ease-out -->

<!-- Section Composants -->
<!-- Preview de chaque primitive DS : Action, SectionHeader, RailSection, EmptyState, RowSkeleton, CardSkeleton -->
<!-- États : default · hover · active · disabled · loading -->
<!-- Code snippet copiable en dessous de chaque preview -->

<!-- Section Explorer (canvas d'idées) -->
<!-- Zone libre avec des "blocs" de direction à tester : -->
<!--   Bloc A : direction actuelle (tokens actuels, voix sobre) -->
<!--   Bloc B : variation 1 (ex: typo plus expressive, plus d'air) -->
<!--   Bloc C : variation 2 (ex: couleur accent plus chaude, radius plus doux) -->
<!--   Bloc D : direction 3D (prompt pour Gemini) -->

<!-- Footer Prompts -->
<!-- Deux sections : SONNET et GEMINI avec les prompts ready-to-paste -->
```

### Contraintes HTML sandbox

- Standalone — zéro dépendance externe, tout en vanilla CSS + JS inline
- Dark theme : `#0a0a0a` fond, `#e8e8e8` texte, `#00e5cc` accent
- Tokens CSS définis en `:root` **répliqués depuis globals.css** — le sandbox reflète l'état réel
- Navigation sticky latérale ou top avec scroll-spy
- Pas de framework — CSS grid natif, `@property` CSS si utile
- Auto-open Chrome à la fin : `open -a "Google Chrome" docs/design/sandbox-YYYY-MM-DD.html`

---

## Phase 3 — Itération (le cœur de la commande)

Une fois le sandbox ouvert dans Chrome, poser **une seule question** à Adrien :

```
Sandbox ouvert. 4 directions possibles :

  A  Nettoyage DS     — retirer tout le hardcoding, consolider les tokens,
                        homogénéiser les primitives. Sonnet s'en charge.

  B  Évolution douce  — affiner la palette, respirer la typo, ajuster
                        radius/shadows. On itère ici d'abord, puis Sonnet applique.

  C  Refonte ambitieuse — nouvelle direction visuelle (couleur, hiérarchie,
                          rythme). On maquette dans le sandbox, puis Sonnet code.

  D  3D / avancé      — Spline natif R3F, shaders, DOF, particules, effets
                        luxe poussés. Gemini Pro génère l'architecture.

Tape A / B / C / D (ou décris ta direction).
```

Attendre la réponse. Ne rien modifier dans le code avant.

---

## Phase 4 — Génération du prompt selon direction

### Si A ou B → Prompt Sonnet (nettoyage / évolution douce)

Générer un prompt prêt-à-coller pour Claude Sonnet, affiché dans le terminal ET dans le sandbox section footer.

Structure du prompt Sonnet :

```
Tu es Claude Sonnet. Tu travailles sur Hearst OS (Next.js 15, Tailwind v4, design system dark).

CONTEXTE DS :
- Tokens définis dans app/globals.css : [liste des tokens clés]
- Primitives DS : Action, SectionHeader, RailSection, EmptyState, RowSkeleton, CardSkeleton
- Taux de conformité actuel : X%
- Voix éditoriale : pas de mono caps, pas de halo-on-hover chrome, statuts en FR

MISSION : [selon direction A ou B]

Direction A — Nettoyage :
  Objectif : porter le taux de conformité DS à 100% sur les fichiers suivants.
  Règles :
  - Chaque px brut → token --space-* correspondant ou utility Tailwind mappée
  - Chaque hex → var(--token)
  - Chaque radius hardcodé → var(--radius-*)
  - Chaque shadow brute → var(--shadow-*)
  - Si token manquant → l'ajouter dans globals.css avant de l'utiliser
  Fichiers prioritaires : [liste des N fichiers les plus non-conformes]
  Validation : npm run validate + lint:visual

Direction B — Évolution douce :
  [description de la direction validée par Adrien]
  Tokens à ajouter/modifier : [liste depuis l'itération sandbox]
  Composants à ajuster : [liste]
  Ne pas toucher : app/spatial-safe/**, app/spatial/**

LIVRABLE :
  - git diff propre avec commit message feat(design): <description>
  - npm run validate vert
  - Screenshot Playwright de [page principale] avant/après
```

### Si C → Prompt Sonnet (refonte)

Même structure, avec la nouvelle direction visuelle validée dans le sandbox décrite précisément (couleurs, typo, rythme, tokens à créer).

### Si D → Prompt Gemini Pro (3D / avancé)

Générer un prompt pour Gemini 2.5 Pro, affiché dans le terminal ET dans le sandbox.

Structure du prompt Gemini :

```
Tu es Gemini 2.5 Pro. Tu travailles sur Hearst OS, une app Next.js 15 + React Three Fiber.

CONTEXTE TECHNIQUE :
- Stack : Next.js 15, React 19, R3F (@react-three/fiber), @react-three/drei, Tailwind v4
- Design system : dark (#0a0a0a), accent (#00e5cc), tokens dans app/globals.css
- Spatial existant : app/spatial/ (R3F natif, migration Spline en cours)
- Sauvegarde figée : app/spatial-safe/ (NE PAS TOUCHER)

MISSION : [description précise de la direction 3D/avancée]

Exemples de missions possibles :
  - Scène R3F avec DOF GPU réel (via @react-three/postprocessing) + sélection objet
  - Shader GLSL custom pour effet grain/noise sur surface
  - Caméra cinématique avec spring physics (useSpring + camera rig)
  - Particules réactives aux données utilisateur (BPM, activité, stats)
  - Transition entre mode 2D cockpit et vue 3D spatiale

CONTRAINTES :
  - Performance : 60fps target, LOD sur objets complexes
  - Isolation : tout dans app/spatial/, aucune régression sur app/(user)/
  - Suspense + fallback 2D si WebGL non dispo

LIVRABLE :
  - Architecture de composants (quels fichiers, quelles dépendances npm)
  - Code complet des composants clés
  - Commandes d'installation
  - Checklist de validation perf (Lighthouse, WebGL inspector)
```

---

## Sortie finale

Afficher dans le terminal :

```
Design session · direction : <A|B|C|D>
Sandbox : docs/design/sandbox-YYYY-MM-DD.html
Prompt <Sonnet|Gemini> : copié dans sandbox footer + affiché ci-dessous

─────────────────────────────────────────
<prompt prêt-à-coller>
─────────────────────────────────────────
```

**Ne pas committer.** L'utilisateur colle le prompt dans la session Sonnet ou Gemini dédiée.
