# Plan de migration — App Hearst OS (4102) → Shell visionOS du lab (5173/cockpit)

> Migrer l'app principale `localhost:4102` vers le shell visionOS du
> lab `localhost:5173/cockpit`, **sans casser l'existant en cours de
> route**, avec un point de rollback à chaque étape.

---

## 1. Audit éclair de l'existant

**App principale** (`localhost:4102`) — Next.js 16, React 19.2.4,
Tailwind v4, Framer Motion 12, app router.

Routes actuelles dans `app/(user)/` :
```
page.tsx + HomePageClient.tsx (381L)    → cockpit home actuel
layout.tsx (207L)                       → SHELL ACTUEL (à remplacer)
apps/                                   → connecteurs OAuth
archive/                                → historique
assets/                                  → bibliothèque + studio
briefing/                                → daily brief
hospitality/                             → vertical métier
marketplace/                             → templates publics
missions/                                → workflow runs
notifications/                           → drawer alertes
onboarding/                              → first-run
personas/                                → voix éditoriales
reports/                                 → rapports + studio
runs/                                    → historique runs
settings/                                → admin
```

Hors scope (NE JAMAIS toucher) : `app/spatial-safe/`, `app/admin/`,
`app/api/`, `app/hearst-card/`, `app/login/`.

**Lab** (`localhost:5173/cockpit`) — Vite, mêmes versions, Shell
visionOS complet (88 + 320 + footer 3 zones + AmbientLayers + 3D).

**Compatibilité** : 100% (mêmes deps). Port = trivial sur le plan
technique. Le risque c'est la **désynchronisation** entre l'ancien
et le nouveau pendant la transition.

---

## 2. Stratégie en 6 phases

### Phase 0 — Cadrage (1 demi-journée)

**Objectif** : décisions structurantes avant d'écrire une ligne.

Tâches :
- Décider du nom de la route parallèle. Recommandation : `app/(user-x)/`
  (group route Next.js, layout dédié, isolé de l'actuel `(user)`)
- Décider du namespace stores : `stores/x-*` ou réutilisation directe
  des stores existants ? **Recommandation : réutiliser** les stores
  actuels (stage, navigation, focal, etc.) — c'est la logique métier,
  elle est testée et tourne. On change le shell, pas la logique.
- Lister les overlays globaux à porter dans le nouveau shell :
  `ApprovalModal`, `VideoQuickLaunch`, `Commandeur` (⌘K), `VoicePulse`,
  `ConfirmModal`, `ToastContainer`. Ils restent au root.
- Décider du fate des composants chrome actuels (`ChatDock`,
  `PulseBar`, `TimelineRail`, `ContextRail`, `LeftPanel`) : **à
  supprimer en phase 5**, remplacés par LeftRail + RightRail + Footer
  du nouveau shell.
- Confirmer que `/admin` et `/spatial-safe` gardent leur layout
  actuel (ils ne passent pas sur le nouveau shell — ce sont des
  zones spéciales)

Livrable : décisions notées dans ce document.

---

### Phase 1 — Coquille en place dans hearst-os (1 jour)

**Objectif** : voir le shell visionOS du lab tourner sur
`localhost:4102/x-cockpit`, à vide, identique au lab à pixel près.

Tâches :

1. Créer `app/(user-x)/` avec `layout.tsx` **minimaliste** (juste
   SessionProvider, sans ChatDock/PulseBar/etc.)
2. Créer `app/(user-x)/_shell/Shell.tsx` à partir de
   `lab/cli-os/src/scenes/CockpitScene.tsx` :
   - Copie quasi-identique du JSX
   - Renommer `CockpitScene` → `Shell`
   - Retirer `react-router-dom`
   - Ajouter `'use client'`
   - Refactor en composant générique avec props :
     ```ts
     type ShellProps = {
       navItems: NavItem[];
       activeNav: string;
       onNavChange: (id: string) => void;
       centerContent: ReactNode;
       railTitle: string;
       railItems: RailItem[];
       footerStatus: string;
       footerActions: FooterAction[];
       footerModes: FooterMode[];
     };
     ```
3. Porter `lab/cli-os/src/styles.css` dans `app/globals.css` (ajouter
   les classes `vision-*` à la fin sans toucher aux tokens existants
   — Tailwind v4 supporte l'addition propre)
4. Créer `app/(user-x)/cockpit/page.tsx` qui rend `<Shell>` avec des
   placeholders `<Ph>` partout
5. Run : `npm run dev` → ouvrir `localhost:4102/x-cockpit/cockpit`
6. Comparer côte à côte avec `localhost:5173/cockpit`

Point de validation : visuel pixel identique. Si écart, fixer avant
la phase 2.

Livrable : commit `feat(x-cockpit): coquille visionOS isolée`.

---

### Phase 2 — Mappage des stages Hearst → slots LeftRail (1 demi-journée)

**Objectif** : décider quel stage existant va sur quel slot LeftRail,
quel titre + items pour le RightRail de chaque stage, quels libellés
pour le Footer.

Mappage proposé (à challenger) :

| Slot | Stage Hearst | Route actuelle | RightRail | Footer status / 3 actions / 2 modes |
|------|--------------|----------------|-----------|--------------------------------------|
| 1 | Cockpit home | `/` | Aperçu du jour | Brief du jour / Voir / Tout / Calme — Autonome / Confirme |
| 2 | Chat | (nouveau, absorbe partiel ChatDock) | Outils invoqués | Réfléchit / Continuer / Brouillon / Annuler — Texte / Voice |
| 3 | Missions | `/missions` | Drafts / runs récents | Active / Voir / Pause / Annuler — Auto / Pas-à-pas |
| 4 | Assets | `/assets` | Variants / prompt | Génération / Choisir / Régénérer / Comparer — Veo / Runway |
| 5 | Briefing | `/briefing` | Sources | 01:47 / Play / Pause / PDF — Audio / Texte |
| 6 | Reports | `/reports` | Runs du jour | Synthèse / Exporter / Comparer / Partager — Jour / Semaine |
| 7 | Marketplace | `/marketplace` | Templates pop | Catalogue / Voir / Filtrer / Importer — Tous / Mine |
| 8 | Runs | `/runs` (absorbé) | Historique | Historique / Voir / Filtrer / Comparer — Liste / Timeline |
| 9 | Personas | `/personas` (via settings) | Voix actives | Personas / Voir / Éditer / Tester — Voix / Tons |
| 10 | Apps | `/apps` | Catégories | 5 actifs · 1 erreur / Tout / Erreurs / Disponibles — Liste / Grille |
| 11 | Notifications | `/notifications` | Récentes | 3 non-lues / Voir / Marquer / Effacer — Live / Historique |
| 12 | Settings | `/settings` | Sections | Admin / Profil / Équipe / Facturation — Vue / Édition |

Hors slots (stages absorbés en overlays ou modaux) :
- Hospitality → reste route à part `/hospitality` (vertical sur shell)
- Archive → drawer accessible depuis Cockpit home
- Onboarding → flow plein écran (sort du shell)

Slot avatar bottom = profil utilisateur (initiales).

Livrable : tableau validé.

---

### Phase 3 — Migration stage par stage (10–15 jours)

**Objectif** : porter chaque stage de l'ancien shell vers le nouveau
shell, **un par un**, sur la route parallèle `/x-cockpit/...`.

Cycle par stage :

1. Identifier les composants centraux du stage actuel
   (ex: pour Missions → `app/(user)/missions/page.tsx` +
   `app/(user)/components/missions/*`)
2. Créer le composant Center du nouveau stage dans
   `app/(user-x)/_stages/<Nom>Stage.tsx`
3. **Réutiliser les stores existants** (`useStageStore`,
   `useMissionStore`, etc.) — pas de réécriture
4. Réutiliser les composants métier réutilisables
   (`<MissionRow>`, `<EmptyState>`, etc.) en les important depuis
   `app/(user)/components/` — duplication temporaire OK, on
   déduplique en phase 5
5. Adapter le styling : remplacer les classes maison par les
   classes `vision-*` quand ça correspond, garder les patterns
   internes (charts, timelines, etc.) tels quels si ils marchent
6. Brancher le RightRail (titre + items) avec data du store
7. Brancher le Footer (status + 3 actions + 2 modes)
8. Run, screenshot, comparer
9. Demander validation
10. Commit `feat(x-cockpit): stage <nom>`

Ordre proposé (du plus à fort impact au moins critique) :

```
Étape 3.1   — Cockpit home (sans le legacy ChatDock)
Étape 3.2   — Chat (nouveau — absorbe ChatDock dans le Center)
Étape 3.3   — Missions
Étape 3.4   — Assets
Étape 3.5   — Briefing
Étape 3.6   — Reports
Étape 3.7   — Runs
Étape 3.8   — Apps
Étape 3.9   — Notifications
Étape 3.10  — Marketplace
Étape 3.11  — Personas
Étape 3.12  — Settings
```

Entre chaque étape : validation visuelle + fonctionnelle (clic,
data, hotkey).

Point critique : **les overlays globaux** (`ApprovalModal`,
`VideoQuickLaunch`, `Commandeur ⌘K`, `VoicePulse`) doivent être
montés au niveau `app/(user-x)/layout.tsx` dès la phase 1 — ils
fonctionnent au-dessus du shell.

Livrable : 12 commits, chacun avec une étape validée.

---

### Phase 4 — Bascule (1 jour)

**Objectif** : faire de `(user-x)` la route principale, `(user)`
devient legacy.

Tâches :

1. Vérifier exhaustivement que `(user-x)` couvre 100% des routes
   utilisateur de `(user)` (y compris deep links)
2. Renommer dossiers :
   ```
   git mv app/(user) app/(user-legacy)
   git mv app/(user-x) app/(user)
   ```
3. Mettre à jour les imports internes au dossier (les chemins relatifs
   marchent toujours, mais les imports absolus `@/app/(user)/...`
   pointent désormais vers la version V2)
4. Tester : npm run build → 0 erreur typescript, 0 erreur runtime
5. Tester : npm run dev → toutes les routes utilisateur s'ouvrent
   sur le nouveau shell
6. Commit `chore(shell): bascule sur le shell visionOS`

Livrable : `localhost:4102/` rend le shell visionOS.

Point de rollback : `git revert` ramène l'ancien shell en 1 commande.

---

### Phase 5 — Nettoyage (2 jours)

**Objectif** : supprimer `(user-legacy)` et le code mort associé.

Tâches :

1. Identifier les composants de `app/(user)/components/` qui ne sont
   importés QUE par `(user-legacy)` :
   - `ChatDock`, `PulseBar`, `TimelineRail`, `ContextRail`,
     `LeftPanel`, etc.
   - Tout ce qui était dans l'ancien chrome
2. Vérifier qu'ils ne sont pas non plus importés depuis `/admin`,
   `/spatial`, `/api` — si oui, garder ou décider
3. Supprimer `app/(user-legacy)/` intégralement
4. Supprimer composants chrome legacy
5. Dédupliquer les composants métier qui ont été copiés en phase 3
   (un seul `<MissionRow>` dans `app/(user)/_components/` au lieu
   de deux)
6. Tourner `npm run dead-code-purge` ou équivalent
7. `npm run validate` (tsc + lint + test) doit passer 100%
8. Commit `chore(cleanup): suppression shell legacy`

Livrable : repo nettoyé, 0 dette de duplication.

---

### Phase 6 — Déploiement (1 jour)

Tâches :

1. Push sur `main` → preview Vercel automatique
2. QA complète sur preview : toutes les routes, hotkeys, overlays,
   responsive (si applicable), modals
3. Comparer preview vs lab → cohérence visuelle
4. Promote preview → production
5. Monitor Sentry 24h pour détecter régressions
6. Documenter dans `CLAUDE.md` que le shell est désormais le shell
   visionOS du lab (suppression de la section « pivot 2026-04-29 »
   devenue obsolète)

Livrable : prod sur le nouveau shell, Sentry calme.

---

## 3. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Stores actuels couplés à des composants legacy (ex: `useNavigation` attend `LeftPanel`) | Refactor minimal du store pour découpler, **avant** la phase 3 |
| ChatDock est utilisé partout (overlay global) | À absorber dans le Center du stage Chat, **pas** garder en overlay |
| `/spatial`, `/spatial-safe`, `/admin` partagent des hooks avec `(user)` | Tracer les imports croisés à la phase 0, garder en double si besoin |
| Hotkeys Cmd+K/G/B définies dans le layout actuel | Les porter dans `app/(user-x)/layout.tsx` à la phase 1 |
| Sentry replay mask + Langfuse PII trace s'attachent au shell actuel | Re-vérifier l'attachement après bascule phase 4 |
| Tests e2e Playwright pointent vers les sélecteurs actuels | Identifier les tests cassés à la phase 3, fixer au fur et à mesure |
| Le shell visionOS n'est jamais testé en responsive (lab desktop only) | Définir le comportement mobile à la phase 0 : drawer LeftRail, off-canvas RightRail, footer empilé ? |

---

## 4. Estimation totale

| Phase | Durée |
|-------|-------|
| 0 — Cadrage | 0.5 jour |
| 1 — Coquille | 1 jour |
| 2 — Mappage | 0.5 jour |
| 3 — Stages (12) | 10–15 jours |
| 4 — Bascule | 1 jour |
| 5 — Nettoyage | 2 jours |
| 6 — Déploiement | 1 jour |
| **Total** | **16–21 jours** |

Avec un agent à plein temps : compression possible à **8–12 jours**
calendaires (l'agent code, tu valides en parallèle).

---

## 5. Garde-fous absolus pendant la migration

- **Ne JAMAIS toucher** `app/spatial-safe/`, `components/spatial-safe/`,
  `hooks/spatial-safe/`, `lib/spatial-safe/`,
  `styles/spatial-safe/`, `providers/spatial-safe/` (interdiction
  absolue CLAUDE.md)
- **Ne pas casser `/admin`** (route séparée, indépendante)
- **Ne pas modifier `app/api/`** (server actions et webhooks externes
  en prod)
- **Pas de force-push, pas de `--no-verify`** sur les hooks
- **À chaque phase** : commit sur `main` après validation, push,
  preview Vercel auto pour QA

---

## 6. Décisions à prendre maintenant (avant phase 0)

Réponds-moi sur ces 6 points avant que je lance la phase 0 (ou que
je délègue à un agent) :

1. **Branche** : on bosse sur `main` direct (workflow solo) ou sur
   une branche `feat/shell-visionos` qu'on merge à chaque phase ?
2. **Agent ou toi** : tu portes toi-même, ou tu spawn un agent
   (Claude Code, Cursor) ?
3. **Ordre des stages phase 3** : OK avec le mien (cockpit → chat →
   missions → assets → briefing → ...) ou tu veux changer ?
4. **Mobile** : on traite le responsive à la phase 0 ou on accepte
   desktop-only au lancement, mobile en phase 7 ultérieure ?
5. **Mapping LeftRail** : OK avec mon tableau ou tu veux ajuster
   certains slots ?
6. **ChatDock** : on l'absorbe dans le stage Chat (recommandation)
   ou tu veux qu'il reste en overlay flottant comme aujourd'hui ?
