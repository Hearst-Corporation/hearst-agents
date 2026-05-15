# Audit Flow — Hearst OS, parcours minimaliste

**Date** : 2026-05-15
**Angle** : Flow pur — parcours utilisateur, navigation, transitions entre modes
**Cible** : "AI Command Line to Dashboard" — un input central, des panneaux qui se déploient, reprise zéro-friction
**Lecture** : ARCHITECTURE.md, CLAUDE.md, AGENTS.md, docs/AGENT-DRIVEN-DEV.md
**Scope** : `app/(user)/*`, `app/spatial/*`, `app/admin/*`, `app/login/*` — audit only, aucun fichier modifié.

---

## État des lieux (≤ 5 lignes)

Le shell cockpit est sain : `PulseBar` top, `TimelineRail` gauche, `Stage` polymorphe central (12 modes), `ContextRail` droit, `ChatDock` bottom, `StageFooter`, `Commandeur` Cmd+K. La promesse "agent = OS" est bien câblée côté hotkeys/Commandeur, mais elle est **diluée par 3 fuites de flow** : (1) le store `useStageStore` n'est PAS persisté → tout refresh ou retour J+1 réinitialise à `cockpit`, perte du contexte de travail ; (2) les messages d'un thread ne sont pas rechargés depuis l'API (pas de GET `/api/v2/threads/[id]/messages`) → cliquer sur une conversation passée affiche un thread vide ; (3) `/spatial` est complètement orphelin (aucun lien depuis le cockpit, aucune action Commandeur). À cela s'ajoute un `OnboardingTour` 3-slides en contradiction avec la doctrine "l'agent EST l'onboarding", et un doublon `/missions` (page legacy) qui redirige vers `/` après select — friction inutile.

---

## Carte des flows actuels

```
┌─────────────────────────────────────────────────────────────────────┐
│ ROUTES                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ /login                — OAuth (Google + Outlook), callbackUrl safe  │
│ /                     — UserLayout shell (3 col) + Stage polymorphe │
│   ├ Stage cockpit     — CockpitOrbitView (constellation + greeting) │
│   ├ Stage chat        — ChatMessages + WorkingDocument split        │
│   ├ Stage asset       — AssetStage + variants tabs                  │
│   ├ Stage asset_compare — AssetCompareStage (split diff)            │
│   ├ Stage mission     — MissionStage + StepGraph                    │
│   ├ Stage browser     — BrowserStage (Browserbase)                  │
│   ├ Stage meeting     — MeetingStage (bot + transcript)             │
│   ├ Stage kg          — KnowledgeStage (Cytoscape)                  │
│   ├ Stage voice       — VoiceStage (WebRTC overlay)                 │
│   ├ Stage simulation  — SimulationStage (DeepSeek scenarios)        │
│   ├ Stage artifact    — ArtifactStage (code + E2B)                  │
│   └ Stage signal      — SignalBoardStage (drill-down whisper)       │
│ /apps, /archive, /assets/[id], /briefing, /hospitality,             │
│ /marketplace, /missions, /notifications, /onboarding, /personas,    │
│ /reports, /runs, /settings, /reports/studio, /reports/editor        │
│ /spatial              — SpatialRoot (R3F natif) — ORPHELIN          │
│ /spatial-rnd          — R&D, hors-DS                                │
│ /spatial-safe         — sauvegarde figée (READ-ONLY ABSOLU)         │
│ /admin/*              — shell séparé, AdminSidebar + AdminTopbar    │
│ /public/reports/[token] — partage signé HMAC, lecture-seule         │
└─────────────────────────────────────────────────────────────────────┘

ENTRÉES UTILISATEUR
  - Premier login → /login → OAuth → callbackUrl=/ → Cockpit
  - Login + cookie valide → / → Cockpit (mode `cockpit` toujours, jamais reprise)
  - Refresh page → / → Cockpit (Stage store reset, focal store reset)
  - URL deep ? /missions, /apps, etc. accessibles, MAIS pas /chat/[threadId]
  - Mobile : ?stage=cockpit|chat|voice depuis PWA shortcuts → bascule + clean URL

TRANSITIONS STAGE (toutes en mémoire, non-URL)
  - Cmd+K → Commandeur overlay
  - Cmd+1..9, ⌘0 → Stage direct (hotkey)
  - Cmd+⇧V → toggle voice ; Cmd+⇧F → focus mode (rails hidden)
  - Cmd+B → WorkingDocument ; Cmd+G → VideoQuickLaunch panel
  - Cmd+⌫ → back stage (history dans store, max 20)
  - Esc → ferme focal stage ou sort focus mode
  - Tool SSE `stage_request` → setModeFromTool() (no-op si manual change < 10s)
  - Premier message dans cockpit → auto-switch chat

SESSIONS / REPRISE (= angle critique)
  - Threads persistés dans localStorage (zustand persist, v4)
  - Messages PAS persistés (PII hazard, F-077) ni rechargés par API
  - Stage mode PAS persisté → reset cockpit à chaque mount
  - Focal store PAS persisté
  - Missions actives en backend (BullMQ + scheduler) — visibles uniquement via :
      · CockpitOrbitView (data.missionsRunning count, nodes orbitaux)
      · PulseBar Anomaly Whisper (mission_failed, mission_silent — 30min TTL)
      · /missions page (liste complète, mais route séparée)
      · NO indicateur permanent "N missions en cours" dans PulseBar

ADMIN ↔ USER
  - User → Admin : icône AdminIcon dans RailFooter (Timeline gauche)
                 + Commandeur action "Console admin"
  - Admin → User : Link "Retour au workspace" dans AdminSidebar bottom
  - Admin shell = totalement séparé (pas de PulseBar, pas de Commandeur)

ERREURS
  - /404 : pas de not-found.tsx → fallback Next default
  - app/global-error.tsx → boundary Sentry top-level
  - app/(user)/error.tsx → "Retour au cockpit" + "Réessayer"
  - Toast erreur orchestrate : ChatDock fail-soft, toast 3s
```

---

## Findings prioritaires (10 max)

### `[P0] [M]` Stage store non persisté — perte totale du contexte au refresh
- **Routes impactées** : `/` (toutes les transitions Stage)
- **Friction observée** : `stores/stage.ts:108` documente explicitement "ce store n'est PAS persisté". Un user qui était en `mission` ou `asset_compare` se retrouve forcé à `cockpit` au refresh / J+1. Idem pour `lastAssetId` et `lastMissionId` qui alimentent ⌘3 / ⌘9 — ils repartent à null. Le slogan "reprendre où on s'est arrêté" est cassé.
- **Proposition** : ajouter `persist` middleware sur `useStageStore` (sessionStorage suffisant — pas localStorage pour éviter de coller à l'utilisateur J+7). Partialize sur `{ current, lastAssetId, lastMissionId }`. Garde-fou : si payload contient un id qui n'existe plus côté API, retomber sur cockpit (fail-soft à l'hydration).

### `[P0] [M]` Messages d'un thread non rechargés depuis l'API — conversations passées vides
- **Routes impactées** : `/` quand on clique un thread dans la TimelineRail
- **Friction observée** : `stores/navigation.ts:218` reset les `messages: {}` au migrate. `partialize` n'écrit jamais le contenu (volonté F-077 PII). MAIS il n'existe AUCUN `GET /api/v2/threads/[threadId]/messages` consommé par l'UI. Donc cliquer sur "Convo de mardi" = ChatStage rendu vide, comme si on n'avait rien dit. C'est le contraire d'un "ChatGPT-style rail".
- **Proposition** : route `GET /api/v2/threads/[id]/messages?limit=50` qui sert depuis `chat_messages` (déjà ciblé par /api/v2/search). Hook côté `HomePageClient.useEffect([activeThreadId])` qui hydrate `messagesRaw` au switch. Cache 30s côté client pour éviter le refetch sur ping-pong.

### `[P0] [S]` `/spatial` totalement orphelin — gimmick caché ou nuisible ?
- **Routes impactées** : `/spatial`
- **Friction observée** : `grep -rE "/spatial"` dans le cockpit user retourne zéro lien. Pas d'action Commandeur, pas de bouton PulseBar, pas d'entrée dans STAGE_HOTKEYS. La route existe (`app/spatial/page.tsx`) mais n'est découvrable qu'en tapant l'URL. Pour un module qui a son propre R3F natif + cinematic camera + DOF GPU (cf. memory project_spatial_*), c'est soit un easter egg, soit un coût mort. La doctrine `memory/project_spatial_architecture.md` dit pourtant "Toggle in-app expert 2D ⇄ spatial 3D".
- **Proposition** : (a) ajouter une action Commandeur `Ouvrir la vue spatiale` avec hint "Vue 3D du cockpit (⌘.)" ET une hotkey `⌘.` (ou `⌘⇧S`) ; (b) à l'arrivée sur /spatial, un bouton retour minimal "Cockpit ←" en top-left ; (c) état préservé : si on était en mode `mission` côté 2D, /spatial garde le focus sur cette mission (passer `lastMissionId` via query param ou nav).

### `[P1] [S]` OnboardingTour 3-slides contradit la doctrine "agent = onboarding"
- **Routes impactées** : `/` au premier login
- **Friction observée** : `OnboardingTour.tsx` lit `localStorage.hearst.onboarded` et affiche 3 slides éditoriales ("Hearst voit ce que tu vois", etc.). La directive de mission interdit explicitement les wizards et product tours. Le `CockpitHero` + le placeholder Cmd+K "Demande à Hearst…" suffisent largement pour exprimer la promesse. Le tour ajoute un mur entre le user et son premier message.
- **Proposition** : supprimer `OnboardingTour` du render (`CockpitStage.tsx:114`), garder le composant si quelqu'un veut le ressusciter en variant A/B server-side, mais sortir le mount par défaut. Remplacer par : placeholder rotatif dans Cmd+K ("Brief du jour", "Connecte Gmail", "Lance une recherche") — déjà à moitié là.

### `[P1] [S]` Doublon `/missions` page legacy ↔ Stage `mission` — double clic inutile
- **Routes impactées** : `/missions`, `/missions/[id]`, `/`
- **Friction observée** : `app/(user)/missions/page.tsx:54-61` `handleRowOpen` fait `setStageMode({mode:"mission", ...}) + router.push("/")`. Donc l'utilisateur arrive sur `/missions`, clique une mission, et est redirigé vers `/` avec le Stage mission ouvert. Pourquoi avoir une page liste si elle ne sert qu'à dispatcher ? Pareil pour `/runs` (341 lignes) qui pourrait être une section ContextRail ou une commande Commandeur.
- **Proposition** : (a) court terme : rendre Cmd+K → "Mes missions" un panneau de résultats inline dans la palette (pas de redirect). La page `/missions` devient deep-linkable pour partage mais le path canonique est `/` + Stage. (b) long terme : supprimer la page liste, exposer la liste via ContextRail quand stage=cockpit, ou via Commandeur section "Missions" déjà câblée.

### `[P1] [M]` Aucun indicateur permanent "missions en cours" dans la PulseBar
- **Routes impactées** : `/` (PulseBar, toutes routes)
- **Friction observée** : `PulseBar.tsx` n'expose `isRunning` que pour l'état du run chat en cours (`coreState`). Les missions BullMQ qui tournent en arrière-plan (scheduler) sont invisibles sauf via : Anomaly Whisper (event uniquement) ou orbital nodes (cockpit only). Un user qui passe en `chat` ou `asset` perd la visibilité sur "3 missions tournent en parallèle". La directive cible "missions actives en background : micro-indicateur dans PulseBar" n'est pas tenue.
- **Proposition** : nouveau micro-indicateur PulseBar à droite du `connections meter` : `◐ N missions` (dot accent-teal animé si > 0). Source : `data.missionsRunning.filter(m=>m.status==="running").length` exposé par `/api/v2/cockpit/today` (déjà calculé). Click → ouvre Commandeur préfillé "Mes missions" ou Stage `signal` filtré sur missions.

### `[P1] [S]` Pas de deep-link conversation — partage impossible
- **Routes impactées** : `/` (threads)
- **Friction observée** : le `threadId` vit dans `useNavigationStore.activeThreadId` (localStorage), jamais dans l'URL. Impossible de partager un lien vers une conversation passée à un collègue (ou de bookmark "ma convo Sequoia"). Reports ont un partage HMAC (`/public/reports/[token]`), threads non.
- **Proposition** : route `/c/[threadId]` (mince — server component qui set le activeThreadId via search param `?thread=` au mount). Hook sync URL ↔ activeThreadId dans HomePageClient. Pas de partage public (PII) — accès soumis à scope user, comme aujourd'hui. Bonus : ChatGPT-like URL = standard mental de l'utilisateur.

### `[P2] [S]` Pas de `not-found.tsx` racine — 404 = fallback Next nu
- **Routes impactées** : toute URL non matchée
- **Friction observée** : `app/not-found.tsx` n'existe pas. Une URL typo ou un lien périmé tombe sur la page Next default (anglais, sans branding, sans retour cockpit). Le rapport public (HMAC expirée) atterrit dessus aussi.
- **Proposition** : créer `app/not-found.tsx` minimal — t-28 "Page introuvable" + Action "Retour au cockpit" + lien vers `/login` si déconnecté. Cohérent avec `app/(user)/error.tsx` existant.

### `[P2] [M]` Cockpit → Chat = bonne transition, mais retour cockpit perd le focus
- **Routes impactées** : `/` mode `cockpit` ↔ `chat`
- **Friction observée** : depuis cockpit, premier message → `setStageMode("chat")` (HomePageClient:207-209, ChatDock:172-174). Bon. Retour cockpit (⌘1, Home rail) = `setActiveThread(null) + setStageMode("cockpit")` (TimelineRail.tsx:121). Mais le thread créé reste dans le rail "Conversations" en haut, ET le focal store est cleaned. Si l'utilisateur veut "remontrer ce que je viens de finir", il doit cliquer le thread → on retombe sur `[P0]` messages vides.
- **Proposition** : (couplé au fix `[P0]` messages reload) — au retour cockpit, garder `activeThreadId` au lieu de le clear, et exposer "Reprendre la dernière conversation →" dans `CockpitHero` ou `OrbitalQuickActions`. C'est ça, la promesse "reprendre où on s'est arrêté".

### `[P2] [S]` Cmd+K placeholder statique — promesse "tape, déploiement de panneaux" sous-vendue
- **Routes impactées** : `/` (PulseBar Cmd+K trigger)
- **Friction observée** : `PulseBar.tsx:218` "Demande à Hearst…" reste figé. La directive cible "30 premières secondes : un seul input au centre, l'utilisateur tape, des panneaux se déploient" — mais l'entrée principale (`PulseBar`) est une mini-pill. L'utilisateur ne pige pas que c'est l'input central. Le vrai input (`ChatDock`) est en bas.
- **Proposition** : (a) placeholder rotatif 4-5s avec exemples contextuels selon Stage ("Génère mon brief", "Mes PRs stuck", "Connecte Notion") ; (b) sur cockpit empty / first-load (zero threads), pousser le focus directement dans le `ChatDock` au mount — l'utilisateur tape sans cliquer. C'est l'AI Command Line.

---

## Shape du parcours idéal

```
[J+0, 14:23, premier login]

1.  /login → click "Continuer avec Google" → callbackUrl=/ (cookie set)
2.  Arrivée sur /
    └─ Layout : PulseBar (vide, pas de signal) + Rails (vides) + Stage cockpit
    └─ ChatDock focus automatique (auto-focus sur empty state)
    └─ Placeholder rotatif : "Brief du jour", "Mes PRs stuck", "Synthèse Gmail"
    └─ CockpitHero : "Adrien", date, "Pas encore de signal" + CTA "Connecte Gmail →"
    └─ PAS d'OnboardingTour — l'agent EST l'onboarding
3.  Utilisateur tape : "génère mon brief du jour"
    └─ Premier message → addThread → setStageMode("chat", threadId)
    └─ URL devient /c/<threadId> (deep-link)
    └─ ChatStage : focal slot prêt, WorkingDoc collapsé
    └─ SSE stream : `stage_request` tool → si l'agent décide d'ouvrir un asset,
       Stage switch vers `asset` AVEC stage_history.push() pour ⌘⌫
4.  Mission async lancée par l'agent → PulseBar affiche `◐ 1 mission`
    └─ Toujours visible, indépendamment du Stage actif

[J+1, 09:12, retour]

5.  Cookie OK → / → Stage store hydraté depuis sessionStorage
    └─ Si `current.mode` = "asset" ET assetId valide → rouvre l'asset
    └─ Si threadId persisté → fetch GET /api/v2/threads/<id>/messages → ChatStage
       reprend avec les messages déjà rendus (skeleton 200ms si fetch lent)
    └─ PulseBar Anomaly Whisper si `mission_silent` détecté pendant la nuit
6.  Utilisateur veut switcher de mission → ⌘K → tape "sequoia" → résultats
    threads + missions inline → Enter → Stage mission ouvert, history pushed
7.  Veut voir l'ensemble en 3D → ⌘. → /spatial avec lastMissionId préservé
    └─ Bouton "Cockpit ←" top-left pour retour instant
    └─ Esc retour aussi

[Erreurs systémiques]

8.  Session expirée → next page request → /login?callbackUrl=<current>
    └─ Re-login → retour exactement où on était (Stage hydraté)
9.  Mauvaise URL → /not-found → "Retour au cockpit"
10. /api/orchestrate 500 → toast 3s + state coreState=error + StageFooter
    "Erreur · Réinitialiser" — pas de dead-end
```

Comptage clics premier message → premier résultat :
- **Aujourd'hui** : 1 click (login Google) + 0 click cockpit + Tab nécessaire pour reach ChatDock + tap message + Enter = **~3 actions** dont 1 inutile (Tab/click sur ChatDock).
- **Cible** : 1 click login + auto-focus + tap message + Enter = **2 actions**. Le -33% vient de l'auto-focus `ChatDock` quand cockpit empty.

Comptage clics reprise J+1 :
- **Aujourd'hui** : 1 click login + cockpit (reset) + click "Conversations" rail + click thread = ChatStage VIDE = catastrophique.
- **Cible** : 1 click login + Stage rehydrate → on est déjà là.

---

## 3 quick wins < 1h

1. **Auto-focus `ChatDock` au mount du cockpit empty** — `CockpitStage.tsx` ou `HomePageClient.tsx` useEffect : si `messages.length === 0 && stageMode === "cockpit"`, find `[data-testid="chat-input"] textarea` et `.focus()`. ~20min, gain UX énorme.

2. **Supprimer `OnboardingTour` du mount** — retirer la ligne `<OnboardingTour />` de `CockpitStage.tsx:114`. Garder le composant pour A/B futur. ~10min, élimine un wizard contradictoire avec la doctrine.

3. **Action Commandeur `/spatial` + hotkey `⌘.`** — ajouter une entrée dans `use-commandeur-actions.ts` après `go-artifact` (`id: "go-spatial"`, label "Vue spatiale", hint "Cockpit 3D", hotkey "⌘."), et dans `use-global-hotkeys.ts` un check `if (meta && e.key === ".") router.push("/spatial")`. ~30min, sort `/spatial` de l'orphelinat.

---

## 2 paris structurants > 1 jour

1. **Stage store persisté + reload des messages thread** — pari fondateur. Couple `[P0]` finding #1 et #2.
   - Étapes : (a) middleware persist sur `useStageStore` avec partialize `{current, lastAssetId, lastMissionId}` ; (b) hydration guard côté `HomePageClient` qui vérifie validité de l'asset/mission (HEAD `/api/v2/assets/<id>` 200) sinon fallback cockpit ; (c) route `GET /api/v2/threads/<id>/messages` + hook reload dans `useEffect([activeThreadId])` ; (d) deep-link `/c/[threadId]` sync URL ↔ store ; (e) e2e Playwright "login → message → refresh → état préservé" ; (f) update spec `docs/features/stage.md` (un invariant ajouté : Stage rehydratable). Effort : ~1.5j. Impact : passe d'un "outil one-shot" à un vrai "OS qui se souvient" — c'est LE pivot vers le standard ChatGPT/Linear.

2. **Fusion `/missions` page + Stage mission + indicateur PulseBar permanent** — ramène l'OS à la promesse "agent fait tourner des choses, je vois en temps réel".
   - Étapes : (a) micro-indicateur PulseBar `◐ N missions` (cf. finding #6) ; (b) retirer la page `/missions` de la nav, garder route active mais marquer deprecated dans Commandeur (ou la convertir en redirect `/?stage=mission&list=1`) ; (c) nouveau sub-Stage `mission_list` (ou ContextRail section quand stage=cockpit) qui sert la liste inline ; (d) intégrer la sélection multi-mission pour comparer/batch (parité avec asset_compare) ; (e) e2e "lancer mission → voir indicateur PulseBar persister sur stage chat → drill-down depuis l'indicateur". Effort : ~1.5-2j. Impact : `/missions` arrête d'être un silo, le rail TimelineRail (conversations passées) cohabite proprement avec le compteur de missions actives — les deux niveaux de session de la directive sont enfin visibles.

---

## Annexes

### Fichiers clés inspectés

- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/layout.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/HomePageClient.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/page.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/Stage.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/PulseBar.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/Commandeur.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/ChatDock.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/StageFooter.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/stages/CockpitStage.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/stages/ChatStage.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/timeline-rail/TimelineRail.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/timeline-rail/RailExpandedBody.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/timeline-rail/RailFooter.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/use-commandeur-actions.ts`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/OnboardingTour.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/MobileBottomNav.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/WelcomePanel.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/components/stages/CockpitHero.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/missions/page.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/(user)/error.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/login/page.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/spatial/page.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/admin/layout.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/admin/_shell/AdminSidebar.tsx`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/app/hooks/use-global-hotkeys.ts`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/stores/stage.ts`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/stores/navigation.ts`
- `/Users/adrienbeyondcrypto/Dev/hearst-os/e2e/happy-path.spec.ts`, `/Users/adrienbeyondcrypto/Dev/hearst-os/e2e/smoke.spec.ts`

### Routes confirmées orphelines / friction

- `/spatial` : zéro lien depuis user/admin (orphelin)
- `/missions` : doublon avec Stage mission (legacy)
- `/runs` : 341 lignes de page liste, exposable via Stage/Commandeur
- `/onboarding`, `/onboarding/vertical` : routes existent, à vérifier si encore actives (OnboardingTour utilise localStorage, pas la route)

### Hors-scope explicite

- `/spatial-safe`, `components/spatial-safe/**` : sauvegarde figée, lecture seule absolue (CLAUDE.md). Aucune touche.
