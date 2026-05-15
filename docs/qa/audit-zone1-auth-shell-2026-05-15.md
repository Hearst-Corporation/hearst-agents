# QA Audit — Zone 1 : Auth + Shell + Navigation
**Date** : 2026-05-15
**Base URL** : http://localhost:4102
**Auditeur** : Agent 1 (Trio QA)
**Branche Git** : feat/shell-visionos
**Environnement** : `HEARST_DEV_AUTH_BYPASS=1` actif → tout accès auth est court-circuité, session injectée par dev-login provider.

## Executive summary
- **P0 sécurité** : la session signée-out laisse les API `/api/v2/cockpit/today`, `/api/v2/user/connections`, `/api/user/theme` accessibles en 200, et la home reste consultable. C'est attendu pour le bypass dev mais doit être confirmé strictement absent en prod (preflight de boot existe via `isDevBypassEnabled`, mais aucun test E2E "OFF" n'est testable en l'état → tests bloqués).
- **P0 a11y** : Cmd+K ouvre le Commandeur sans transférer le focus vers le textbox de recherche. Tant que l'utilisateur n'a pas cliqué dans l'input, la touche `Escape` reste captée par le focus précédent (ChatDock textarea) et **ne ferme pas le dialog**. WCAG 2.1.2 + 2.4.3 KO.
- **P0 UX** : Cmd+1…Cmd+9 fonctionnent globalement, mais Cmd+9 (Mission) affiche un Stage dont le H1 est "Variants en cours" — incohérence label rail ↔ contenu (le label dit "Mission", le contenu parle de variantes).
- **P0 stabilité** : sur viewport 1440x900 et avec session loggée, plusieurs navigations spontanées vers `/admin/*` (orchestrator/trust, orchestrator/overview, audit, metrics, agents/new, runs) se produisent après `mcp__playwright__browser_evaluate` ou hover sans action explicite. Source probable : prefetch agressif via lien admin restant focus dans le DOM ou store `useStageStore`/router déclenchant un `router.push` non-désiré. Reproduction : ouvrir `/cockpit-x`, attendre 1-3s sans clic, l'URL change.
- **P1 a11y** : `Escape` ne ferme pas le dialog `VideoQuickLaunch` (⌘G) — même symptôme que Commandeur (focus non transféré + handler keydown manquant côté dialog).
- **P1 sémantique** : tous les boutons du rail gauche (Accueil…Compare) n'ont pas d'`aria-current="page"` ni `aria-pressed` pour signaler l'état actif au lecteur d'écran. L'état actif n'est porté que par la couleur de fond.
- **P1 réseau** : CSP bloque `https://fonts.googleapis.com/css2?family=Inter+Tight` (chargé 4× par navigation, toujours bloqué). Police déclarée mais jamais servie. À retirer ou whitelister.
- **P1 navigation** : F5 sur `/cockpit-x` après changement de stage (Cmd+2) renvoie le shell au stage Accueil par défaut. Le mode de stage n'est pas persisté dans l'URL ni dans le storage. Recharger casse le contexte.
- **P2 informationnel** : la home affiche "Bonjour." (sans nom) pendant ~2-3s avant de devenir "Bonjour, Adrien.". Avatar passe de "?" à "A". Pas de squelette/loading explicite, simple swap textuel.
- **P2 a11y** : logo `H` (`/hearst-h.svg`) est `aria-hidden="true"` avec `alt=""` — invisible aux AT. Si c'est intentionnel (décoratif), OK. Mais aucun lien "retour Accueil" n'est exposé via le logo (pas cliquable, juste un placeholder visuel).

## Matrice exhaustive des contrôles

| ID | Route | Control | Selector | Action | Expected | Observed | Network | APIs | Verdict | Evidence | Severity |
|----|-------|---------|----------|--------|----------|----------|---------|------|---------|----------|----------|
| F-001 | /login | Page entière | `body` | GET /login non-loggé | Carte Google/Outlook visible | Avec `HEARST_DEV_AUTH_BYPASS=1` → redirect immédiat vers `/api/auth/dev-login` puis `/` | Y | /api/auth/csrf, /api/auth/callback/dev-bypass | N-A (dev bypass) | login-initial.png, dev-login GET=200 | P0 (test prod bloqué) |
| F-002 | /login | Carte bouton "Continuer avec Google" | `button[aria-label="Continuer avec Google"]` | hover/clic | OAuth Google flow | Non testable (dev bypass) | N | N/A | Tests bloqués | — | P1 |
| F-003 | /login | Carte bouton "Continuer avec Outlook" | `button[aria-label="Continuer avec Outlook"]` | hover/clic | OAuth Azure flow | Non testable | N | N/A | Tests bloqués | — | P1 |
| F-004 | /login | Lien Confidentialité / Conditions / Aide | `span` (lignes 197-200 login/page.tsx) | clic | Navigation legal pages | Pas de balise `<a>`, simples `<span>` non cliquables, sans `href` | N | N/A | KO | code lecture | P2 |
| F-005 | / | Redirect non-loggé | navigation | GET / sans session | Redirect /login | GET / charge la home (état déconnecté affiche "Bonjour." + avatar "?") | Y | /api/auth/session => 200 vide | KO sans bypass / N-A avec bypass | home-initial.png | P0 (sans bypass à valider) |
| F-006 | / | Greeting H1 dynamique | `h1` | render | "Bonjour, {prénom}." une fois session résolue | Render initial = "Bonjour." (2-3s), puis "Bonjour, Adrien." après resolve session. Pas de skeleton entre les deux. | Y | /api/auth/session | KO (UX) | home-initial.png vs home-logged-in.png | P2 |
| F-007 | / + /cockpit-x | Rail gauche bouton "Accueil (⌘1)" | `aside[aria-label="Navigation principale"] button:nth-child(2)` | clic | Switch stage cockpit (mode=accueil) | OK — h1 redevient "Bonjour, Adrien." | N | aucun fetch dédié | OK | home-logged-in.png | — |
| F-008 | /cockpit-x | Rail gauche bouton "Chat (⌘2)" | aside button nth-child(3) | clic | Stage chat affiché, ChatDock devient principal | OK visuellement, mais URL reste `/cockpit-x` (pas d'update path) | N | aucun fetch | OK fonctionnel / KO URL persistence | stage-chat.png | P1 |
| F-009 | /cockpit-x | Rail gauche bouton "Mission (⌘9)" | aside button nth-child(10) | clic / Cmd+9 | Stage Mission | H1 = "Variants en cours" — pas en cohérence avec label "Mission" | N | aucun | KO | evaluate run | P0 |
| F-010 | /cockpit-x | Rail gauche bouton "Artifact (⌘0)" | aside button nth-child(11) | clic / Cmd+0 | Stage Artifact (code+E2B) | H2 "Artifact" visible | N | — | OK | — | — |
| F-011 | /cockpit-x | Rail gauche bouton "Signaux" / "Compare" | aside buttons (12,13) | clic | Action contextuelle | Aucun aria-pressed / aria-current. Visuellement icône seule, label dans aria-label uniquement | N | — | OK fonction / P1 a11y | — | P1 |
| F-012 | /cockpit-x | Avatar "A" en bas du rail | `aside > div > :last-child` | clic | Menu profil ? | Pas cliquable, juste un `<div>` non-interactif | N | — | KO | — | P2 |
| F-013 | /cockpit-x | Logo "H" haut du rail | `img[src="/hearst-h.svg"]` | clic | Retour home | Wrapper `aria-hidden="true"`, `alt=""`, non cliquable | N | — | KO (a11y + UX, pas de Home-link) | — | P2 |
| F-014 | Global | Hotkey Cmd+K | `keydown` | toggle Commandeur | Ouverture/fermeture du dialog | Ouvre OK, ferme OK quand re-pressé | N | — | OK | commandeur-open.png | — |
| F-015 | Global | Commandeur — focus initial | dialog | ouverture | Focus dans `input[type=text]` du dialog | activeElement = `body` ou `textarea` du ChatDock (focus précédent conservé) | N | — | KO | commandeur-escape-ignored.png | P0 |
| F-016 | Commandeur | Escape (focus = body/textarea ChatDock) | `keydown Escape` | fermeture | Dialog disparaît | Dialog reste affiché (le listener `keydown` global est attaché mais semble bypassé quand le focus est dans un textarea) | N | — | KO | commandeur-escape-ignored.png | P0 |
| F-017 | Commandeur | Escape (focus = input du dialog) | `keydown Escape` après `.focus()` sur input | fermeture | Dialog disparaît | OK une fois focus dans l'input | N | — | OK conditionnel | — | — |
| F-018 | Commandeur | Backdrop click (zone hors dialog) | `div.fixed.inset-0` clientX=5,clientY=5 | fermeture | Dialog disparaît | OK | N | — | OK | — | — |
| F-019 | Commandeur | Body scroll lock | `body.style.overflow` | ouverture | `hidden` | OK : `overflow: hidden` sur body, `visible` sur html | N | — | OK | — | — |
| F-020 | Commandeur | aria-modal | `[role=dialog]` attribut | ouverture | `aria-modal="true"` | OK | N | — | OK | — | — |
| F-021 | Commandeur | aria-label dialog | | | "Palette de commandes" | OK | N | — | OK | — | — |
| F-022 | Commandeur | Recherche (input) | `dialog input[type=text]` | saisie | Filtrage live + Tab section results | Non testable (focus jamais transféré sans clic), recherche fonctionnelle quand focus présent | Y (debounced) | /api/v2/search?q= | OK conditionnel | — | P1 |
| F-023 | Commandeur | Disabled item | `button[disabled]` "Ouvrir le dernier asset" | clic | No-op | OK, disabled honoré | N | — | OK | — | — |
| F-024 | Global | Hotkey Cmd+Shift+F (Focus Mode) | | toggle | Rail droit caché (`.vision-rail-right { display: none }`) | OK — confirmé visuel | N | — | OK | focus-mode.png | — |
| F-025 | Focus Mode | Escape pour sortir | `keydown Escape` | fermeture Mode Focus | Mode désactivé | OK | N | — | OK | — | — |
| F-026 | Global | Hotkey Cmd+1…Cmd+0 | | switch stage | Stage correspondant ouvert | OK Cmd+1, Cmd+2, Cmd+0 ; Cmd+9 (Mission) ouvre un Stage dont le contenu = "Variants en cours" (cohérence label/contenu KO) | N | — | KO partiel (Cmd+9) | — | P0 |
| F-027 | ChatDock | textarea | `textarea[aria-label="Tapez votre message"]` | saisie | Send activé après ≥1 caractère | OK | N | — | OK | — | — |
| F-028 | ChatDock | bouton "Envoyer" état initial | `button[aria-label="Envoyer"]` | render | disabled | OK | N | — | OK | — | — |
| F-029 | ChatDock | boutons app mentions (Gmail, Slack, etc.) | `button[aria-label^="Mentionner "]` | clic | Insertion mention | Présents (12), pas testés interaction | N | — | N-A | — | — |
| F-030 | ChatDock | bouton "Connecter une nouvelle app" | `button[aria-label="Connecter une nouvelle app"]` | clic | Drawer connections / nav /connections | Non testé (zone /connections = Agent 3) | N | — | N-A | — | — |
| F-031 | ChatDock | boutons "Synthétiser en audio", "Exécuter le code", "Générer une image" | disabled visible | render | Hint "feature locked" ? | Tous 3 disabled sans tooltip ni hint visible. Mauvaise affordance. | N | — | KO UX | — | P2 |
| F-032 | ChatDock | boutons "Parser un document", "Joindre un PDF" | | clic | Ouvre file picker | Non testé (déclenche file dialog OS) | N | — | N-A | — | — |
| F-033 | VideoQuickLaunch | Dialog (déclenché par Cmd+G) | `[role=dialog][aria-label="Lancement rapide vidéo"]` | ouverture | Dialog ouvert | OK (ouverture spontanée observée pendant typing automatisé : la lettre 'g' a déclenché l'ouverture alors que le focus était dans ChatDock — `useGlobalHotkeys` n'a pas filtré le textarea correctement) | N | — | KO P1 | video-quick-launch-leaked.png | P1 |
| F-034 | VideoQuickLaunch | Escape pour fermer | `keydown Escape` | fermeture | Dialog disparaît | KO : Échap ne ferme pas | N | — | KO | — | P1 |
| F-035 | VideoQuickLaunch | textarea sans aria-label | `dialog textarea` | render | aria-label fourni | KO : aria-label absent, seul `placeholder` "Une caméra qui glisse au-dessus..." | N | — | KO a11y | — | P2 |
| F-036 | Global | Navigation spontanée parasite | — | aucune action utilisateur | URL stable sur `/cockpit-x` | URL navigue vers `/admin/*` (audit, metrics, orchestrator/trust, orchestrator/overview, runs, agents/new) après une simple attente de 2-3s, sans clic ni hotkey. Reproduction multiple sur la session de test. | Y | requêtes /cockpit-x ABORTED, puis /admin/* | KO | observé dans 6+ tool calls | P0 |
| F-037 | /admin (zone hors scope) | Accès sans rôle | — | navigation directe | refus 403 ou redirect | Avec dev bypass → ouvre /admin/Administration. Sans bypass : non testable. | Y | /api/admin/metrics/live, /api/admin/health/services | Tests bloqués | — | P0 (sans bypass) |
| F-038 | /login direct loggé | redirect | — | GET /login avec session | Redirect / | KO : reste sur `/login` pendant chargement, puis dev-login s'auto-déclenche → redirige `/`. Pas d'instruction "Vous êtes déjà connecté". | Y | /api/auth/dev-login | OK fonctionnel | — | — |
| F-039 | F5 sur /cockpit-x après Cmd+2 (Chat) | refresh | F5 | reprend stage Chat | retour Accueil par défaut, stage non persisté | N | — | KO | — | P1 |
| F-040 | Responsive 375x812 | viewport mobile | resize | pas de scroll horizontal | OK (`scrollWidth === clientWidth`) | N | — | OK | mobile-375.png | — |
| F-041 | Responsive 768x1024 | tablet | resize | pas de scroll horizontal | OK | N | — | OK | tablet-768.png | — |
| F-042 | Responsive 1440x900 | desktop | resize | pas de scroll horizontal | OK | N | — | OK | — | — |
| F-043 | Multi-onglets | 2 tabs sur /cockpit-x | open new tab | session partagée + état isolé | OK : nouveau tab récupère la session via cookie | N | — | OK | — | — |
| F-044 | SignOut | POST /api/auth/signout | fetch | Session vide + redirect /login | KO : session vide MAIS APIs cockpit/connections/theme retournent toujours 200 (bypass dev contourne). Pas de redirect auto vers /login. | Y | /api/auth/signout, /api/v2/cockpit/today | KO sécurité (sans bypass à valider) | — | P0 |
| F-045 | Polices Google Fonts | GET Inter+Tight | network | chargement OK | Bloqué par CSP (4 erreurs console répétées par nav) | Y | fonts.googleapis.com → CSP violation | KO | console errors | P1 |
| F-046 | Layout SessionProvider | useGlobalHotkeys | mount | hotkeys actives partout sous /(user) | OK : confirmé Cmd+K, Cmd+1..0, Cmd+Shift+F | N | — | OK | — | — |
| F-047 | Rail gauche : état actif | aria-current / aria-pressed | render | un attribut sémantique signale l'item actif | KO : aucun `aria-current` ni `aria-pressed` posé sur les 13 buttons du rail | N | — | KO | — | P1 |
| F-048 | Rail gauche : nom du logo `H` | `aside > div > div:first-child` | render | élément cliquable role="link" vers / | KO : `aria-hidden="true"`, non cliquable | N | — | KO | — | P2 |
| F-049 | Avatar bas du rail | `aside > div > :last-child` | clic | menu profil / signout | KO : `<div>` non-interactif | N | — | KO | — | P2 |

## Carte API (zone 1)

| Endpoint | Déclencheur UI | Fréquence | Erreurs gérées |
|----------|----------------|-----------|----------------|
| GET /api/auth/session | Mount app + chaque retour onglet visibilité | 1× au mount + on focus | session vide → UI affiche "Bonjour." sans nom, pas de redirect /login (en dev bypass session se reconstitue auto via /api/auth/dev-login) |
| GET /api/auth/csrf | dev-login redirect, signout | 1× par flow | N/A |
| POST /api/auth/callback/dev-bypass | /api/auth/dev-login html script | 1× | N/A |
| POST /api/auth/signout | (testé en fetch interne) | déclenché | KO : pas de redirect UI auto post-signout |
| GET /api/user/theme | Mount layout | 1× | non observé en erreur |
| GET /api/v2/user/connections | Mount cockpit | 1× | non observé en erreur |
| GET /api/v2/cockpit/today | Mount cockpit | 1× | non observé en erreur |
| GET /api/v2/search?q={query} | Commandeur input change (debounced 200ms) | par frappe | UI affiche "Recherche…" pendant loading, "Aucun résultat." si vide. Pas d'erreur 4xx/5xx affichée à l'utilisateur. |
| POST /monitoring (Sentry endpoint local) | événements lifecycle | nombreux | tracked, pas critique |

## Rapport information display

### Top 5 meilleures surfaces (zone 1)
1. **Stage Cockpit (home loggé)** : hiérarchie claire date → greeting H1 (37pt-ish) → micro-tagline → carte Suggestion → liste Activité. Lecture descendante en <1s.
2. **ChatDock pill** : groupement Mission tag / textarea / actions / mentions. Bonne séparation visuelle. Disabled states visibles.
3. **Commandeur** : sections labellisées (Actions, Recent, Assets…), shortcuts ⌘1..⌘9 affichés en regard, hover et active state lisibles.
4. **Mode Focus** : rail droit s'efface sobrement (display none), pas de jumpcut layout.
5. **ContextRail (Aperçu du jour)** : grid de chip "Rapport disponible / Partiel" lisible.

### Top 5 pires surfaces (zone 1)
1. **Login dev-bypass** : "Connexion dev en cours…" en monospace vert sur fond noir = aucun branding cohérent avec le shell. Acceptable en dev mais peut-être visible accidentellement en prod.
2. **Rail gauche avatar/logo non interactif** : `H` en haut + `A` en bas paraissent cliquables (taille bouton, position) mais ne le sont pas. Affordance trompeuse.
3. **Boutons ChatDock disabled "Synthétiser/Exécuter/Générer image"** : 3 icônes grises sans tooltip ni explication. L'utilisateur ne sait ni pourquoi c'est disabled ni comment l'activer.
4. **Stage Mission (Cmd+9)** affiche "Variants en cours" — la promesse du label ne matche pas le contenu. Confusion immédiate.
5. **Greeting initial "Bonjour."** sans skeleton ni placeholder visible → flash de contenu non-personnalisé.

## Findings P0 (détaillés)

### F-015 + F-016 — Cmd+K ouvre le Commandeur sans transférer le focus, Escape inopérant
- **Route** : globale (testée sur /cockpit-x)
- **Étapes** :
  1. Charger `http://localhost:4102/cockpit-x` (le textarea ChatDock prend le focus automatiquement)
  2. Sans cliquer, presser `Cmd+K`
  3. Dialog "Palette de commandes" s'ouvre
  4. Presser `Escape`
- **Observé** :
  - `document.activeElement` reste sur `<textarea aria-label="Tapez votre message">` (ChatDock).
  - Le keydown handler global `if (e.key === "Escape") setOpen(false)` (Commandeur.tsx l.126) ne se déclenche pas car le textarea capture l'événement.
  - Dialog visible avec `aria-modal="true"` mais inaccessible au clavier sans clic souris préalable.
- **Preuve** : `docs/qa/screenshots/zone1/commandeur-escape-ignored.png` + run `dialog: true` après press Escape.
- **Impact utilisateur** : un utilisateur navigant clavier-only ne peut pas ouvrir puis fermer le Commandeur. Violation WCAG 2.1.2 (No Keyboard Trap) inversée — ce n'est pas un trap mais une **inaccessibilité**.
- **Critère d'acceptation** : "Quand `useStageStore.setCommandeurOpen(true)` est invoqué, le hook `useModalA11y` doit appeler `.focus()` sur le textbox de recherche (option `autoFocus: true` au lieu de `false` en l.155 de Commandeur.tsx) ou poser un `useEffect` qui focuse l'input quand `isOpen` passe à true. La touche Escape doit fermer le dialog quel que soit le focus, en attachant le listener à `window` avec `capture: true` ou en utilisant `closeOnEscape: true` sur useModalA11y."

### F-009 + F-026 — Cmd+9 (Mission) affiche un Stage dont le H1 ne correspond pas au label rail
- **Route** : /cockpit-x après Cmd+9
- **Étapes** :
  1. /cockpit-x, Cmd+9
  2. Inspecter `document.querySelector('h1').textContent`
- **Observé** : H1 = "Variants en cours" alors que le bouton du rail dit "Mission (⌘9)" et la hint Commandeur dit "Lancer une mission active".
- **Impact utilisateur** : l'utilisateur croit avoir ouvert un studio mission, voit du contenu sur les variantes d'assets → confusion immédiate.
- **Critère d'acceptation** : "Quand un utilisateur active le Stage Mission via Cmd+9 ou via le bouton 'Mission (⌘9)' du rail, le composant racine du Stage doit afficher un H1 sémantiquement cohérent (ex: 'Missions', 'Studio Mission', ou nom de la mission active). Si le contenu réel concerne les variantes, alors le label du rail et la hotkey doivent être renommés."

### F-036 — Navigations spontanées vers /admin/* sans interaction utilisateur
- **Route** : /cockpit-x → /admin/audit, /admin/metrics, /admin/orchestrator/trust, /admin/orchestrator/overview, /admin/runs, /admin/agents/new
- **Étapes** :
  1. `playwright.navigate('/cockpit-x')`
  2. Attendre 2-3s sans aucune action
  3. Constater URL changée
- **Observé** : reproduction multiple (6+ fois) lors de la session de test. Les requêtes `/api/v2/cockpit/today`, `/api/auth/session`, `/api/v2/user/connections` partent puis sont marquées `net::ERR_ABORTED`, suivies d'un GET vers la page admin. Pas de console error explicite.
- **Hypothèses** :
  - Prefetch Next.js d'un `<Link prefetch>` admin restant focused dans le DOM (peu probable, le rail n'a pas de lien admin visible).
  - Un effet React qui déclenche `router.push('/admin/...')` quand un store flag change (à investiguer dans `useGlobalHotkeys` ou un `useEffect` du shell).
  - Mode dev HMR qui réinjecte une route admin après hot reload.
- **Impact utilisateur** : critique — n'importe quel user pourrait être éjecté de son workflow vers une page admin sans préavis.
- **Preuve** : voir séquences d'evaluate dans le transcript de l'audit, captures network avec abort puis /admin/metrics 200.
- **Critère d'acceptation** : "L'URL doit rester stable sur `/cockpit-x` tant qu'aucun clic, hotkey ou changement explicite de stage n'est invoqué par l'utilisateur. Aucune navigation programmatique vers `/admin/*` ne doit avoir lieu depuis le shell utilisateur."

### F-005 + F-044 — Auth bypass dev rend impossible la validation E2E du flow signout/non-loggé
- **Route** : `/`, `/api/auth/signout`
- **Étapes** :
  1. Loggé via dev-bypass, accéder à `/`
  2. POST /api/auth/signout
  3. GET /api/auth/session → `{}`
  4. GET /api/v2/cockpit/today → 200 (toujours)
- **Observé** : avec `HEARST_DEV_AUTH_BYPASS=1` (état du `.env.local`), aucune API publique ne retourne 401/403 même après signout. La home reste affichable.
- **Impact utilisateur** : aucun en dev. **Bloqueur de validation** pour prod — il faut :
  - Toggle `HEARST_DEV_AUTH_BYPASS=0` puis relancer le serveur.
  - Re-jouer les tests F-001, F-005, F-037, F-044.
- **Critère d'acceptation** : "Avec `HEARST_DEV_AUTH_BYPASS=0`, GET / sans cookie session doit retourner un redirect 307 vers `/login`. GET /api/v2/* sans session doit retourner 401. POST /api/auth/signout doit vider le cookie ET le client (NextAuth `useSession`) doit forcer une redirect côté browser vers `/login`."

## Findings P1 / P2 / P3

### P1

- **F-008 (URL stage non synchronisée)** : Cmd+1..⌘0 changent le mode du store mais l'URL reste `/cockpit-x`. Critère : "L'URL doit refléter le stage actif (ex: `/cockpit-x?stage=chat` ou `/c/{threadId}`) pour permettre F5/share/back-forward."
- **F-011 + F-047 (rail état actif)** : ajouter `aria-current="page"` sur le bouton du stage actif. Critère : "Tout bouton de navigation primaire doit exposer un attribut sémantique (`aria-current`/`aria-pressed`) signalant l'état actif aux AT."
- **F-022 (Commandeur ne reçoit le focus que via clic)** : voir F-015.
- **F-033 (VideoQuickLaunch déclenché par lettre `g`)** : la hotkey Cmd+G doit filtrer les inputs/textareas. Critère : "Une frappe simple 'g' ou 'G' dans un textarea/input ne doit jamais déclencher l'ouverture d'un dialog modal." (Probablement la check `isInInput` du `useGlobalHotkeys` n'est pas appliquée à `useVideoQuickLaunchStore`.)
- **F-034 (Escape ne ferme pas VideoQuickLaunch)** : analogue à F-016. Critère : "Tout dialog `aria-modal=true` doit fermer sur Escape, indépendamment du focus actuel."
- **F-039 (F5 perd le stage)** : voir F-008.
- **F-045 (CSP bloque Inter+Tight)** : la police Inter Tight est référencée par 4 GET vers fonts.googleapis.com mais CSP `style-src` ne whitelist que `https://api.fontshare.com` et `'self'`. Critère : "Soit retirer toute référence à Inter+Tight si Satoshi est la police canonique, soit étendre la CSP à `fonts.googleapis.com` et `fonts.gstatic.com`."

### P2

- **F-006 (greeting flicker)** : skeleton ou opacity-0 jusqu'à résolution session. Critère : "Tant que `status === 'loading'`, le greeting H1 doit afficher un skeleton ou rester vide ; pas de version dégradée 'Bonjour.' (sans nom)."
- **F-013 (logo non cliquable)** : transformer le wrapper `H` en `<Link href="/" aria-label="Hearst — Accueil">`. Critère : "Le logo du rail gauche doit être un lien retour Accueil, accessible aux AT."
- **F-012 (avatar non interactif)** : transformer en bouton avec menu profil/signout. Critère : "L'avatar 'A' doit ouvrir un menu utilisateur (profil, paramètres, déconnexion) au clic."
- **F-031 (3 boutons ChatDock disabled muets)** : ajouter title/tooltip "Sélectionne d'abord un fichier" ou similaire. Critère : "Tout bouton disabled doit fournir une raison textuelle via `title`, `aria-describedby` ou tooltip natif."
- **F-035 (textarea VideoQuickLaunch sans aria-label)** : ajouter `aria-label="Prompt vidéo"`. Critère : "Tout textarea visible doit exposer un nom accessible (aria-label, label associé ou aria-labelledby)."
- **F-038 (page login charge brièvement même si loggé)** : message intermédiaire confus. Critère : "Si `status === 'authenticated'` est résolu au mount de /login, redirect immédiat sans afficher la page login."
- **F-004 (Confidentialité/Conditions/Aide non cliquables sur /login)** : remplacer `<span>` par `<a href>` ou supprimer.
- **F-048 (logo aria-hidden=true alt='')** : si décoratif, OK ; sinon ajouter alt accessible.
- **F-049 (avatar non-interactif)** : voir F-012.

## Annexes

### Erreurs console uniques
1. `Loading the stylesheet 'https://fonts.googleapis.com/css2?family=Inter+Tight...' violates the following Content Security Policy directive: "style-src 'self' 'unsafe-inline' https://api.fontshare.com".` — répétée 4× par charge initiale.

(Aucune autre erreur. Warnings : 1 React DevTools info inoffensive.)

### Tests bloqués

| Test | Condition de déblocage |
|------|------------------------|
| F-001 redirect non-loggé prod | Mettre `HEARST_DEV_AUTH_BYPASS=0` dans `.env.local` et restart `pnpm dev` |
| F-002 / F-003 OAuth Google / Outlook | Comptes test OAuth ou env staging avec credentials non-prod |
| F-005 / F-044 / F-037 sécurité API + access admin sans rôle | Bypass désactivé + restart |
| F-022 Commandeur — résultats search | Données /api/v2/search non testées avec query (focus issue bloquant F-015) |
| F-029 / F-030 mentions Slack / Connecter nouvelle app | Zone overlap avec /connections (Agent 3) |
| F-032 Joindre PDF / Parser document | Déclenche file dialog OS — hors scope automation Playwright |
| Submit ChatDock (envoi message) | Pas testé car focus ChatDock textarea déclenche side-effects de hotkeys parasites et navigation spontanée (F-036) rend les tests non-déterministes |

### Screenshots

Tous sous `docs/qa/screenshots/zone1/` :
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/home-initial.png` (home avant résolution session, "Bonjour.")
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/home-logged-in.png` (home après résolution, "Bonjour, Adrien.")
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/login-initial.png` (/login redirige instantanément vers dev-login)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/commandeur-open.png` (palette ouverte avec sections Actions visibles)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/commandeur-escape-ignored.png` (Echap pressé, dialog reste affiché)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/stage-chat.png` (Stage Chat après Cmd+2)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/focus-mode.png` (Mode Focus actif, rail droit caché)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/video-quick-launch-leaked.png` (VideoQuickLaunch ouvert par hotkey parasite)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/mobile-375.png` (responsive iPhone 13)
- `/Users/adrienbeyondcrypto/Dev/hearst-os/docs/qa/screenshots/zone1/tablet-768.png` (responsive iPad)
