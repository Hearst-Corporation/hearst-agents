# 🔍 Audit UI Front-End — Helm (Hearst OS)

**Date** : 2026-05-22  
**Scope** : Navigation 3-colonnes, layout, design system, états, a11y, responsive  
**Agents** : 4 sous-agents parallèles (shell nav, pages routes, stages DS, a11y responsive)  
**Fichiers audités** : 40+  

---

## 📊 Synthèse exécutive

| Catégorie | P0 (bloquant) | P1 (visible) | P2 (polish) | Total |
|---|---|---|---|---|
| **Navigation & Layout 3-col** | 5 | 8 | 5 | 18 |
| **Design System & Tokens** | 1 | 8 | 14 | 23 |
| **États (loading/empty/error)** | 0 | 6 | 5 | 11 |
| **A11Y & Accessibilité** | 3 | 15 | 14 | 32 |
| **Responsive & Mobile** | 2 | 2 | 3 | 7 |
| **Performance & Code Quality** | 0 | 3 | 7 | 10 |
| **TOTAL** | **11** | **42** | **48** | **101** |

---

## 🚨 P0 — BLOQUANTS (11)

### P0-1 — `pb-48` inconditionnel masque le contenu sur pages sans composer
- **Fichier** : `app/(user)/_shell/Shell.tsx:55`
- **Symptôme** : `<main className="... pb-48 2xl:pb-56">` ajoute 192px (224px en 2xl) de padding-bottom sur **toutes** les pages, même celles sans `composer`. Sur les pages standalone (/reports, /settings, etc.), le bas de page est tronqué par une zone vide de 192px.
- **Impact** : Contenu masqué, scroll artificiellement long, UX dégradée.
- **Correction** : Conditionner le padding : `composer ? "pb-48 2xl:pb-56" : "pb-6"`.

### P0-2 — Double-scroll Shell + ScreenShell
- **Fichier** : `app/(user)/_shell/Shell.tsx:55` + `app/(user)/components/ui/ScreenShell.tsx:123`
- **Symptôme** : Le `<main>` du Shell a `overflow-y-auto`. `ScreenShell` a aussi `overflow-y-auto` sur son `<div>` interne. Deux contextes de scroll coexistent.
- **Impact** : Scroll janky, hauteur cassée, comportements imprévisibles sur `h-full`.
- **Correction** : Ajouter une prop `scrollable?: boolean` à `ScreenShell` (défaut `true`) que `StandalonePageFrame` passe à `false`.

### P0-3 — Chat totalement inaccessible sous breakpoint xl
- **Fichier** : `app/(user)/_shell/RightRailChat.tsx:161`
- **Symptôme** : `className="... hidden xl:flex"` — le rail droit disparaît sous 1280px. Aucun bouton FAB, drawer, ni alternative. L'utilisateur perd complètement l'accès à Kimi sur tablette et laptop 13".
- **Impact** : Feature critique (chat IA) inaccessible sur ~40% des viewports.
- **Correction** : Ajouter un bouton flottant (FAB) en bas à droite qui ouvre un drawer/bottom sheet du chat sous xl.

### P0-4 — RightRailChat : 22+ px magiques hardcodés
- **Fichier** : `app/(user)/_shell/RightRailChat.tsx`
- **Symptôme** : Tout le fichier utilise des styles inline avec px magiques (`padding: "16px 16px 12px"`, `width: 28`, `fontSize: 12`, `borderRadius: 10`, etc.). Violation systématique du design system.
- **Impact** : Dette visuelle massive, maintenance impossible, `lint-visual.mjs` contourné.
- **Correction** : Réécrire avec des classes Tailwind et des tokens CSS (`--space-*`, `--radius-*`).

### P0-5 — LeftRail : logo `<a href="#">` non sémantique
- **Fichier** : `app/(user)/_shell/LeftRail.tsx:258-269`
- **Symptôme** : Le logo Helm utilise `<a href="#">` avec `onClick` + `e.preventDefault()`. Ce n'est pas un vrai lien — pas de prefetch, pas de `Link`, mauvais pour le SEO et l'a11y.
- **Impact** : Mauvaise sémantique, lecteur d'écran annonce un lien cassé.
- **Correction** : Remplacer par `<button>` (action) ou `next/link` avec `scroll={false}`.

### P0-6 — History pollution dans le stage store
- **Fichier** : `stores/stage.ts:120-132`
- **Symptôme** : `setMode` ne vérifie pas si le nouveau payload est identique au current. Cliquer 2x sur le même stage empile 2 entrées identiques. Le "back" consomme une entrée sans effet visuel.
- **Impact** : Navigation "back" cassée, confusion utilisateur.
- **Correction** : Ajouter un guard `if (prev.mode === payload.mode && shallowEqual(prev, payload)) return;`.

### P0-7 — Fade bas insuffisant sur 2xl
- **Fichier** : `app/(user)/_shell/Shell.tsx:60-67`
- **Symptôme** : Le gradient fade a `h-32` (8rem) mais le padding bottom est `pb-56` (14rem) en 2xl. Le contenu défilant est visible sous le composer.
- **Impact** : Contenu qui dépasse sous le fade, visuellement cassé.
- **Correction** : `h-32 2xl:h-40` ou lier la hauteur du fade au padding bottom.

### P0-8 — Pas de skip-to-content link
- **Fichier** : `app/(user)/layout.tsx`
- **Symptôme** : Aucun `<a href="#main-content">`. Un utilisateur au clavier doit traverser ~15-20 éléments du LeftRail avant d'atteindre le contenu.
- **Impact** : WCAG 2.4.1 non conforme (Level A).
- **Correction** : Ajouter un skip-link en premier dans le body + `id="main-content"` sur le `<main>`.

### P0-9 — Zoom utilisateur bloqué
- **Fichier** : `app/layout.tsx:23-30`
- **Symptôme** : Viewport avec `maximumScale: 1` + `userScalable: false`. Interdit le zoom.
- **Impact** : WCAG 1.4.4 non conforme (Level AA). Bloque les utilisateurs malvoyants.
- **Correction** : Supprimer `maximumScale` et `userScalable`. Garder `width=device-width, initialScale=1`.

### P0-10 — Chat sans `aria-live` — contenu streaming non annoncé
- **Fichier** : `app/(user)/_shell/RightRailChat.tsx:306-397`
- **Symptôme** : Le conteneur de messages n'a aucun `aria-live`. Les messages assistant arrivant en streaming ne sont pas annoncés par les lecteurs d'écran.
- **Impact** : WCAG 4.1.3 non conforme (Level AA). Utilisateur aveugle n'a aucune rétroaction.
- **Correction** : Ajouter `role="log" aria-live="polite" aria-relevant="additions"` sur le conteneur de messages.

### P0-11 — `layout.tsx` : `"use client"` annule le SSR pour toute la branche
- **Fichier** : `app/(user)/layout.tsx:1`
- **Symptôme** : Le layout racine est `"use client"`. Tout le subtree user est hydraté côté client. Pas de Server Components possibles sous cette branche.
- **Impact** : Bundle JS gonflé, TTFB dégradé, pas de prefetch RSC.
- **Correction** : Déplacer `SessionProvider` et les hooks dans un wrapper client séparé, garder le layout en RSC.

---

## ⚠️ P1 — INCOHÉRENCES VISIBLES (42)

### Navigation & Layout (8)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P1-1 | `LeftRail.tsx:275` | Active state stage persiste sur pages standalone | Reset `currentMode` à null sur nav page, ou dual state |
| P1-2 | `LeftRail.tsx:322` | `pathname.startsWith(href)` = faux positifs (/reports/studio active aussi /reports) | Utiliser `pathname === href` ou matching exact |
| P1-3 | `LeftRail.tsx:279-289` | Boutons stage sans `aria-pressed` (seul `aria-current`) | `aria-pressed={active}` sur les `<button>` |
| P1-4 | `LeftRail.tsx:365` | `aria-label` sur `<span>` sans `role` — non lu par SR | Ajouter `role="status"` ou wrapper dans élément interactif |
| P1-5 | `Shell.tsx:72` | `z-[25]` magique non tokenisé | Définir `--z-composer` ou utiliser `z-30` |
| P1-6 | `Shell.tsx:55` | Pas de padding horizontal sur `<main>` | Ajouter `px-4` ou `px-6` |
| P1-7 | `layout.tsx:80` | `padding-right: 2rem` hardcodé dans `<style>` inline | Utiliser `var(--space-8)` |
| P1-8 | `stores/stage.ts:127` | `slice(-20)` garde 20 entrées mais pas de forward history | Documenter la sémantique ou ajouter forward stack |

### Design System & Tokens (8)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P1-9 | `RightRailChat.tsx` | 15+ px magiques (liste complète dans l'audit shell) | Remplacer par `--space-*`, `--radius-*`, classes Tailwind |
| P1-10 | `globals.css:3115-4131` | Centaines de `rgba()` hardcodés dans `@layer utilities` | Remplacer par `--surface-1`, `--line`, `--text-ghost` |
| P1-11 | `globals.css:3116-3136` | `.vision-glass` hardcode rgba + blur magique | Tokeniser `--blur-glass`, `--surface-*` |
| P1-12 | `globals.css:3166-3176` | `.vision-rail-left/right` hardcodent rgba | Utiliser `--line-strong`, `--surface` |
| P1-13 | `globals.css:2236-2239` | `::selection` hardcode `color-mix` 22% | Créer `--selection-bg` token |
| P1-14 | `CockpitXClient.tsx:330` | `fontSize: "var(--ct-font-md, 15px)"` hors échelle `.t-N` | Utiliser `t-15` |
| P1-15 | `PageLayout.tsx` | `font-size` via `var(--font-size-XX, fallback)` — tokens inexistants | Migrer vers classes `.t-XX` |
| P1-16 | `globals.css:3547-3599` | `.br-mock` simule light-mode (couleurs #1a1a1f, #555, white) | Supprimer ou migrer vers tokens dark-mode |

### États loading/empty/error (6)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P1-17 | `reports/page.tsx` | Données hardcodées, pas de fetch/loading/error | Implémenter fetch réel + props `ScreenShell` |
| P1-18 | `marketplace/page.tsx` | Données hardcodées, pas de fetch/loading/error | Idem |
| P1-19 | `hospitality/page.tsx` | Données hardcodées, pas de fetch/loading/error | Idem |
| P1-20 | `settings/alerting/page.tsx` | Loading interne non standardisé (texte "Chargement…") | Remonter `loading` à `ScreenShell` + `RowSkeleton` |
| P1-21 | `archive/page.tsx` | `empty` prop masque les filtres | Gérer empty state dans le contenu, sous les filtres |
| P1-22 | `notifications/page.tsx` | Empty state statique, pas de logique filtrée | Conditionner `EmptyState` au résultat filtré |

### A11Y (15)

| # | Fichier | Problème | WCAG | Correction |
|---|---|---|---|---|
| P1-23 | `LeftRail.tsx:294` | Commandeur sans `aria-expanded` | 4.1.2 | `aria-expanded={commandeurOpen}` |
| P1-24 | `LeftRail.tsx:27` | Avatar : `aria-label="Profil"` mais action = signOut | 2.4.4 | `aria-label="Déconnexion — ${name}"` |
| P1-25 | `OnboardingTour.tsx:110` | Pas de focus trap | 2.4.3 | Wrapper dans `useModalA11y` |
| P1-26 | `OnboardingTour.tsx:111` | Pas de `aria-modal="true"` | 1.3.1 | Ajouter `aria-modal="true"` |
| P1-27 | `Commandeur.tsx:247` | Pas de `aria-activedescendant` | 4.1.2 | IDs sur rows + `aria-activedescendant` |
| P1-28 | `RightRailChat.tsx:425` | Textarea sans `aria-describedby` pour hint | 3.3.2 | `aria-describedby="chat-hint"` |
| P1-29 | `FocusBadge.tsx:24` | Pas de `aria-pressed` | 4.1.2 | `aria-pressed={enabled}` |
| P1-30 | `MobileBottomNav.tsx:58` | Pas de `aria-expanded` pour Commandeur | 4.1.2 | Lire `commandeurOpen` du store |
| P1-31 | `globals.css:41-42` | Contrastes `text-ghost` (3.2:1) et `text-faint` (3.5:1) < AA | 1.4.3 | Augmenter à 0.55 et 0.60 |
| P1-32 | `globals.css:2407` | `no-scrollbar` sans alternative visuelle | 1.3.3 | Ajouter fade bottom ou indicateur |
| P1-33 | `RightRailChat.tsx:252` | Bouton "Nouvelle conversation" sans `aria-label` | 2.4.4 | Ajouter `aria-label` |
| P1-34 | `RightRailChat.tsx:306` | Messages sans `role="log"` | 4.1.3 | `role="log" aria-live="polite"` |
| P1-35 | `Commandeur.tsx:216` | Pas de `aria-labelledby` sur dialog | 1.3.1 | `<h2 id="cmdk-title">` + `aria-labelledby` |
| P1-36 | `ConfirmModal.tsx:86` | `aria-disabled` sur `<div>` non-focusable | 4.1.2 | Remplacer par `aria-busy` |
| P1-37 | `OnboardingTour.tsx:110` | Pas de `aria-describedby` sur dialog | 1.3.1 | `id` sur body + `aria-describedby` |

### Responsive (2)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P1-38 | `layout.tsx:107` | `h-screen` = problème barre d'adresse mobile | `h-[100dvh]` ou `min-h-screen` |
| P1-39 | `RightRailChat.tsx:24` | `crypto.randomUUID()` au top-level — risque SSR | Wrapper dans `useEffect` ou `useRef` |

### Code Quality (3)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P1-40 | `RightRailChat.tsx:54-68` | Historique corrompu (message assistant vide inclus) | Filtrer avant d'ajouter le message vide |
| P1-41 | `RightRailChat.tsx:150-156` | Mutation DOM directe (`el.style.height = ...`) | Utiliser state `textareaHeight` |
| P1-42 | `CockpitXClient.tsx:161-190` | `stageContent` via IIFE dans le render | Extraire en `useMemo` ou composant séparé |

---

## 🎨 P2 — POLISH (48)

### Navigation & Layout (5)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P2-1 | `_shell/README.md` | LeftRail et AmbientLayers non marqués LOCKED | Ajouter mentions LOCKED |
| P2-2 | `Shell.tsx:44` | `perspective-scene` sans fallback CSS | Documenter ou ajouter fallback |
| P2-3 | `Shell.tsx:50-53` | Triple nesting `preserve-3d` — over-engineering | Simplifier si profondeur non utilisée |
| P2-4 | `LeftRail.tsx:69-77` | `SVG_PROPS` hardcode `width: 18, height: 18` | Token `--icon-size-rail` |
| P2-5 | `LeftRail.tsx:82-177` | Icône `chat` = croix (plus), pas bulle | Remplacer par icône chat |

### Design System (14)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P2-6 | `ChatStage.tsx` | Pas de `StageLayout` | Migrer vers pattern unifié |
| P2-7 | `MissionStage.tsx` | Pas de `StageLayout`, header custom | Migrer vers `StageLayout` |
| P2-8 | `MeetingStage.tsx` | Pas de `StageLayout`, header custom | Migrer vers `StageLayout` |
| P2-9 | `AssetCompareStage.tsx` | Pas de `StageLayout`, header minimaliste | Migrer vers `StageLayout` |
| P2-10 | `globals.css` | `font-size` hardcodés dans classes utilitaires | Remplacer par `.t-XX` |
| P2-11 | `globals.css` | 30+ valeurs px magiques (168px, 110px, 2px, etc.) | Tokeniser ou Tailwind |
| P2-12 | `globals.css` | `.kg-node.center .kg-chip` hardcode white/black | `var(--text)` / `var(--bg)` |
| P2-13 | `globals.css` | `.ar-content h4` hardcode `white` | `var(--text)` |
| P2-14 | `EmptyState.tsx:68` | `maxWidth: "var(--space-96, 32rem)"` — token inexistant | `var(--width-prose-narrow)` |
| P2-15 | `ScreenShell.tsx:29` | Import `PageHeader` chemin fragile | Vérifier/corriger le chemin |
| P2-16 | `StageLayout.tsx` | Dépendance implicite sur `PageLayout` tokens | Utiliser `PageHeader` directement |
| P2-17 | `registry.ts` | `STAGE_REGISTRY` type safety imparfaite | `satisfies Record<StageKey, StageDef>` |
| P2-18 | `registry.ts` | Champs `footer` legacy non utilisés | Marquer `@deprecated` ou supprimer |
| P2-19 | `CockpitXClient.tsx` | `ModePlaceholder` sans état empty/loading | Ajouter `EmptyState` avec CTA |

### États (5)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P2-20 | `ChatStage.tsx` | Pas de skeleton loading | Ajouter `LoadingSkeleton` |
| P2-21 | `AssetCompareStage.tsx` | Pas de `StageErrorBanner` | Importer et utiliser |
| P2-22 | `AssetCompareStage.tsx` | Loading avec `animate-pulse` brut | Utiliser `CardSkeleton` |
| P2-23 | `VoiceStage.tsx` | Pas d'états loading/error/empty | Ajouter `EmptyState` |
| P2-24 | `SimulationStage.tsx` | Pas d'`EmptyState` ni `StageErrorBanner` | Ajouter les deux |

### A11Y (14)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P2-25 | `globals.css:636` | `.ct-rail-action` sans `focus-visible` explicite | Ajouter règle dédiée |
| P2-26 | `RightRailChat.tsx:221` | Statut "En ligne" sans `role="status"` | Wrapper dans `<span role="status">` |
| P2-27 | `globals.css:2115` | `prefers-reduced-motion` très partiel | Règle globale `animation-duration: 0.01ms` |
| P2-28 | `Shell.tsx:55` | `<main>` sans `id` pour skip-link | `id="main-content"` |
| P2-29 | `MobileBottomNav.tsx:104` | `--size-touch-target` = 44px (limite AAA) | Augmenter à 48px |
| P2-30 | `LeftRail.tsx` | Pas de `aria-roledescription` ni groupes nav | `<nav aria-label="Stages">` etc. |
| P2-31 | `LeftRail.tsx:256` | Scrollable sans `aria-orientation` | `aria-orientation="vertical"` |
| P2-32 | `AssetCompareModal.tsx:103` | Inputs sans `aria-describedby` | Lier description aux inputs |
| P2-33 | `CommandeurResultRow.tsx` | Focus visible non vérifié | Vérifier `tabIndex`, `focus-visible`, `aria-selected` |
| P2-34 | `RightRailChat.tsx:38-141` | `handleSubmit` ~100 lignes inline | Extraire hook `useChatStream` |
| P2-35 | `RightRailChat.tsx:89-118` | Boucle SSE sans timeout | Ajouter `setTimeout` sur `AbortController` |
| P2-36 | `RightRailChat.tsx:114` | Events malformés silencieusement ignorés | `console.warn` en dev |
| P2-37 | `RightRailChat.tsx:26-30` | Scroll-to-bottom sans smooth | `behavior: "smooth"` |
| P2-38 | `RightRailChat.tsx:11-20` | Message bienvenue hardcodé FR (pas i18n) | Noter pour future i18n |

### Responsive (3)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P2-39 | `RightRailChat.tsx` | Pas de virtualisation si >50 messages | Implémenter virtualisation |
| P2-40 | `layout.tsx:101` | `useEffect` sans cleanup | Commenter idempotence |
| P2-41 | `layout.tsx:69` | `VoicePulse` sans lazy loading | Envelopper dans `React.lazy` |

### Code Quality (7)

| # | Fichier | Problème | Correction |
|---|---|---|---|
| P2-42 | `LeftRail.tsx:15-50` | `UserAvatar` sans `onError` fallback image | Ajouter `onError` → fallback initial |
| P2-43 | `LeftRail.tsx:258` | Logo : `title` + `aria-label` redondants | Garder un seul |
| P2-44 | `stage.ts:190` | Hotkey `Cmd+0` problème AZERTY | Documenter ou alternative |
| P2-45 | `PageLayout.tsx` | `as unknown as number` cast dangereux | Constante typée |
| P2-46 | `PageLayout.tsx` | `PageLayout` + `CtCard` dans même fichier | Extraire `CtCard` |
| P2-47 | `HELM_PRODUCTS` | URLs hardcodées | Déplacer vers config/env |
| P2-48 | `CockpitXClient.tsx` | Import API interne Next.js | `next/dist/shared/lib/...` → risque upgrade |

---

## 📋 Tableau de conformité par page

| Route | Shell 3-col | ScreenShell | Double-scroll | pb-48 problème | États L/E/E | Hex/px | A11Y critique |
|---|---|---|---|---|---|---|---|
| `/` (cockpit) | ✅ | N/A | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ |
| `/copilote` | ✅ | N/A | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/browser` | ✅ | N/A | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/missions` | ✅ | N/A | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/missions/builder` | ✅ | N/A | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/run` | ✅ | N/A | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/connections` | ✅ | N/A | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/reports` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | ❌ statique | ❌ | ⚠️ |
| `/reports/studio` | ✅ | ❌ custom | 🚨 P0 | 🚨 P0 | N/A | ❌ | ⚠️ |
| `/marketplace` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | ❌ statique | ❌ | ⚠️ |
| `/notifications` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | ⚠️ | ❌ | ⚠️ |
| `/archive` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | ⚠️ | ❌ | ⚠️ |
| `/hospitality` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | ❌ statique | ❌ | ⚠️ |
| `/settings` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | N/A | ❌ | ⚠️ |
| `/settings/alerting` | ✅ | ✅ | 🚨 P0 | 🚨 P0 | ⚠️ | ❌ | ⚠️ |
| `/cockpit-x` | ✅ | N/A | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ |

---

## 🎯 Top 10 problèmes à corriger en priorité

1. **P0-1** : `pb-48` conditionnel — impact maximal, 1 ligne à changer
2. **P0-3** : Chat inaccessible mobile — feature critique absente
3. **P0-4** : RightRailChat px magiques — dette visuelle la plus lourde
4. **P0-8** : Skip-link — a11y bloquante (WCAG A)
5. **P0-9** : Zoom bloqué — a11y bloquante (WCAG AA)
6. **P0-10** : Chat sans `aria-live` — a11y bloquante (WCAG AA)
7. **P0-2** : Double-scroll — architecture à décider
8. **P1-31** : Contrastes text-ghost/faint — a11y visible
9. **P0-6** : History pollution — navigation cassée
10. **P0-5** : Logo non sémantique — a11y + SEO


---

## 🛠️ Livrable 2 — Prompt Claude Code : corrections précises

> Copier-coller ce prompt dans Claude Code pour exécuter les corrections P0 et P1 critiques.

```
Tu es un développeur front-end senior travaillant sur Helm (Hearst OS), une app Next.js 16 
avec Tailwind v4, React 19, Zustand 5. Le design system impose : tokens CSS uniquement 
(--space-*, --radius-*, --accent-*, .t-N), zéro px magique, zéro hex/rgb hardcodé.

Voici les corrections à appliquer, dans l'ordre de priorité. Fais des commits atomiques 
(1 commit = 1 correction ou groupe cohérent). N'oublie pas de relancer 
`pnpm typecheck && pnpm lint` après chaque batch.

---

### BATCH 1 — P0 Critiques (layout + a11y bloquante)

**1. Shell.tsx — pb-48 conditionnel**
Fichier : app/(user)/_shell/Shell.tsx ligne 55
- Remplacer : `<main className="... pb-48 2xl:pb-56">`
- Par : `<main className={"vision-content-depth preserve-3d flex flex-1 flex-col overflow-y-auto pt-6 " + (composer ? "pb-48 2xl:pb-56" : "pb-6")}>`

**2. Shell.tsx — fade bas adaptatif**
Fichier : app/(user)/_shell/Shell.tsx ligne 60-67
- Remplacer `h-32` par `h-32 2xl:h-40` pour couvrir le `pb-56` en 2xl.

**3. Shell.tsx — id pour skip-link**
Fichier : app/(user)/_shell/Shell.tsx ligne 55
- Ajouter `id="main-content"` sur le `<main>`.

**4. layout.tsx — skip-to-content link**
Fichier : app/(user)/layout.tsx
- Ajouter en premier enfant du `<div className="h-screen...">` :
  ```tsx
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-(--accent-teal) focus:text-black focus:px-4 focus:py-2 focus:rounded-(--radius-sm) t-13 font-medium"
  >
    Aller au contenu
  </a>
  ```

**5. layout.tsx (racine) — débloquer le zoom**
Fichier : app/layout.tsx
- Remplacer le viewport par : `{ width: "device-width", initialScale: 1, viewportFit: "cover" }`
- Supprimer `maximumScale` et `userScalable`.

**6. stores/stage.ts — guard anti-double**
Fichier : stores/stage.ts ligne 120-132
- Dans `setMode`, ajouter en début de fonction :
  ```ts
  const prev = get().current;
  if (prev.mode === payload.mode) {
    // Pour les modes avec payload contextuel, vérifier aussi l'égalité shallow
    const needsCheck = ["asset", "asset_compare", "browser", "meeting", "kg", "voice", "simulation", "artifact", "signal"].includes(payload.mode);
    if (!needsCheck || JSON.stringify(prev) === JSON.stringify(payload)) return;
  }
  ```

---

### BATCH 2 — P0 Critiques (RightRailChat)

**7. RightRailChat — aria-live sur les messages**
Fichier : app/(user)/_shell/RightRailChat.tsx ligne 306-397
- Sur le conteneur `<div ref={listRef}>`, ajouter :
  `role="log" aria-live="polite" aria-relevant="additions" aria-busy={isStreaming}`

**8. RightRailChat — aria-describedby sur textarea**
Fichier : app/(user)/_shell/RightRailChat.tsx
- Donner un `id="chat-hint"` au `<div>` contenant "Shift+Entrée pour saut de ligne" (ligne ~496).
- Sur le `<textarea>` (ligne ~425), ajouter `aria-describedby="chat-hint"`.

**9. RightRailChat — aria-label sur bouton nouvelle conversation**
Fichier : app/(user)/_shell/RightRailChat.tsx ligne 252-302
- Ajouter `aria-label="Nouvelle conversation"` sur le `<button>` (déjà un `title`, ajouter l'`aria-label`).

**10. RightRailChat — statut en ligne avec role="status"**
Fichier : app/(user)/_shell/RightRailChat.tsx ligne 221-250
- Wrapper le conteneur du statut dans `<span role="status" aria-live="polite">`.

---

### BATCH 3 — P1 Accessibilité

**11. LeftRail — aria-expanded sur Commandeur**
Fichier : app/(user)/_shell/LeftRail.tsx ligne 294-313
- Lire `commandeurOpen` depuis le store : `const commandeurOpen = useStageStore((s) => s.commandeurOpen);`
- Ajouter `aria-expanded={commandeurOpen}` sur le bouton Commandeur.

**12. LeftRail — aria-pressed sur boutons stages**
Fichier : app/(user)/_shell/LeftRail.tsx ligne 279-289
- Remplacer `aria-current={active ? "page" : undefined}` par `aria-pressed={active}` sur les `<button>` du groupe STAGES.
- Garder `aria-current` uniquement sur les `<Link>` du groupe PAGES.

**13. LeftRail — logo en button sémantique**
Fichier : app/(user)/_shell/LeftRail.tsx ligne 258-269
- Remplacer `<a href="#" ... onClick={...}>` par `<button type="button" ...>`.
- Supprimer `e.preventDefault()`.
- Garder `aria-label="Helm — Accueil"`.

**14. LeftRail — aria-label avatar correction**
Fichier : app/(user)/_shell/LeftRail.tsx ligne 27, 44
- Remplacer `aria-label="Profil utilisateur"` par `aria-label="Déconnexion"`.
- Remplacer `title="Profil"` par `title="Déconnexion"`.

**15. FocusBadge — aria-pressed**
Fichier : app/(user)/components/FocusBadge.tsx
- Ajouter `aria-pressed={enabled}` sur le bouton.

**16. MobileBottomNav — aria-expanded**
Fichier : app/(user)/components/MobileBottomNav.tsx
- Lire `commandeurOpen` du store.
- Ajouter `aria-expanded={commandeurOpen}` sur les boutons qui ouvrent le Commandeur.

**17. OnboardingTour — focus trap + aria-modal + aria-describedby**
Fichier : app/(user)/components/OnboardingTour.tsx
- Ajouter `aria-modal="true"` sur le `<div role="dialog">`.
- Ajouter `aria-describedby="onboarding-desc"` sur le dialog.
- Ajouter `id="onboarding-desc"` sur le `<p>` du body du slide.
- Intégrer `useModalA11y` (même pattern que ConfirmModal) pour le focus trap.

**18. Commandeur — aria-activedescendant + aria-labelledby**
Fichier : app/(user)/components/Commandeur.tsx
- Générer `id="cmdk-row-${index}"` sur chaque `CommandeurResultRow`.
- Ajouter `aria-activedescendant={activeIndex >= 0 ? \`cmdk-row-${activeIndex}\` : undefined}` sur le conteneur de résultats.
- Ajouter `<h2 id="cmdk-title" className="sr-only">Palette de commandes</h2>` en début de dialog.
- Remplacer `aria-label="Palette de commandes"` par `aria-labelledby="cmdk-title"`.

**19. ConfirmModal — aria-busy au lieu de aria-disabled**
Fichier : app/(user)/components/ConfirmModal.tsx
- Remplacer `aria-disabled={loading}` sur le backdrop `<div>` par `aria-busy={loading}`.

**20. globals.css — contrastes text-ghost / text-faint**
Fichier : app/globals.css ligne 41-42
- `--text-ghost: rgba(255, 255, 255, 0.55)` (was 0.42)
- `--text-faint: rgba(255, 255, 255, 0.60)` (was 0.45)
- Vérifier visuellement que ça ne casse pas l'esthétique.

---

### BATCH 4 — P1 Design System (px magiques critiques)

**21. RightRailChat — tokeniser les px magiques (partie 1 : header)**
Fichier : app/(user)/_shell/RightRailChat.tsx
- `padding: "16px 16px 12px"` → `padding: "var(--space-4) var(--space-4) var(--space-3)"`
- `gap: "var(--space-2-5, 10px)"` → `gap: "var(--space-2-5)"`
- `width: 28, height: 28` → classes Tailwind `w-7 h-7` (ou `w-8 h-8` si 32px)
- `borderRadius: 8` → `rounded-lg`
- `fontSize: 12` → classe `t-12` (à créer si inexistante) ou `var(--ct-font-sm)`
- `marginTop: 1` → supprimer (négligeable)
- `gap: 4` → `gap-1` (Tailwind) ou `var(--space-1)`
- `width: 5, height: 5, borderRadius: "50%"` → `w-1.5 h-1.5 rounded-full`

**22. RightRailChat — tokeniser les px magiques (partie 2 : messages + input)**
- `padding: "12px 0"` → `py-3` (Tailwind)
- `padding: "4px 16px"` → `px-4 py-1`
- `paddingLeft: 2` → supprimer
- `borderRadius: 10` → `rounded-lg` (ou `rounded-md`)
- `borderRadius: 0` → supprimer (défaut)
- `padding: "8px 12px"` → `px-3 py-2`
- `padding: "10px 12px 14px"` → `px-3 pt-2.5 pb-3.5`
- `gap: 8` → `gap-2`
- `borderRadius: 12` → `rounded-xl`
- `padding: "8px 8px 8px 14px"` → `pl-3.5 pr-2 py-2`
- `minHeight: 22` → `min-h-[22px]` (ou tokeniser)
- `maxHeight: 120` → `max-h-[120px]` (ou tokeniser)
- `width: 32, height: 32` → `w-8 h-8`
- `marginTop: 6` → `mt-1.5`
- `paddingLeft: 2` → supprimer

**23. CockpitXClient — fontSize hors échelle**
Fichier : app/(user)/cockpit-x/CockpitXClient.tsx ligne 330
- `fontSize: "var(--ct-font-md, 15px)"` → supprimer la prop `style` et utiliser `className="t-15"`.

---

### BATCH 5 — P1 États + Pages

**24. AlertingSettings — loading standardisé**
Fichier : app/(user)/settings/alerting/page.tsx + AlertingSettings.tsx
- Remonter l'état `loading` au niveau page.
- Passer `loading={state.loading}` à `ScreenShell`.
- Supprimer le bloc loading interne "Chargement des préférences…".

**25. ArchivePage — empty state sous les filtres**
Fichier : app/(user)/archive/page.tsx
- Retirer `empty` prop de `ScreenShell`.
- Gérer l'empty state conditionnellement dans le JSX, après les `FilterTabs` et `SearchField`.

**26. NotificationsPage — empty state conditionnel**
Fichier : app/(user)/notifications/page.tsx
- Implémenter la logique de filtrage réelle.
- Conditionner `<EmptyState>` au résultat filtré (pas en dur).

---

### BATCH 6 — P2 Polish (si temps restant)

**27. globals.css — prefers-reduced-motion globale**
Fichier : app/globals.css
- Ajouter à la fin :
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

**28. LeftRail — focus-visible explicite**
Fichier : app/globals.css
- Ajouter : `.ct-rail-action:focus-visible { outline: 2px solid var(--accent-teal); outline-offset: 2px; }`

**29. ScreenShell — prop scrollable**
Fichier : app/(user)/components/ui/ScreenShell.tsx
- Ajouter `scrollable?: boolean` (défaut `true`).
- Si `scrollable === false`, retirer `overflow-y-auto` du `<div>` interne.
- Mettre à jour `StandalonePageFrame.tsx` pour passer `scrollable={false}`.

**30. layout.tsx — h-screen → dvh**
Fichier : app/(user)/layout.tsx ligne 107
- `h-screen` → `h-dvh` (ou `h-[100dvh]`).

---

RÈGLES STRICTES :
- Ne JAMAIS modifier app/spatial-safe/, components/spatial-safe/, hooks/spatial-safe/, lib/spatial-safe/, providers/spatial-safe/, styles/spatial-safe/
- Ne JAMAIS modifier docs/spatial/_BACKUP_*
- Vérifier `docs/AGENT-LOCK.json` avant chaque édit (locked doit être false)
- Lire les feature specs dans docs/features/<id>.md avant de modifier quoi que ce soit lié à une feature
- Commits en français, convention : `fix(shell): pb-48 conditionnel selon composer`, `fix(a11y): skip-link + aria-live chat`, etc.
- Après chaque batch : `pnpm typecheck && pnpm lint`
```

---

## 🔄 Livrable 3 — Plan de ré-audit post-fix

### Phase 1 — Vérification immédiate (après chaque batch de fix)

| Vérification | Commande / Méthode | Critère de succès |
|---|---|---|
| TypeScript | `pnpm typecheck` | 0 erreur |
| Lint | `pnpm lint` | 0 erreur, 0 warning critique |
| Build | `pnpm build` | Succès sans erreur |
| Tests unitaires | `pnpm test` | Tous les tests passent |

### Phase 2 — Vérification visuelle (manuelle)

| Page | Vérification | Outil |
|---|---|---|
| `/` (cockpit) | Padding bottom cohérent, fade bas couvre le composer | Navigateur |
| `/reports` | Pas de zone vide en bas, scroll fluide | Navigateur |
| `/settings` | Idem | Navigateur |
| `/` sous 1280px | Chat accessible via FAB/drawer | DevTools responsive |
| `/` sous 768px | MobileBottomNav fonctionnel, skip-link visible au focus | DevTools + Tab |

### Phase 3 — Vérification a11y (automatisée)

| Outil | Commande | Critère |
|---|---|---|
| axe DevTools | Extension navigateur | 0 violation critique |
| Lighthouse a11y | Chrome DevTools | Score ≥ 90 |
| WAVE | Extension navigateur | 0 erreur |
| Keyboard navigation | Tab manuel | Skip-link → contenu → rail → chat, focus visible partout |
| Screen reader | VoiceOver (macOS) ou NVDA | Messages chat annoncés, statuts lus, landmarks navigables |

### Phase 4 — Vérification design system (automatisée)

| Vérification | Commande | Critère |
|---|---|---|
| lint-visual | `pnpm lint:visual` | 0 px magique, 0 hex hardcodé |
| Couleurs | `grep -r "rgba(255,255,255" app/globals.css` | 0 occurrence (tout tokenisé) |
| Tailwind arbitrary | `grep -r "\[.*px\]" app/(user)/` | 0 occurrence (hors tokens) |

### Phase 5 — Tests E2E (si disponibles)

| Test | Commande | Critère |
|---|---|---|
| Happy path | `pnpm test:e2e happy-path.spec.ts` | Pass |
| Auth | `pnpm test:e2e auth/*.spec.ts` | Pass |
| Visual regression | `pnpm test:visual` | 0 diff non attendu |

### Phase 6 — Checklist finale de ré-audit

```markdown
## ✅ Checklist ré-audit UI Front-End Helm

### Layout 3-colonnes
- [ ] `pb-48` conditionnel selon `composer`
- [ ] Fade bas couvre le padding bottom sur tous les breakpoints
- [ ] Pas de double-scroll sur les pages ScreenShell
- [ ] Skip-link fonctionnel (Tab → visible → Enter → focus main)
- [ ] Chat accessible sous xl (FAB ou drawer)

### Design System
- [ ] 0 px magique dans RightRailChat.tsx
- [ ] 0 rgba() hardcodé dans globals.css (tout tokenisé)
- [ ] Classes `.t-N` utilisées partout (pas de fontSize inline)
- [ ] `lint-visual` passe en CI

### États
- [ ] Toutes les pages avec fetch ont loading/empty/error
- [ ] ScreenShell gère correctement les 3 états
- [ ] Skeletons cohérents (RowSkeleton / CardSkeleton)

### A11Y
- [ ] Skip-link présent et fonctionnel
- [ ] Zoom utilisateur autorisé (viewport sans maximumScale)
- [ ] `aria-live="polite"` sur le chat
- [ ] `aria-pressed` sur les boutons toggle
- [ ] `aria-expanded` sur les boutons qui ouvrent des panneaux
- [ ] Focus trap sur OnboardingTour
- [ ] Contrastes text-ghost ≥ 4.5:1 et text-faint ≥ 4.5:1
- [ ] `prefers-reduced-motion` globale fonctionnelle
- [ ] Keyboard navigation complète (Tab order logique)

### Responsive
- [ ] Layout correct sur 320px → 2560px
- [ ] MobileBottomNav visible et fonctionnel sous md
- [ ] LeftRail scrollable avec indicateur
- [ ] Chat accessible sur tous les viewports

### Performance
- [ ] 0 `"use client"` inutile sur les layouts
- [ ] RightRailChat virtualisé si >50 messages (P2)
- [ ] Pas de mutation DOM directe (textarea height via state)
```

---

## 📎 Annexes

### A. Fichiers critiques à ne JAMAIS modifier sans escalation

| Fichier | Raison | Escalader à |
|---|---|---|
| `app/(user)/_shell/Shell.tsx` | LOCKED P2+ — layout racine | Adrien |
| `app/(user)/_stages/registry.ts` | LOCKED P3+ — 13 entrées stables | Adrien |
| `stores/stage.ts` | Modes polymorphes verrouillés | Adrien |
| `public/hearst-logo.svg` | Intouchable (brand) | — |

### B. Zones read-only (NE PAS MODIFIER)

- `app/spatial-safe/`
- `components/spatial-safe/`
- `hooks/spatial-safe/`
- `lib/spatial-safe/`
- `providers/spatial-safe/`
- `styles/spatial-safe/`
- `docs/spatial/_BACKUP_*`

### C. Commandes de validation

```bash
# Rapide (dev)
pnpm typecheck && pnpm lint

# Complet (avant merge)
pnpm validate  # typecheck + lint + test

# E2E (besoin du serveur sur :4102)
pnpm test:e2e

# Visual regression
pnpm test:visual
```

---

*Rapport généré le 2026-05-22 par audit parallèle de 4 agents d'exploration.*
*Total : 101 problèmes identifiés (11 P0, 42 P1, 48 P2).*
