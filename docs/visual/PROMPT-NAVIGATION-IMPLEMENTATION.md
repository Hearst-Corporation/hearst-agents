# Prompt — Importer la coquille visionOS Hearst OS dans un nouveau projet

> Prompt à coller dans une session agent qui travaille **dans un projet
> Next.js neuf ou existant**.
>
> L'agent récupère **uniquement le shell visionOS** (la coquille) depuis
> le repo `hearst-os`. Le **contenu** (stages, menus, items, libellés)
> est entièrement de son ressort : il pense les pages selon le métier
> de SON projet.

---

## 📋 Le prompt (à copier tel quel)

```
Tu travailles dans CE projet Next.js. Tu as accès au filesystem local.

Mission : **importer la coquille visionOS Hearst OS** et l'adapter à
CE projet. La coquille est figée, le contenu est libre. Toi tu connais
le métier de CE projet — tu penses les pages, les menus, les actions
en conséquence. Stage par stage. Run local. Quand validé, on déploie.

---

## CE QUI EST FIGÉ (la coquille — tu copies tel quel)

Lis ces 2 fichiers de référence :

1. `/Users/adrienbeyondcrypto/Dev/hearst-os/lab/cli-os/src/scenes/CockpitScene.tsx`
   → **Le shell**. Layout fixe : LeftRail 88px (brand + slots + avatar
   bottom) + Center scrollable + RightRail 320px + FloatingFooter à
   3 zones (status + segmented 3 actions + segmented 2 modes) +
   AmbientLayers (halo blanc + dots teal blurrés) + perspective 3D.

2. `/Users/adrienbeyondcrypto/Dev/hearst-os/lab/cli-os/src/styles.css`
   → **La grammaire visuelle**. Tokens, vision-glass premium,
   vision-btn-primary, vision-btn-glass, vision-segmented-track,
   perspective-scene, vision-content-depth, vision-footer-float,
   noise SVG. Tu portes ça tel quel dans `app/globals.css`.

**Ce qui ne bouge JAMAIS** :
- Structure du shell (LeftRail/Center/RightRail/Footer)
- Dimensions (LeftRail 88, RightRail 320)
- Noms des classes CSS (`vision-glass`, etc.)
- Tokens (couleurs, blur, glass, motion, perspective)
- AmbientLayers (halo + dots teal masqués)
- Ease curves (cubic-bezier(0.22, 1, 0.36, 1) + spring)
- 3D scene (perspective 1200px + preserve-3d)

---

## CE QUI EST LIBRE (le contenu — à toi de penser)

Le repo Hearst OS est UN exemple. Son métier c'est un OS agent
(emails, missions, copilotes, KG, etc.). **TON projet a son propre
métier.** Tu ne reproduis PAS les stages Hearst OS. Tu inventes les
TIENS, ceux qui font sens pour ce projet.

**Tu décides** :
- Combien de stages tu as et lesquels (peut-être 3, peut-être 12,
  selon le projet)
- Quels slots dans la LeftRail (chaque slot = un stage de TON métier)
- Quoi mettre dans le Center pour chaque stage (cards, listes, charts,
  formulaires, conversations, dashboards — ce que demande TON métier)
- Quel titre + items dans la RightRail pour chaque stage
- Quel libellé status + 3 actions + 2 modes dans le FloatingFooter
- Quelles intéractions (palette ⌘K si pertinente, hotkeys, modals)

**Mais tu respectes la grammaire** :
- Hero card = `vision-glass` rounded-xl
- CTA primaire = `vision-btn-primary` (blanc plein, texte noir)
- CTA secondaire = `vision-btn-glass`
- Toggles = `vision-segmented-track` + bouton actif `vision-btn-glass`
- Couleurs = `var(--color-*)` (jamais en dur)
- Voix éditoriale : FR, voix régulière, pas de mono caps, statuts
  "Réussi"/"Échec" pas "OK"/"FAIL"
- Pas d'inventer un chrome additionnel (orbe, strip, top bar) — la
  LeftRail + FloatingFooter + RightRail = c'est tout

---

## RESSOURCE OPTIONNELLE (à consulter, pas à copier)

`/Users/adrienbeyondcrypto/Dev/hearst-os/docs/visual/flow-demo-v2.html`
→ Mockup d'exemple de comment la coquille se décline sur 13 stages
**du métier Hearst OS** (chat agent, mission Gmail, browser piloté,
etc.). Ouvre-le, navigue, repère les **patterns d'animation** et la
**façon dont le Center s'organise** (greeting + hero + section, ou
timeline, ou split, ou grid). Tu peux t'inspirer des patterns
techniques (résolution en 3 passes pour images, sparklines, heatmap,
nœuds-arêtes, transcript scroll, etc.) **si TON métier a un cas
équivalent**. Sinon, ignore.

Le contenu (textes, données, libellés) du mockup est 100% Hearst OS
— ne le reprends pas.

---

## ÉTAPE 0 — Lis, comprends, propose

1. Lis les 2 fichiers de coquille (CockpitScene.tsx + styles.css) +
   le `package.json` du projet courant + le layout/page principale
   existante

2. Survole `flow-demo-v2.html` (5 min) pour voir les patterns
   possibles, sans copier le contenu

3. Réponds-moi en ~20 lignes :
   - OK lecture faite, ce que tu as compris de la coquille
   - **Quel est le métier de CE projet** d'après ce que tu vois (1-2 lignes)
   - **Liste des stages que TU proposes** pour ce projet (3 à 12
     stages, selon le métier). Pour chacun : nom, 1 phrase de
     description, slot LeftRail (icône métaphorique)
   - Compatibilité versions (React 19, Tailwind v4, Framer Motion) :
     OK ou migration nécessaire
   - Conflits dans `globals.css` si tu en vois
   - Route cible (`/cockpit` ou `/` ou autre, selon ce qui existe)
   - Une question si tu en as une

4. **Attends ma validation** sur la liste de stages avant tout code.

---

## ÉTAPE 1 — Coquille en place (après validation des stages)

Une fois la liste des stages validée :

### 1a. Vérifier / installer les dépendances

Lis `/Users/adrienbeyondcrypto/Dev/hearst-os/lab/cli-os/package.json`.
Le lab utilise React 19 + Tailwind v4 + Framer Motion.

Dans CE projet :
- Si Tailwind v4 absent : installer (migration v3→v4 si besoin)
- Si Framer Motion absent : `npm i framer-motion`
- Si React/Next < 19/15 : me prévenir

### 1b. Copier les tokens + classes vision-* dans `globals.css`

Copie le contenu de `styles.css` du lab dans `app/globals.css` du
projet (ou crée-le). Si conflits avec tokens existants, signale-les
avant fusion.

Tu gardes les noms identiques : `vision-glass`, `vision-btn-primary`,
`vision-btn-glass`, `vision-segmented-track`, `perspective-scene`,
`preserve-3d`, `vision-content-depth`, `vision-footer-float`,
`--color-bg`, `--color-ink`, etc.

### 1c. Créer la coquille comme composant réutilisable

Copie `CockpitScene.tsx` à `app/_shell/Shell.tsx` (ou
`components/shell/Shell.tsx` selon convention).

Adaptations obligatoires :
- Retire `react-router-dom` (inutilisé)
- Ajoute `'use client'` en tête
- Renomme `CockpitScene` → `Shell` (le projet n'est pas Hearst OS, le
  nom "Cockpit" peut ne pas faire sens)

Refactor en composant générique qui accepte des props :

```ts
type ShellProps = {
  navItems: NavItem[];            // slots LeftRail, ordre TON projet
  activeNav: string;              // id du slot actif
  onNavChange: (id: string) => void;
  centerContent: ReactNode;       // contenu propre au stage actif
  railTitle: string;              // titre RightRail
  railItems: RailItem[];          // 5 items max
  footerStatus: string;           // zone 1 du footer
  footerActions: FooterAction[];  // zone 2 (3 actions contextuelles)
  footerModes: FooterMode[];      // zone 3 (2 modes)
  user?: { initials: string; name: string };  // avatar bottom LeftRail
};
```

Le JSX, les classNames, les animations Framer Motion, les inline
styles (ambient halo, dots teal, fade noir) → copiés à l'identique.

### 1d. Brancher la route + run local

Route choisie à l'étape 0 → page Next.js qui rend `<Shell ... />`
avec des **placeholders** (utilise le `<Ph>` du lab) sur toutes les
zones variables.

`npm run dev`. Tu me donnes l'URL.

À cet instant je dois voir la coquille avec `<Ph>` partout, **pixel
identique au lab** côté shell. C'est l'étape suivante qui rempli avec
ton contenu métier.

---

## ÉTAPE 2 → N — Tes stages (un par un)

Une fois la coquille validée :

Pour chaque stage de la liste qu'on a validée à l'étape 0, tu fais
un composant dédié :

```
app/_stages/<NomDuStage>.tsx
```

Chaque stage exporte :
- Un `centerContent` (JSX du Center pour ce stage)
- Le `railTitle` + `railItems`
- Le `footerStatus` + `footerActions` + `footerModes`

Et la page Shell sélectionne le stage actif via un store Zustand
(`useStageStore`) ou via le routing Next.js (à toi de proposer
ce qui est mieux pour CE projet).

### Cycle obligatoire par stage

1. Tu codes le stage selon le métier du projet
2. Tu fais tourner `npm run dev`
3. Tu m'indiques l'URL
4. Tu m'expliques en 5 lignes max : ce que ce stage fait, quelles
   données il affiche (mockées d'où), quelles actions sont
   cliquables
5. **Tu attends ma validation** avant le stage suivant
6. Commit conventional commits FR

### Ordre

Tu commences par les stages les plus structurants (page d'accueil /
dashboard / pipeline principal du projet). Tu finis par les stages
périphériques (settings, signaux, etc.).

À toi de proposer l'ordre à l'étape 0 — je valide ou je modifie.

### Données : tu mockes

Pour chaque stage, mock les data dans `mocks/<NomDuStage>.ts` avec
des valeurs réalistes du domaine de CE projet (pas les valeurs
Hearst OS). Quand on branchera les vraies API plus tard, on
remplacera l'import.

---

## INTERDICTIONS STRICTES

- **PAS de chrome additionnel** au shell visionOS (pas d'orbe, pas
  de top bar, pas de strip)
- **PAS de modification** des dimensions / classes / structure de la
  coquille
- **PAS de couleurs en dur** dans le TSX — `var(--color-*)` ou
  classes `vision-*` uniquement
- **PAS de reprise du contenu Hearst OS** (47 emails, Marie Dupont,
  vol Paris–Lisbonne, etc.). C'est leur exemple, pas le tien.
- **PAS de saut d'étape.** Tu valides la coquille avant les stages,
  puis stage par stage avec mon GO entre chaque
- **PAS de modification** du dashboard existant du projet courant.
  Route isolée tant qu'on n'a pas tout validé

---

## VOIX ÉDITORIALE

- **Français** partout : libellés UI, microcopy, commentaires, commits
- Pas de mono caps `tracking-marquee`
- Pas de halo-on-hover sur le chrome
- Statuts en voix régulière : « Réussi » pas « OK »
- Pas d'emojis dans le code sauf si je le demande
- Commentaires minimaux : seulement si le WHY n'est pas évident

---

## CE QUE TU FAIS MAINTENANT

1. Lis les 2 fichiers coquille de hearst-os + le projet courant
   (package.json + page principale)

2. Réponds à l'étape 0 (~20 lignes max) :
   - Métier du projet d'après ton scan
   - **Liste des stages que tu proposes** avec slot LeftRail
   - Compatibilité versions
   - Route cible
   - Question éventuelle

3. **Attends mon GO** sur la liste de stages.

4. Au GO : étape 1 (coquille en place avec `<Ph>` partout, route
   live, run local). Pas plus.

Tu n'écris **aucune ligne de code avant validation de la liste de
stages**.
```

---

## 💡 Notes pour Adrien

### Le déclic à comprendre

Hearst OS = **un produit** qui utilise la coquille visionOS.
Le projet que tu lances avec ce prompt = **un autre produit** qui
réutilise la même coquille mais avec son propre métier.

Ce qui voyage entre les projets :
- ✅ Le shell (LeftRail/Center/RightRail/Footer)
- ✅ Les tokens CSS + classes vision-*
- ✅ Les patterns d'animation (Framer Motion variants, sweep, blur passes)
- ❌ Les stages (chaque projet a les siens)
- ❌ Les données (chaque projet a son métier)
- ❌ Les libellés UI (chaque projet a sa voix)

### Si l'agent reprend du contenu Hearst OS

Recadre :
« Tu as mis "47 emails" / "Marie Dupont" / "Browserbase" — c'est du
contenu Hearst OS. Ce projet n'est pas Hearst OS. Reprends en
utilisant le métier de CE projet : [domaine]. »

### Si l'agent invente un chrome supplémentaire

Recadre :
« Tu as ajouté [élément]. La coquille = LeftRail 88 + Center +
RightRail 320 + FloatingFooter. Pas autre chose. Re-regarde
CockpitScene.tsx et reste dedans. »

### Si l'agent te propose 13 stages

Probablement il a copié la liste Hearst OS. Recadre :
« Ces 13 stages c'est Hearst OS. Liste les stages qui font sens pour
[métier de ton projet]. Probablement plutôt [X stages]. »

### Workflow

1. Tu colles le prompt dans le projet cible (Cursor / Claude Code)
2. L'agent répond avec sa liste de stages → tu valides/corriges
3. GO étape 1 → coquille avec `<Ph>` → tu compares au lab
4. GO étapes 2..N → tes stages métier
5. Build prod + deploy quand tout validé

### Quand la coquille évolue dans le lab

Tu mets à jour `CockpitScene.tsx` et `styles.css` côté hearst-os.
Tu reposes le prompt sur les projets existants → ils relisent et
synchronisent leur shell. Le contenu métier de chaque projet reste
intact.
