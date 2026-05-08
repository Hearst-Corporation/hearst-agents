# Audit E2E Phase 2 — UI live via Playwright

**Date** : 2026-05-08 ~07:11-07:21 UTC
**Méthode** : Playwright MCP + Chrome headless, viewport 1440×900 puis 375×812
**Server** : `npm run dev` Next.js dev server sur port 9001 (Electron tué entre Phase 1 et Phase 2 → relancé via Next dev seul)
**Auth** : `HEARST_DEV_AUTH_BYPASS=1` actif, user "Utilisateur"

> Cette Phase 2 visait à valider visuellement le fix `ResearchReportArticle` et tester les ~30 cas UI du `CHECKLIST-USER.md`. **Trouvé bien plus de bugs UI que prévu.**

---

## TL;DR — verdict UI

**Le client React/Next est globalement cassé sur Playwright headless** : interactions principales (hotkeys, clics sur boutons interactifs cockpit, submit ChatDock) ne fonctionnent pas. Les **routes Next.js classiques** (nav par URL) marchent partiellement — certaines pages stuck en "Chargement…".

| Cas | Statut | Détail |
|---|---|---|
| Cockpit chargement initial | ✅ | Page render OK, sidebar + KPI strip + ContextRail + ChatDock visibles |
| Hotkey ⌘K Commandeur | ❌ | Aucun effet, composant Commandeur **absent du DOM** (0 dialog, 0 cmdk selector) |
| Clic bouton "Demande à Hearst… ⌘K" | ❌ | Click event handled mais aucun overlay rendu |
| Hotkey ⌘1 (Home) | ⚠️ | Pas de changement visible (déjà sur cockpit, mais pas de feedback) |
| Hotkey ⌘2 / ⌘N (Chat) | ❌ | Aucun switch en mode chat |
| Clic bouton "Chat ⌘N" sidebar | ❌ | Click event handled mais aucun switch Stage |
| ChatDock submit (Enter dans textarea) | ❌ | Enter ajoute `\n` au lieu de submit, **0 POST `/api/orchestrate`** émis |
| Nav directe `/missions` | ✅ | Page render avec sub-rail Cadences/Builder |
| Nav directe `/apps` | ✅ | Catalogue intégrations render |
| Nav directe `/admin` | ✅ | KPI topbar + derniers runs visibles |
| Nav directe `/assets` | ❌ | **Stuck "Chargement…" infini**, 0 cards render après 8s |
| Nav directe `/reports` | ❌ | Stuck "Chargement…" infini |
| Nav directe `/runs` | ❌ | Stuck "Chargement…" infini |
| Nav directe `/assets/[id]` (page admin) | ❌ | "Chargement…" infini, 0 fetch `/api/v2/assets/{id}` capté |
| Mobile resize 375×812 | ✅ partiel | `[data-mobile-bottom-nav]` détecté présent ; pas de drawer mobile spécifique trouvé |

**Résultat sec** : sur 14 cas testés en Phase 2, **8 KO, 5 OK, 1 partiel**.

---

## Findings critiques

### ❌ Commandeur (Cmd+K) totalement absent

**Reproduction** :
- ⌘K via `browser_press_key('Meta+k')` : aucun effet, snapshot DOM identique
- Clic sur le bouton `"Demande à Hearst… ⌘K"` (ref `e4`) : event handled mais aucun overlay
- Vérification JS : `document.querySelectorAll('[role="dialog"], [data-cmdk], [data-commandeur]').length === 0`

**Hypothèse** : le composant `<Commandeur />` ([app/(user)/components/Commandeur.tsx](app/(user)/components/Commandeur.tsx)) est probablement mounté conditionnellement via `{open && <Dialog>}` dans le layout, et le toggle `setCommandeurOpen(true)` ne se propage pas — soit le hook hotkey n'est pas attaché (`window.__hearst_hotkeys_attached__: false`), soit le store ne broadcast pas.

**Conséquence** : ⌘K ne marche pas, et le seul bouton fallback non plus → **le Commandeur est inaccessible aujourd'hui** sur cette session.

---

### ❌ Hotkeys de navigation Stage non câblés

**Reproduction** : `browser_press_key('Meta+1')`, `Meta+2`, `Meta+n` → aucun changement.

**Mapping observé** (snapshot de la sidebar) :
```
Home ⌘1 — bouton avec hotkey ⌘1
App — pas de hotkey
Chat ⌘N — bouton avec hotkey ⌘N
```

Donc `STAGE_HOTKEYS` du store `stage.ts` montre 11 modes possibles mais l'UI sidebar n'expose que `⌘1` et `⌘N`. Et même ces deux ne fonctionnent pas via le hotkey système.

**Note** : `window.__hearst_hotkeys_attached__` est `false` → le hook `useGlobalHotkeys` ne s'est probablement pas attaché correctement, ou utilise un autre marqueur.

**Conséquence** : navigation Stage par hotkey morte, l'user dépend exclusivement de la nav par URL ou du clic sidebar (qui ne marche pas non plus, voir ci-dessous).

---

### ❌ Clic sur bouton "Chat ⌘N" sidebar — aucun switch Stage

**Reproduction** : click sur ref `e51` (bouton sidebar "Chat ⌘N") → snapshot DOM identique, écran inchangé.

**Hypothèse** : le `onClick` du bouton appelle probablement `setMode({ mode: "chat" })` du store stage, mais le `<Stage>` ne re-render pas. Soit la subscribe Zustand est cassée, soit le mode n'est jamais broadcast.

**Conséquence** : impossible de switcher en mode chat depuis le cockpit.

---

### ❌ ChatDock submit ne déclenche pas `/api/orchestrate`

**Reproduction** :
1. `browser_click('textarea')` → focus OK
2. `browser_type('Salut, peux-tu me dire l\'heure ?', submit: true)` → texte rempli, Enter pressé
3. `browser_network_requests('orchestrate')` → **0 requêtes** capturées
4. `textarea.value` après submit : `"Salut, peux-tu me dire l'heure ?\n"` (avec un `\n` à la fin)

**Hypothèse** : Enter dans le textarea a inséré une newline au lieu de submit. Soit le handler `onKeyDown` du ChatDock ne preventDefault le `\n`, soit Playwright génère une séquence keydown+keypress qui pas le bon flow.

Ou plus profond : le ChatDock écoute peut-être Cmd+Enter pour submit (et pas juste Enter), et Playwright submit avec Enter seul.

**Conséquence** : impossible de tester le flow chat user via Playwright. **L'app de test ne peut pas être pilotée par script de test**.

---

### ❌ Pages `/assets`, `/reports`, `/runs` stuck en "Chargement…"

**Reproduction** : navigation à chacune → 8s d'attente → texte body contient toujours "Chargement…", 0 cards / rows / résultats rendus.

Pourtant les API répondent (testées tout à l'heure via curl) :
- `GET /api/v2/assets` → 200 + 86 assets
- `GET /api/v2/reports/runs` → 200 + plusieurs runs

**Hypothèse** :
1. Le client UI fait le fetch mais reçoit une erreur silencieuse (auth, scope) ou un format inattendu
2. Ou le client n'envoie pas du tout le fetch parce qu'un useEffect attend une condition jamais remplie (ex: thread id, persona id)
3. Ou les pages utilisent `useSWR` / `react-query` qui swallow les erreurs et restent en loading

**Network captures** (filter `/api/v2/assets`) : **0 requête** sur la page `/assets/[id]`. Le `useEffect` dans [`assets/[id]/page.tsx:18-29`](app/(user)/assets/[id]/page.tsx#L18-L29) ne semble pas s'exécuter, alors que la page s'affiche bien (avec son skeleton de chargement).

**Conséquence majeure** : trois pages user-facing critiques sont **inutilisables** sur cette instance dev — confirme ton ressenti "rien ne marche". Les missions et apps marchent parce que leur sub-rail est statique ; dès qu'il faut fetcher une liste depuis l'API, ça pète.

---

### ⚠️ Console errors — uniquement HMR WebSocket failures

42 erreurs `WebSocket connection to 'ws://127.0.0.1:9001/_next/webpack-hmr' failed` capturées.

Aucune **vraie erreur runtime React/JS** détectée — pas d'unhandled promise rejection, pas de TypeError, pas de "rendered hooks differently".

**Impact** : HMR ne marche pas → reload manuel nécessaire à chaque edit code, pas une régression user. Mais **inquiétant que ce soit le seul thing qui crie** alors que tant d'interactions UI sont silencieusement cassées.

---

### ⚠️ Screenshot Playwright `wait for fonts` timeout systématique

Tous les `browser_take_screenshot` après nav à `/missions`, `/runs`, etc. timeout sur "waiting for fonts to load... fonts loaded". Workaround : utiliser `jpeg` au lieu de `png` ne change rien. Skip screenshot et utiliser bodyText eval direct.

**Impact** : audit visuel limité, mais data fonctionnelle reste capturable via JS eval.

---

## Ce qui marche

### ✅ Page cockpit (home `/`) — render initial OK

Sidebar + main + ContextRail + footer + ChatDock textbox tous présents et stylés correctement (vu sur le screenshot 00-home.png). KPI strip charge bien : "Assets 86 (83 reports)", "Missions 00/06", "Reports 03". Donc la home tire bien certaines données initiales.

### ✅ Nav directe `/missions`

Sub-rail render avec Cadences (Quotidienne/Hebdomadaire/Mensuelle/Personnalisée), Raccourcis (Builder visuel, Templates marketplace), Aide. Pas de fetch de la liste de missions (qui marcherait : `GET /api/v2/missions` retourne les 4 missions).

### ✅ Nav directe `/apps`

Catalogue rend avec Catégories (Communication/Productivité/CRM & Ventes/Développement/Design/etc.), Raccourcis, Aide.

### ✅ Nav directe `/admin`

Page admin marche bien :
- "STATUT SYSTÈME : Opérationnel"
- "Database 361ms, Storage 0ms, Connectors, Llm"
- "RUNS 0 / RUNS / MIN 0 / TAUX D'ERREUR 0.0% / LATENCE P95 —"
- **Derniers runs visibles** : 8 IDs de runs récents, **dont ceux que j'ai créés via curl tout à l'heure** (`94258268…`, `672d8498…`, `3384dd1a…`, etc.) — donc la persistence des runs marche.

### ✅ Mobile responsive 375×812

Détection `[data-mobile-bottom-nav]` retourne `true`. Le bottom nav mobile s'affiche bien après resize.

⚠️ Pas de `[data-mobile-drawer]` ou `[data-context-drawer]` trouvé → soit le ContextRail mobile utilise un autre selector, soit il n'est pas drawerizable et reste affiché.

---

## Findings observés au passage

### SystemGraph — 6 agents listés

Snapshot révèle 6 agents dans le right-panel : **Scribe, Pilot, Delve, Cortex, Pulse, Warden**.

Ce sont des **noms d'agents personnalisés** (pas les 6 agents génériques que mentionnait l'audit "cœur agentique" ni les "5 agents hospitality" du pitch). Bonne nouvelle : il y a bien une définition d'agents nommés quelque part dans `lib/agents/registry.ts` (à confirmer).

### ChatDock textarea visible mais bloqué

Le textarea est focusable et accepte le texte. Mais le submit ne déclenche pas le pipeline orchestrate. Sur le screenshot 09 / 10 on voit que la zone "Ask anything" contient bien le texte tapé.

### Pages user-facing avec sub-rail

`/missions`, `/apps`, `/admin` ont tous un layout shell + sub-rail qui s'affiche immédiatement. Le contenu dynamique (liste, cards) tente ensuite de fetch — c'est là que ça casse pour `/assets`, `/reports`, `/runs`.

---

## Hypothèse globale sur la cause des bugs UI

**Trois trucs ne marchent pas pareil** :

1. **Le store Zustand côté client n'est pas réactif** ou ne se propage pas correctement → explique :
   - Cmd+K et autres hotkeys (le hook `useGlobalHotkeys` n'attache rien sur `window.__hearst_hotkeys_attached__`)
   - Clic bouton sidebar Chat (handler set state mais `<Stage>` ne re-render pas)
   - Commandeur (toggle store mais composant pas mounté)

2. **Les fetch côté client échouent silencieusement** sur certaines pages → explique :
   - `/assets`, `/reports`, `/runs` stuck loading
   - `/assets/[id]` qui n'envoie même pas le fetch

3. **Le ChatDock submit a un bug d'event handling** → explique l'Enter qui fait `\n` au lieu de submit.

**Cause racine probable** : le **bundle client React** n'est pas correctement hydraté. Les hooks `useEffect` ne s'attachent pas, les listeners Zustand ne fonctionnent pas, les form handlers n'absorbent pas Enter. C'est typique d'une page qui sert le **server-rendered HTML** mais où le **JS client crash silencieusement** pendant l'hydratation (sauf que React 19 est censé donner une erreur visible — qu'on n'a pas vue).

**À confirmer** : ouvrir DevTools React, voir si l'arbre client est hydraté ou si seul le HTML serveur s'affiche. C'est compatible avec le fait que les links classiques (`<a href>`) marchent (= juste navigation HTML) mais les boutons React (= besoin handlers JS) ne marchent pas.

---

## Recommandations Phase 2 (informatif, pas demandé)

1. **Investiguer l'hydratation React** : ouvrir DevTools React Profiler, vérifier que les composants Commandeur, ChatDock, hotkeys sont bien hydratés client-side.
2. **Vérifier `useGlobalHotkeys` attachement** : ce hook ne pose pas son marker `__hearst_hotkeys_attached__`. À auditer dans `app/hooks/use-global-hotkeys.ts`.
3. **Tester en mode prod** (`npm run build && npm start`) au lieu de dev — le HMR WebSocket failure pourrait perturber l'hydratation Next 16.
4. **Tester en Electron** au lieu de Playwright Chromium pur — l'environnement Electron applique potentiellement des polyfills/wrappers que Chromium nu ne fait pas.

---

## Limites de cet audit

- Screenshot Playwright timeout sur fonts → audit fait majoritairement via `bodyText eval`, pas de capture visuelle systématique.
- Test sur **Next dev server**, pas Electron. L'Electron utilise potentiellement le serveur `next standalone` en prod-like, qui a son propre comportement.
- Le ChatDock submit nécessite peut-être Cmd+Enter au lieu de Enter — non testé.
- Le bouton "submit" du ChatDock n'a pas été cliqué directement (j'ai utilisé Enter) — peut-être que le clic explicite sur le bouton submit `[type="submit"]` aurait marché.
- Console errors filtrées sur HMR — peut-être qu'il y a des erreurs React legit cachées dans les warnings ou dans la stack qui ne remontent pas via `browser_console_messages`.

---

## Synthèse pour décision

**Le bug user-visible "rapport en JSON brut" est fixé** côté code (`ResearchReportArticle.tsx`). Mais **on n'a pas pu valider visuellement** sur Playwright headless — l'app cockpit est trop cassée pour piloter un flow `setMode({mode:"asset"})` proprement.

**Pour valider en pratique** : Adrien ouvre l'Electron lui-même, tape "fais un rapport sur X", clique sur l'asset généré → si ça affiche le report mis en forme (et non du JSON brut), le fix tient.

**Pour les bugs UI restants** : ils sont **probablement dus à l'hydratation React qui pète sur dev server**. À tester en prod build. Si ça persiste en prod → c'est un bug structurel React/Next à investiguer dans la layout `app/(user)/layout.tsx`.

---

**Fin Phase 2. Aucun fichier de code applicatif modifié dans cette passe.**
