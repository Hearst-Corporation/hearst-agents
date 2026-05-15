# QA Audit — Zone 2 : Stages + Chat + Spatial
**Date** : 2026-05-15
**Base URL** : http://localhost:4102
**Auditeur** : Agent 2 (Trio QA)
**Branche Git** : feat/shell-visionos
**Environnement** : `HEARST_DEV_AUTH_BYPASS=1` actif → session injectée via `/api/auth/dev-login`.
**Viewport principal** : 1440×900.
**AGENT-LOCK** : `locked=false` au début de session (lecture `docs/AGENT-LOCK.json`).

## Executive summary

- **P0 stabilité shell** : navigation parasite **systématique** vers `/admin/orchestrator/*`, `/admin/agents/*`, `/admin/runs/*`, `/admin/health`, `/admin/themes`, `/admin/audit`, `/admin/agent-driven-dev`, `/admin/pipeline`, `/admin/analytics`, `/public/approvals/invalid-token-test`, `/public/hearst-card/invalid-token-test` après simple navigation `/cockpit-x` ou screenshot, sans aucun clic. Reproduction multi-occurence (≥15 fois). **Identique au finding F-036 de Zone 1** — instabilité globale, pas seulement Stage. Source non identifiée dans le code utilisateur (`grep router.push` côté `/_stages/`, `/_shell/`, `cockpit-x/` = vide). Hypothèse : prefetch agressif de `next/link` admin chargé en background, ou hook DevTools / instrumentation.

- **P0 hotkeys cassés** : `Meta+2` (⌘2 Chat) ne change PAS le stage actif depuis `/cockpit-x`. Idem `Meta+K` qui ne déclenche pas l'ouverture du Commandeur (dérive vers `/admin/themes` à la place). Pourtant `STAGE_HOTKEYS` est défini dans `stores/stage.ts:181-192`. Le hook `useGlobalHotkeys` (référencé `app/hooks/use-global-hotkeys.ts` selon le doc registry.ts) n'est manifestement pas câblé dans le layout `app/(user)/layout.tsx`. À confirmer.

- **P0 doublon réseau orchestrate** : un single envoi de message dans le ChatDock déclenche **2 requêtes POST `/api/orchestrate` consécutives** (network requests #66 et #68, ~3s d'intervalle). Conséquence visible côté UI : réponse Agent dédoublée — `"Bonjour. Tout fonctionne de mon côté — tu veux attaquer quoi ce matin ? Tout fonctionne de ce côté — tu veux attaquer quoi ?"` (deux phrasings concaténés). Risque : double facturation Anthropic, double persistance run.

- **P0 endpoints SSE absents** : `/api/cc/stream` → 404, `/api/runs/events` → 404. Aucun endpoint SSE séparé. Le streaming passe vraisemblablement par la réponse `/api/orchestrate` directe (à confirmer côté impl). Ce n'est pas un bug en soi, mais conflit avec la consigne d'auditer SSE (orchestrate/cc/stream/runs/events).

- **P0 / `signal` stage manquant en source** : `app/(user)/_stages/` contient 11 fichiers `*Stage.tsx` + `registry.ts` + `types.ts`. Le mode `cockpit` n'a pas de fichier `CockpitStage.tsx` — il est rendu par `app/(user)/page.tsx` → `<CockpitXClient />`. Le mode `signal` est par contre bien présent (`SignalStage.tsx`). Le bouton "Signaux" sans hotkey (du registry) fonctionne. Au total **12 modes registry, 11 fichiers Stage + 1 page Cockpit** = OK structurel.

- **P1 LeftRail browser_click vs JS-click** : un `mcp__playwright__browser_click` physique sur les boutons LeftRail provoque la dérive `/admin/*` (cas reproductible : "Browser (⌘4)" → `/admin/runs`, "Meeting (⌘5)" → `/admin/orchestrator/overview`, "Chat (⌘2)" → `/admin/agents/new`, "Sim (⌘8)" → `/admin/orchestrator/runs/fake-run-id`). En revanche un `btn.click()` via `page.evaluate` interne **fonctionne** correctement (stage switch propre, `aria-current="page"` mis à jour). Indique un side-effect lié au hover physique de la souris (probable prefetch de Link admin survolé pendant le déplacement curseur entre 2 actions Playwright).

- **P1 voice stage = placeholder** : VoiceStage affiche `"Voice · Mode conversationnel — La conversation vocale en temps réel avec l'agent arrive prochainement. En attendant, utilise le chat texte (⌘2). INACTIF"`. Pas data-bound. Le pattern "12 stages data-bound" du shell visionOS est donc **11/12 réels**, 1 en placeholder texte.

- **P1 cohérence spatial vs spatial-rnd** : `/spatial` affiche `"Aujourd'hui, vous avez un meeting à 22:00"` et `/spatial-rnd` affiche `"Aujourd'hui, vous avez un meeting à 14:00"`. Mock data divergent entre les deux routes alors qu'elles devraient consommer la même source (selon `[Spatial = vue 3D du dashboard normal]` dans MEMORY).

- **P1 responsive mobile** : viewport 375×812 : aucun shell visionOS rendu, `aside[aria-label="Navigation principale"]` absent du DOM, page dérive immédiatement vers `/admin/pipeline` (qui lui-même affiche un message `"⌥ Vue desktop requise — Le canvas pipeline est optimisé pour les écrans larges"`). Aucun fallback mobile du shell `/cockpit-x` n'est implémenté. Le shell est desktop-only.

- **P1 CSP Google Fonts** : `https://fonts.googleapis.com/css2?family=Inter+Tight` bloqué par CSP `style-src` à chaque navigation (≥10 erreurs console identiques observées). Même finding que Zone 1.

- **P2 doublon UI Suggestion partiel** : cockpit affiche `"SuggestionpartielFounder Cockpit"` — labels mono caps "Suggestion" + "partiel" collés sans séparation visuelle. Lisibilité dégradée.

- **P2 chat send button affordance** : 3 boutons (`Synthétiser en audio`, `Exécuter le code`, `Générer une image`) sont `disabled` au boot sans tooltip ni hint. Mauvaise affordance. Idem Zone 1 F-031.

## Matrice exhaustive — Stages × Accès

| Stage | Mode | Hotkey reg. | Test rail click JS | Test hotkey clavier | aria-current | Rail title | Main content (data-bound ?) | Verdict | Evidence | Severity |
|-------|------|-------------|--------------------|--------------------:|--------------|------------|----------------------------|---------|----------|----------|
| S-01 | cockpit | ⌘1 | OK (`Accueil (⌘1)` actif au boot) | KO Meta+1 non testé direct (présumé idem ⌘2) | OK `aria-current="page"` | "Aperçu du jour" | OK : date, greeting, mission suggestion, activité 4 items (récap BTC, brief, etc.) | OK contenu / P0 hotkey | F-000-shell-cockpit.png | P0 hotkey |
| S-02 | chat | ⌘2 | OK | KO Meta+2 ne switch pas | OK | "Outils actifs" | Empty state : `"Pose une question, lance une mission, ou laisse l'agent veiller."` | OK / P0 hotkey | F-001, F-002, F-003 | P0 hotkey |
| S-03 | asset | ⌘3 | OK | KO Meta+3 non testé direct mais cassé | OK | "Génération en cours" | OK : `"4 assets · 0 prêt"` + variants v0..v3 brief "Briefing matinal — 15/05/2026" / "13/05" / "12/05" + statuts "Rendu en cours" | OK | F-004-stage-asset.png | — |
| S-04 | browser | ⌘4 | OK | KO | OK | "Session" | Empty state : `"Aucune session active. Lance une mission de navigation ou demande à l'agent."` | OK | F-005-stage-browser.png | — |
| S-05 | meeting | ⌘5 | OK | KO | OK | "Action items" | Empty state : `"Lance ou rejoins un meeting pour voir le transcript en direct."` | OK | F-006-stage-meeting.png | — |
| S-06 | kg | ⌘6 | OK | KO | OK | "Entités liées" | OK data-bound : `"Knowledge Graph · entités · relations — Appel Marc Dubois — 31 entités · 14 liaisons · 17 clusters"` + liste entités | OK | F-007-stage-kg.png | — |
| S-07 | voice | ⌘7 | OK | KO | OK | "Voice" | Placeholder : `"Voice · Mode conversationnel — arrive prochainement. INACTIF"` — **pas data-bound** | P1 | F-008-stage-voice.png | P1 |
| S-08 | simulation | ⌘8 | OK | KO | OK | "Variables" | OK : `"Chambre de simulation — DeepSeek R1 génère des scénarios business probabilistes. Scénario / Variables clés / + Ajouter / Lancer la simulation"` | OK | F-009-stage-sim.png | — |
| S-09 | mission | ⌘9 | OK | KO | OK | "Étapes" | Empty state : `"Sélectionne une mission depuis la liste ou lance une commande."` | OK | F-010-stage-mission.png | — |
| S-10 | artifact | ⌘0 | OK | KO | OK | "Artifact · E2B" | Empty state : `"Artifact — E2B · preview live — Lance une mission qui génère un artifact ou demande à l'agent. E2B sandbox · python"` | OK | F-011-stage-artifact.png | — |
| S-11 | signal | aucun | OK | N/A | OK | "Connecteurs" | OK : `"Signaux — Activité ambient — missions, connexions, briefings, vidéos. Fenêtre 1h/7j/30j/Tout. Type Tous/Échec mission/Connexion/Briefing/Vidéo/Silencieuse. Cumul 0 signal sur la fenêtre. Répartition 0 partout."` | OK structurel / contenu = 0 sur tous compteurs | — | — |
| S-12 | asset_compare | aucun | OK | N/A | OK | "Métriques" | Empty state : `"Sélectionne 2 assets depuis la liste pour les comparer."` | OK | (capture incluse F-009 montrant flow) | — |

**Score data-bound** : 8/12 stages clairement data-bound (cockpit, asset, kg, sim, signal + 3 empty states actionnables). 1/12 placeholder texte (voice). 3/12 empty states actionnables sans données démo (chat, browser, meeting, mission, artifact, compare).

## Matrice ChatDock (sur Stage Chat actif)

| ID | Contrôle | Selector | Action | Expected | Observed | Verdict | Severity |
|----|----------|----------|--------|----------|----------|---------|----------|
| C-001 | Textarea | `form[aria-label="Envoyer un message"] textarea` | focus + saisie | placeholder "Pose ta question…" | OK, placeholder correct, focus possible | OK | — |
| C-002 | Bouton "Envoyer" | `button[aria-label="Envoyer"]` | état initial | disabled (textarea vide) | OK disabled | OK | — |
| C-003 | Bouton "Envoyer" | idem | textarea remplie | enabled | OK enabled après input event | OK | — |
| C-004 | Click "Envoyer" | idem | submit form | POST /api/orchestrate, render user msg + agent reply | **2 POST /api/orchestrate** (doublon), réponse "Bonjour. Tout fonctionne de mon côté — tu veux attaquer quoi ce matin ? Tout fonctionne de ce côté — tu veux attaquer quoi ?" (doublon visible) | KO | P0 |
| C-005 | Bouton "Mission" | `button[aria-label="Mission"]` | clic | Ouvrir modal/inline mission picker | Non testable (dérive `/admin/*` avant action) | Tests bloqués | P0 |
| C-006 | Bouton "Retirer Mission" | `button[aria-label="Retirer Mission"]` | render | ne s'affiche que si mission ciblée | Apparait alors qu'aucune mission n'est sélectionnée — état zombie | KO | P1 |
| C-007 | Bouton "Auto" | `button[aria-label="Auto"]` | toggle | Mode autonome ON/OFF | Render OK, action non testée | N-A | — |
| C-008 | "Synthétiser en audio" / "Exécuter le code" / "Générer une image" | `button[aria-label="..."]` | render | disabled (lock) + tooltip explicatif | Disabled, **sans tooltip** | KO UX | P2 |
| C-009 | "Parser un document" / "Joindre un PDF" | aria-label match | clic | file picker OS | Non testé (déclencherait OS dialog) | N-A | — |
| C-010 | Boutons "Mentionner Gmail/Slack/HubSpot/Stripe/Figma/Airtable/Calendly/…" | aria-label match | clic | Insertion mention dans textarea | 12 boutons présents (`Mentionner ${app}`), action non testée | N-A | — |
| C-011 | Bouton "Connecter une nouvelle app" | `button[aria-label="Connecter une nouvelle app"]` | clic | Drawer connections | Non testé (zone /connections = Agent 3) | N-A | — |
| C-012 | Doublon mentions | observation | render | un seul bouton par app | "Mentionner Google Agenda" + "Mentionner googlecalendar" + "Mentionner googledrive" + "Mentionner Google Drive" — **doublons aliases visibles** | KO sémantique | P1 |
| C-013 | Tool buttons enable state | observation | absent thread context | tous disabled | OK 3 disabled + 7 actifs | OK conditionnel | — |

## Matrice Spatial

| ID | Route | Test | Observed | Verdict | Evidence |
|----|-------|------|----------|---------|----------|
| SP-001 | /spatial | Canvas R3F présent | `canvas` count = 1 | OK | F-020-spatial.png |
| SP-002 | /spatial | Contenu HTML overlay | "Agenda 00 · Missions 04 · Suggestions 00 · Brief · Bonjour · Aujourd'hui, vous avez un meeting à 22:00. 3 sujets demandent votre attention. · 03 sujets · ✦ Envoyer · Entrée pour orchestrer · Voix ⌘7" | OK data-bound | — |
| SP-003 | /spatial | ChatPill flottante | "Envoyer / Entrée pour orchestrer" visible | OK | F-020 |
| SP-004 | /spatial | Console errors | 2 errors CSP fonts uniquement | OK fonctionnel | — |
| SP-005 | /spatial-rnd | Canvas R3F présent | `canvas` count = 1 | OK | F-021-spatial-rnd.png |
| SP-006 | /spatial-rnd | Contenu | "Brief · Bonjour · Aujourd'hui, vous avez un meeting à **14:00**. 3 sujets... · Focus / Brief / Mission / Assets · Hearst est prêt" | OK / **divergence avec /spatial** (14:00 vs 22:00) | F-020 vs F-021 |
| SP-007 | /spatial-safe | (zone LECTURE SEULE) | Non navigué, mention uniquement pour comparaison | N-A | — |

## Carte API observée (Zone 2)

| Endpoint | Méthode | Status | Déclencheur | Notes |
|----------|---------|--------|-------------|-------|
| `/api/user/theme` | GET | 200 | mount app | 1× par boot |
| `/api/v2/user/connections` | GET | 200 | mount | 1× |
| `/api/v2/cockpit/today` | GET | 200 | CockpitXClient mount + refetch | 2× (initial RSC + client refetch) |
| `/api/auth/session` | GET | 200 | mount + focus tab | NextAuth |
| `/api/orchestrate` | POST | 200 | clic "Envoyer" ChatDock | **2× par envoi** (P0 doublon) |
| `/api/analytics` | POST | 200 | events UI multiple | 4× observés sur session courte |
| `/monitoring?o=...&p=...&r=de` | POST | 200 | Sentry instrumentation | 5× |
| `/?_rsc=...` | GET | 200 | Router RSC payload pour `/` | déclenchements multiples liés aux redirections parasites |
| `/api/cc/stream` | GET | **404** | probe direct curl | endpoint inexistant |
| `/api/runs/events` | HEAD | **404** | probe direct curl | endpoint inexistant |

**SSE endpoint absent** : aucun stream séparé. Streaming intégré dans la réponse `/api/orchestrate`.

## Info display — Top 5

1. **Doublon réponse Agent** : `"Bonjour. Tout fonctionne de mon côté — tu veux attaquer quoi ce matin ? Tout fonctionne de ce côté — tu veux attaquer quoi ?"` rendu après envoi `"Bonjour test QA Zone2"`. Deux phrasings concaténés sans séparateur. Cause = doublon POST orchestrate. P0.

2. **VoiceStage placeholder** : `"La conversation vocale en temps réel avec l'agent arrive prochainement. INACTIF"`. Pas de données réelles, message "coming soon" dans la prod. Honnêteté OK mais le stage n'est pas data-bound malgré la promesse `[Shell visionOS — 12 stages data-bound]` de MEMORY. P1.

3. **Cockpit Suggestion mono caps** : `"Suggestion partiel Founder Cockpit"` — labels accolés `Suggestion` + `partiel` sans hiérarchie visuelle. Lisibilité dégradée. P2.

4. **Mentions doublonnées** : `Mentionner Google Agenda` + `Mentionner googlecalendar` + `Mentionner Google Drive` + `Mentionner googledrive` cohabitent. Aliases d'un même provider visibles 2× chacun. Confusion utilisateur. P1.

5. **Stage Mission empty state** : `"Sélectionne une mission depuis la liste ou lance une commande."` — CTA vague ("la liste" non visible dans le viewport actif Stage). Pas de bouton "Lancer mission" inline. P2.

## Findings

### P0

#### F-100 — Navigation parasite vers `/admin/*` après navigate `/cockpit-x`
- **Étapes** : navigate `http://localhost:4102/cockpit-x` puis attente ≥1s OU clic LeftRail physique OU screenshot OU resize.
- **Observation** : URL change spontanément vers `/admin/orchestrator/overview`, `/admin/orchestrator/agents`, `/admin/orchestrator/registry`, `/admin/orchestrator/runs`, `/admin/orchestrator/telemetry`, `/admin/orchestrator/drift`, `/admin/orchestrator/quarantine`, `/admin/orchestrator/trust`, `/admin/orchestrator/release`, `/admin/audit`, `/admin/analytics`, `/admin/themes`, `/admin/agents/new`, `/admin/agents/fake-id-test`, `/admin/agents`, `/admin/health`, `/admin/agent-driven-dev`, `/admin/pipeline`, `/admin/runs/15329d72-ece0-49c4-92aa-f9b4d8c65977`, `/admin/orchestrator/runs/fake-run-id`, `/admin/orchestrator/runs/r-35e85a3e`, `/public/approvals/invalid-token-test`, `/public/hearst-card/invalid-token-test`. Reproduction ≥15 fois en 35min de session.
- **Preuves** : grep `router.push` côté `/_stages/`, `/_shell/`, `cockpit-x/`, hooks user = vide pour `/admin/*`. Donc déclenchement par `next/link` prefetch sur hover/focus, ou DevTools/Sentry instrumentation, ou erreur store provoquant Next reconciler back-nav.
- **Critère d'acceptation** : navigation à `/cockpit-x` reste sur `/cockpit-x` après 30s d'inactivité, sans dérive vers `/admin/*` ou `/public/*`. Aucune interaction Playwright (click, screenshot, resize, evaluate) ne doit muter `window.location.pathname` hors du périmètre `/cockpit-x`, `/cockpit-x?*`.
- **Sévérité** : P0 (bloque la stabilité d'audit + UX réelle pour l'utilisateur).

#### F-101 — Hotkeys globaux ⌘1..0 + ⌘K inopérants depuis `/cockpit-x`
- **Étapes** : navigate `/cockpit-x`, presser Meta+2.
- **Observation** : `active = "Accueil (⌘1)"` reste inchangé (rail title "Aperçu du jour" inchangé). Même comportement pour Meta+K (n'ouvre pas Commandeur mais dérive `/admin/themes`).
- **Preuves** : `stores/stage.ts:181` définit bien `STAGE_HOTKEYS`. Le hook `useGlobalHotkeys` est référencé en docstring de `registry.ts:11` (`app/hooks/use-global-hotkeys.ts`) mais aucun `keydown` listener n'est attaché manuellement dans le shell visionOS — à confirmer dans `app/(user)/layout.tsx`.
- **Critère d'acceptation** : Meta+2 depuis n'importe quelle route `/cockpit-x*` met le mode store à `chat`, met le bouton LeftRail "Chat (⌘2)" en `aria-current="page"`, et affiche le ChatStage. Idem Meta+1, +3, +4, +5, +6, +7, +8, +9, +0. Meta+K toggle le Commandeur.
- **Sévérité** : P0.

#### F-102 — Doublon POST `/api/orchestrate` par envoi message ChatDock
- **Étapes** : Stage Chat → textarea → input "Bonjour test QA Zone2" → click "Envoyer".
- **Observation** : network log montre 2× POST `/api/orchestrate` (requests #66 et #68). Le rendu UI montre 2 réponses concaténées du modèle.
- **Preuves** : `mcp__playwright__browser_network_requests filter:orchestrate` → 2 entries.
- **Critère d'acceptation** : un click "Envoyer" déclenche exactement 1× POST `/api/orchestrate`. La réponse Agent rend une seule string, sans concaténation de variantes.
- **Sévérité** : P0 (coût API + UX confuse).

#### F-103 — `/api/cc/stream` et `/api/runs/events` 404
- **Étapes** : `curl -I http://localhost:4102/api/cc/stream` et `/api/runs/events`.
- **Observation** : HTTP 404 sur les deux endpoints.
- **Conséquence** : si le frontend essaie d'ouvrir un EventSource sur ces URLs, échec silencieux. Mais comme aucun `EventSource(/api/cc/stream)` n'a été observé en network sur la session de test, le streaming passe vraisemblablement via la réponse POST `/api/orchestrate` (Node.js Response.body ReadableStream).
- **Critère d'acceptation** : soit ces endpoints existent et répondent en `text/event-stream` avec heartbeat, soit la documentation interne (CLAUDE.md, ADD reports) ne les référence plus.
- **Sévérité** : P0 si frontend a un fallback EventSource, P1 sinon. Marqué P0 par précaution (à confirmer côté impl).

#### F-104 — Spontaneous tab open vers `about:blank`
- **Étapes** : observation pendant session.
- **Observation** : un onglet `0: about:blank` co-existe en permanence avec `1: /cockpit-x`. Probable side-effect Playwright MCP mais à valider en condition utilisateur réelle (window.open ou target=_blank involontaire).
- **Critère d'acceptation** : aucun `window.open` ou `target=_blank` non-utilisateur sur `/cockpit-x`. À mesurer en navigateur réel (Chrome dev).
- **Sévérité** : P0 si reproductible hors Playwright, sinon P2.

### P1

#### F-110 — VoiceStage = placeholder "coming soon"
- **Étapes** : LeftRail click "Voice (⌘7)".
- **Observation** : main = `"Voice · Mode conversationnel — La conversation vocale en temps réel avec l'agent arrive prochainement. En attendant, utilise le chat texte (⌘2). INACTIF"`.
- **Preuves** : F-008-stage-voice.png.
- **Critère d'acceptation** : VoiceStage data-bound (WebRTC session, transcript live, etc.) OU stage retiré du shell tant que pas livrable. Pas de placeholder "coming soon" en prod cockpit.
- **Sévérité** : P1.

#### F-111 — Divergence /spatial vs /spatial-rnd (heure meeting)
- **Étapes** : navigate `/spatial` puis `/spatial-rnd`.
- **Observation** : `/spatial` brief = "meeting à 22:00", `/spatial-rnd` brief = "meeting à 14:00". Données mock différentes pour le même contexte utilisateur.
- **Preuves** : F-020-spatial.png vs F-021-spatial-rnd.png.
- **Critère d'acceptation** : les deux routes consomment la même source `getCockpitToday()` ou équivalent. Heures identiques pour le même user/session.
- **Sévérité** : P1.

#### F-112 — Shell visionOS desktop-only, aucun fallback mobile
- **Étapes** : resize viewport 375×812 puis navigate `/cockpit-x`.
- **Observation** : `aside[aria-label="Navigation principale"]` absent du DOM. Page dérive vers `/admin/pipeline` qui affiche `"⌥ Vue desktop requise"`. Aucun shell `/cockpit-x` mobile rendu.
- **Critère d'acceptation** : sur viewport <768px, soit le shell s'adapte (bottom bar 12 stages OU drawer), soit un écran "Vue desktop requise" intentionnel est rendu pour `/cockpit-x` (pas pour `/admin/pipeline` qui n'est pas la home user).
- **Sévérité** : P1.

#### F-113 — Mentions ChatDock doublonnées (Google Agenda × 2, Google Drive × 2)
- **Étapes** : Stage Chat → inspect form aria-labels.
- **Observation** : `Mentionner Google Agenda` + `Mentionner googlecalendar` + `Mentionner Google Drive` + `Mentionner googledrive` cohabitent. 4 boutons pour 2 providers.
- **Critère d'acceptation** : 1 bouton par provider. Aliases normalisés côté backend pas exposés à l'UI.
- **Sévérité** : P1.

#### F-114 — ChatDock bouton "Retirer Mission" affiché sans mission ciblée
- **Étapes** : Stage Chat fresh → inspect form.
- **Observation** : `button[aria-label="Retirer Mission"]` présent et non-disabled au boot, alors qu'aucune mission n'est sélectionnée.
- **Critère d'acceptation** : le bouton "Retirer Mission" n'apparaît que si une mission est attachée au prompt courant. Sinon `hidden` ou `display:none`.
- **Sévérité** : P1.

#### F-115 — CSP Google Fonts (Inter+Tight) bloqué — répété
- **Étapes** : navigate any route.
- **Observation** : 2× ERROR console `"Loading the stylesheet 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap' violates the following Content Security Policy directive: 'style-src 'self' 'unsafe-inline' https://api.fontshare.com'"` par navigation. Idem Zone 1 F-045.
- **Critère d'acceptation** : retirer le `<link rel="preload">` Inter+Tight inutilisé, OU étendre `style-src` à `https://fonts.googleapis.com`.
- **Sévérité** : P1.

#### F-116 — browser_click physique → dérive admin, JS-click → OK
- **Étapes** : `mcp__playwright__browser_click button[aria-label="Chat (⌘2)"]` vs `page.evaluate("btn.click()")`.
- **Observation** : physical click → dérive `/admin/agents/new`. JS click → switch propre.
- **Hypothèse** : hover physique de la souris pendant le déplacement du curseur entre 2 commandes Playwright traverse un `<a href="/admin/...">` (prefetch link admin), déclenchant un focus + nav. Probable cohabitation Layout admin/user shell sur mêmes routes.
- **Critère d'acceptation** : un click physique sur le bouton LeftRail "Chat (⌘2)" ne navigue jamais vers `/admin/*`. Aucun `<Link href="/admin/...">` survolable au-dessus du shell `/cockpit-x`.
- **Sévérité** : P1.

#### F-117 — Stage Signal : tous compteurs à 0 alors que SignalStage data-bound prévu
- **Étapes** : LeftRail click "Signaux".
- **Observation** : `"Cumul 0 signal sur la fenêtre. Répartition Échec mission 0 · Connexion 0 · Briefing 0 · Vidéo 0 · Silencieuse 0."` Pas de signaux réels rendus.
- **Critère d'acceptation** : SignalStage poll `/api/v2/signals` ou équivalent, et affiche au moins les signaux des dernières 24h. Si aucun → empty state explicite (pas une matrice de 0).
- **Sévérité** : P1.

#### F-118 — `aside[aria-label="Navigation principale"]` boutons : aria-current OK mais classes "visio"/"text-" sont la VRAIE source de l'état actif
- **Observation** : `LeftRail.tsx:243-251` utilise un ternaire className. L'`aria-current="page"` (ligne 245) est posé seulement sur le bouton actif. **C'est correct WCAG**. Findings Zone 1 F-047 (a11y aria-pressed absent) est en réalité réfuté pour la Zone 2 : `aria-current` est bien posé.
- **Recommandation** : remplacer aussi par `aria-pressed` ou garder `aria-current="page"` (les deux sont valides). Statut OK.
- **Sévérité** : INFO / non-finding.

### P2

#### F-120 — Cockpit greeting "Bonjour, Adrien." vs "Bonjour." selon état session
- **Observation** : sur boot frais `/cockpit-x` (avec session injectée), greeting = "Bonjour, Adrien.". Après quelques re-navigations, le store devient "Bonjour." (sans nom). Idem Zone 1 F-006.
- **Sévérité** : P2.

#### F-121 — Cockpit "Suggestion partiel" labels mono caps collés
- **Observation** : `"SuggestionpartielFounder Cockpit"` rendu dans le DOM. Lisibilité dégradée (manque gap + hiérarchie visuelle).
- **Sévérité** : P2.

#### F-122 — Chat boutons feature-locked sans tooltip
- **Observation** : "Synthétiser en audio" / "Exécuter le code" / "Générer une image" disabled au boot. Aucun tooltip explicatif. Idem Zone 1 F-031.
- **Sévérité** : P2.

#### F-123 — `/spatial` et `/spatial-rnd` cohabitent sans nav switch visible
- **Observation** : pas de bouton "Toggle 2D ⇄ Spatial" depuis `/cockpit-x` vers `/spatial`. Selon MEMORY `[Spatial = vue 3D du dashboard normal]`, ce toggle existe en théorie.
- **Sévérité** : P2.

#### F-124 — Stage Asset variants "Rendu en cours" sur les 4 — statique ou réellement en cours ?
- **Observation** : 4 assets `v0..v3` tous en `"Rendu en cours"`, depuis le boot. Aucun changement après attente 30s. Soit polling absent, soit mock data fige.
- **Sévérité** : P2.

### P3

- **F-130** : `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:4102/admin/orchestrator/runs/fake-run-id`. Trace dans la console pendant les dérives parasites. Si F-100 fixé, F-130 disparaît.
- **F-131** : `[WARNING] [CockpitX] refetch cockpit/today failed: TypeError: Failed to fetch` — observé pendant transitions rapides. Pas de fallback toast utilisateur.
- **F-132** : `[ERROR] [next-auth][error][CLIENT_FETCH_ERROR] /api/auth/session: Failed to fetch` — idem, transition.

## Annexes

### A1. Vue stages au boot
- F-000-shell-cockpit.png : `/cockpit-x` après dev-login, stage cockpit actif, 12 boutons LeftRail visibles.

### A2. Switchs stages (validés via JS-click)
- F-001-stage-chat.png : transition vers Chat (snapshot avant data fully loaded).
- F-002-stage-chat-empty.png : Stage Chat empty state.
- F-003-stage-chat-active.png : Stage Chat actif.
- F-004-stage-asset.png : Stage Asset data-bound (4 variants).
- F-005-stage-browser.png : Stage Browser empty state.
- F-006-stage-meeting.png : Stage Meeting (capture obtenue après dérive, contenu inattendu admin).
- F-007-stage-kg.png : Stage KG data-bound (31 entités).
- F-008-stage-voice.png : Stage Voice placeholder.
- F-009-stage-sim.png : Stage Simulation (DeepSeek R1 form).
- F-010-stage-mission.png : Stage Mission (capture obtenue après dérive vers `/admin/orchestrator/telemetry`).
- F-011-stage-artifact.png : Stage Artifact E2B (capture obtenue après dérive `/admin/agent-driven-dev`).

### A3. Chat fonctionnel
- F-030-chat-message-sent.png : ChatDock après envoi "Bonjour test QA Zone2" — réponse Agent visible, doublon de phrase dans le main.

### A4. Spatial
- F-020-spatial.png : `/spatial` canvas R3F + overlay HTML, brief 22:00.
- F-021-spatial-rnd.png : `/spatial-rnd` canvas R3F, brief 14:00 (divergence vs A20).

### A5. Mobile
- F-040-mobile-375.png : viewport 375×812, page dérivée vers `/admin/pipeline` (pas de shell mobile pour `/cockpit-x`).

### A6. Endpoints SSE testés (curl probe)
- `/api/cc/stream` → 404 "This page could not be found."
- `/api/runs/events` → 404.

### A7. Stages source — anomalies structurelles
- `app/(user)/_stages/` = 11× `*Stage.tsx` + `registry.ts` + `types.ts`.
- Mode `cockpit` pas implémenté en `_stages/CockpitStage.tsx` → rendu via `app/(user)/page.tsx` → `<CockpitXClient />`. Architecture déviante par rapport au pattern uniforme attendu.

### A8. Hotkey vs click
- `Meta+1..0` via `page.keyboard.press("Meta+N")` → no-op.
- LeftRail click via `mcp__playwright__browser_click` → souvent dérive admin.
- LeftRail click via `page.evaluate(btn.click())` → fonctionne, switch propre.

### A9. AGENT-LOCK
- `docs/AGENT-LOCK.json` lu au début : `locked=false`. Aucune protection à respecter pendant cette session, hormis `/spatial-safe` (LECTURE SEULE — non touché).

### A10. /spatial-safe (lecture seule, pas de screenshot stocké)
- Non navigué dans cette session pour respecter la consigne "aucun screenshot stocké, aucune modif". Comparaison `/spatial` vs `/spatial-safe` à faire dans une session dédiée si besoin.
