# Prompt Batch A — Pages statiques + Design System

Tu es un développeur front-end senior sur Helm (Hearst OS). Next.js 16, Tailwind v4, React 19, Zustand 5. Tokens CSS uniquement, zéro px magique.

RÈGLES STRICTES :
- NE JAMAIS modifier les dossiers *-safe/ ni docs/spatial/_BACKUP_*
- Vérifier docs/AGENT-LOCK.json avant chaque édit (locked doit être false)
- Commits en français : fix(pages): fetch réel reports, fix(ds): tokeniser rgba vision-glass, etc.
- Après chaque étape : pnpm typecheck && pnpm lint

---

## ÉTAPE A1 — reports/page.tsx : fetch réel + états L/E/E

Fichier : app/(user)/reports/page.tsx

Actuellement : données hardcodées (REPORTS array statique). Pas de fetch, pas de loading, pas d'erreur.

À faire :
- Créer un hook `useReports()` qui fetch `/api/v2/reports` (ou endpoint existant — chercher dans lib/ ou app/api/)
- Si pas d'endpoint API, créer un fetch mocké avec useEffect + setTimeout pour simuler le pattern
- Passer `loading`, `empty`, `error` à `ScreenShell`
- Utiliser `RowSkeleton` pour le loading
- Utiliser `EmptyState` pour le empty (via ScreenShell)
- Gérer l'erreur avec `StageErrorBanner` ou le pattern ScreenShell `error`

Si aucun endpoint API n'existe encore :
- Garder les données mockées mais wrapper dans un useEffect avec setLoading(true)/setLoading(false)
- Cela standardise le pattern pour quand l'API sera branchée

---

## ÉTAPE A2 — marketplace/page.tsx : fetch réel + états L/E/E

Fichier : app/(user)/marketplace/page.tsx

Même pattern que A1. Données TEMPLATES hardcodées.

À faire :
- Créer un hook `useTemplates()` ou fetch vers `/api/v2/marketplace/templates`
- Standardiser loading/empty/error avec ScreenShell
- Le SearchField est `disabled` — retirer `disabled` si l'API supporte la recherche, sinon garder avec un badge "Bientôt"

---

## ÉTAPE A3 — hospitality/page.tsx : fetch réel + états L/E/E

Fichier : app/(user)/hospitality/page.tsx

Page 100% statique (WORKFLOWS hardcodés, pas de données PMS).

À faire :
- Créer un hook `useHospitalityData()` qui fetch `/api/v2/hospitality`
- Si pas de connecteur PMS configuré → état empty avec CTA "Configurer un PMS"
- Si connecteur PMS mais pas de données → loading puis empty
- Si erreur API → error state
- Les workflows hardcodés doivent venir de l'API, pas du fichier

---

## ÉTAPE A4 — globals.css : tokeniser rgba() partie 1 (.vision-glass, .vision-rail-*)

Fichier : app/globals.css

Lignes ~3116-3176 : .vision-glass, .vision-rail-left, .vision-rail-right hardcodent des rgba().

À faire :
- .vision-glass : remplacer rgba(255,255,255,0.03) par var(--surface-1), rgba(255,255,255,0.12) par var(--line-strong), etc.
- Créer un token --blur-glass si le blur(60px) est réutilisé
- .vision-rail-left : border-right rgba(255,255,255,0.08) → var(--line-strong)
- .vision-rail-right : background rgba(255,255,255,0.02) → var(--surface)
- Vérifier que les composants utilisant ces classes (Shell, LeftRail, RightRailChat) restent identiques visuellement

---

## ÉTAPE A5 — globals.css : tokeniser rgba() partie 2 (.chat-q, .chat-ans, .tcard)

Fichier : app/globals.css

Lignes ~3215-3299 : classes .chat-q, .chat-ans, .tcard, etc. avec rgba() hardcodés.

À faire :
- Remplacer systématiquement rgba(255,255,255,0.025) par var(--surface-1)
- rgba(255,255,255,0.04) par var(--surface-2)
- rgba(255,255,255,0.07) par var(--line) ou var(--line-strong)
- rgba(255,255,255,0.42) par var(--text-ghost)
- rgba(255,255,255,0.65) par var(--text-muted)
- Si un rgba n'a pas de token exact, créer le token dans :root ou utiliser le plus proche

---

## ÉTAPE A6 — LeftRail.tsx : active state stage vs page standalone

Fichier : app/(user)/_shell/LeftRail.tsx

Problème : quand on est sur une page standalone (/reports), le bouton stage "cockpit" reste accentué car currentMode n'est pas reset.

À faire :
- Créer un hook `useRailActiveState()` ou logique inline
- Quand pathname !== "/" et pas de mode stage actif, désactiver tous les boutons stages (pas d'accent)
- OU : utiliser un state dual (stageMode + pagePath) dans le store
- Solution minimale : dans LeftRail, ajouter une condition `const isStageActive = pathname === "/" || pathname === "/cockpit-x"` et n'appliquer l'accent que dans ce cas

---

## ÉTAPE A7 — LeftRail.tsx : pathname.startsWith → matching exact

Fichier : app/(user)/_shell/LeftRail.tsx ligne 322

Problème : `pathname?.startsWith(href)` cause des faux positifs. Ex: /reports/studio active aussi /reports.

À faire :
- Remplacer `pathname?.startsWith(href)` par `pathname === href` pour les liens exacts
- Pour /reports/studio qui est un sous-chemin de /reports, utiliser une logique plus fine :
  - /reports → active quand pathname === "/reports"
  - /reports/studio → active quand pathname === "/reports/studio"
  - /settings → active quand pathname.startsWith("/settings") (car /settings/alerting est un sous-menu)

---

## RAPPORT À RENDRE

```
## Résumé — Batch A : Pages statiques + Design System

### Étape A1 — reports/page.tsx
- [ ] Fetch réel ou mock async
- [ ] ScreenShell avec loading/empty/error
- [ ] RowSkeleton pour loading

### Étape A2 — marketplace/page.tsx
- [ ] Fetch réel ou mock async
- [ ] ScreenShell avec loading/empty/error
- [ ] SearchField : disabled retiré ou badge "Bientôt"

### Étape A3 — hospitality/page.tsx
- [ ] Fetch réel ou mock async
- [ ] Empty state avec CTA "Configurer un PMS"
- [ ] Workflows depuis API

### Étape A4 — globals.css partie 1
- [ ] .vision-glass tokenisé
- [ ] .vision-rail-left/right tokenisés
- [ ] --blur-glass créé si nécessaire

### Étape A5 — globals.css partie 2
- [ ] .chat-q, .chat-ans, .tcard tokenisés
- [ ] 0 rgba() hardcodé dans ces classes

### Étape A6 — LeftRail active state
- [ ] Boutons stages désactivés sur pages standalone
- [ ] Accent uniquement quand stage actif réel

### Étape A7 — LeftRail matching exact
- [ ] pathname === href pour les liens exacts
- [ ] startsWith conservé uniquement pour /settings/*

### Validation
- pnpm typecheck : [✅/❌]
- pnpm lint : [✅/❌]
- Test visuel : /reports, /marketplace, /hospitality affichent loading puis contenu
- Test visuel : LeftRail — accent correct sur stages vs pages

### Problèmes rencontrés
[Décrire ici]
```

APPLIQUE DANS L'ORDRE A1→A7. NE SAUTE AUCUNE ÉTAPE.
