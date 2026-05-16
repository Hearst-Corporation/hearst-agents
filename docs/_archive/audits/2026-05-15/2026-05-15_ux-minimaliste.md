# Audit UX minimaliste — 2026-05-15

> Angle : interactions, feedback, microcopy. Cible "AI Command Line to Dashboard" — clavier-first, agent invoque les surfaces, sélection select-then-act, microcopy FR sobre.
> Périmètre : Commandeur (Cmd+K), ChatDock, Stage + switch de mode, useSelectionStore, TimelineRail, ContextRail, StageFooter, PulseBar.
> Lecture du verrou : `docs/AGENT-LOCK.json` → `locked: false`. Audit only — aucune modification de code.

---

## État des lieux (≤ 5 lignes)

La grammaire d'interaction est bien posée : Cmd+K central, ⌘1-9 mappent les Stages, le ChatDock pousse `setModeFromTool` avec garde anti-téléportation, `useSelectionStore` existe pour le select-then-act. Le moteur est là. Ce qui manque : (1) Escape ne sort jamais d'un Stage (pas de réversibilité naturelle), (2) le composer n'expose aucun bouton Stop visible en saisie (le `stopRun` vit dans le StageFooter en pied d'écran), (3) plusieurs labels système clés (`StageFooter`, thread "New", `aria-label="Close"`) restent en anglais en violation du CLAUDE.md, (4) le Commandeur ne sait pas dégénérer en "envoie cette intention à Hearst" quand 0 résultat, (5) la sélection (`useSelectionStore`) n'a aucun feedback visuel central ni raccourci de déselection. Conséquence : la promesse "clavier-first sobre" tient en démo, mais friction permanente en usage réel.

---

## Findings prioritaires

### F1. `[P0] [S]` StageFooter parle anglais alors que voix régulière FR obligatoire

`app/(user)/components/StageFooter.tsx:17-25`

`STATE_MAP` envoie `"Online" / "Connecting" / "Running" / "Processing" / "Approval required" / "Clarification required" / "Error"` dans le `aria-live="polite"` qui pendule sous le Stage. Le pivot 2026-05-01 a chassé les mono caps anglais de la PulseBar (cf. commentaire ligne 248 de `PulseBar.tsx` : "on retire les labels mono caps tracking-marquee (RUN_ACTIVE / VOICE_ON…)") mais le StageFooter a été oublié — il diffuse encore "Running" lu par les screen readers, casse le contrat "Français pour tout" du CLAUDE.md et fait dissonance avec le badge "En cours" déjà traduit dans PulseBar:259.

Proposition : mapper en voix régulière FR. `{ idle: "En ligne", connecting: "Connexion…", streaming: "En cours", processing: "Traitement", awaiting_approval: "Validation demandée", awaiting_clarification: "Précision demandée", error: "En échec" }`. Pas de point virgule "Réinitialiser" — garder "Reprendre" pour rester actionnable.

### F2. `[P0] [M]` Escape ne sort d'aucun Stage — pas de réversibilité

`app/hooks/use-global-hotkeys.ts:76` (Escape n'agit que pour Focus Mode), `stores/stage.ts:146-151` (back existe mais n'est appelé QUE par ⌘⌫)

Le pivot 2026-04-29 a posé que le switch Stage doit être "explicite, prévisible, réversible". Aujourd'hui : pour quitter un AssetStage ou un MissionStage il faut connaître ⌘1 ou ⌘⌫. Ni discoverable ni naturel. Le seul Escape pris en charge est celui du Mode Focus. Conséquence : les utilisateurs cliquent dans le menu de gauche ou rechargent — friction documentée par toute UI clavier-first (Linear, Raycast, Notion : tous traitent Esc comme "remonte d'un niveau").

Proposition : étendre le handler ligne 76 — `if (e.key === "Escape" && useStageStore.getState().current.mode !== "cockpit" && !commandeurOpen && !focusMode.enabled) → useStageStore.back()`. Si l'historique est vide, fallback vers `{ mode: "cockpit" }`. Garde-fou : skip si focus dans input/textarea (déjà vérifié par `isInInput`).

### F3. `[P0] [S]` Composer en cours d'exécution : pas de bouton Stop visible

`app/(user)/components/chat-input/ComposerActions.tsx:215-218`

Quand `isRunning` est true, le bouton "Envoyer" est remplacé par un spinner pur — aucune affordance de Stop dans le composer. Le bouton "Arrêter" existe mais vit dans le `StageFooter` (StageFooter.tsx:79-88), tout en bas de l'écran, sous les 3 colonnes, hors du focal de l'utilisateur qui regarde le streaming dans la zone Stage. Conséquence : les gens attendent un run ratée ou recharge la page — coût LLM perdu malgré l'abort endpoint existant (`/api/orchestrate/abort/{runId}`).

Proposition : remplacer le `<div>` spinner ligne 215 par un `<button onClick={() => useRuntimeStore.getState().stopRun()} title="Arrêter (Échap)" aria-label="Arrêter la génération">` avec icône carré-plein. Brancher Escape sur l'input pour appeler le même `stopRun` quand le composer a le focus et `isRunning`. Coût : ~15 lignes.

### F4. `[P1] [S]` Commandeur 0 résultat = cul-de-sac, pas de fallback vers l'agent

`app/(user)/components/Commandeur.tsx:203-204`

Quand la query ne matche rien, on affiche `"Aucun résultat."` en `text-text-ghost`. Cul-de-sac : l'utilisateur a une intention, le Commandeur la rejette. Le pivot "agent orchestrateur" dit l'inverse — si le système ne sait pas, il devrait proposer "Demander à Hearst : « {query} »" en row primary qui injecte la query dans le ChatDock via `chat:set-input` (event déjà câblé dans `useChatComposer.ts:23`).

Proposition : remplacer le `<p>Aucun résultat</p>` par une `CommandeurResultRow` synthétique `kind="action"`, label `Demander à Hearst : "{query}"`, hint `Envoie ta question directement au chat`, perform = `window.dispatchEvent(new CustomEvent("chat:set-input", { detail: { value: query } })); setStageMode({ mode: "chat" }); setOpen(false);`. Active par défaut. Plus de cul-de-sac.

### F5. `[P1] [S]` Aucune cheatsheet hotkey — discoverability nulle

Recherche `Voir les hotkeys|aide-raccourci|cheatsheet` → 0 hit dans le repo

Le système publie 14 hotkeys (⌘K, ⌘1-9, ⌘0, ⌘B, ⌘G, ⌘⇧V, ⌘⇧F, ⌘⌫, Esc en Focus). Seules ⌘K et ⌘1-9 apparaissent en hint dans le Commandeur (use-commandeur-actions.ts:141-214). ⌘B / ⌘G / ⌘⇧V / ⌘⇧F / ⌘⌫ ne sont jamais affichées hors title attribute (PulseBar.tsx:366,376). Conséquence : pour un app clavier-first, on cache 60% des hotkeys.

Proposition : ajouter une action Commandeur `id: "show-hotkeys"`, label `"Tous les raccourcis"`, hotkey `"?"`. Render un sub-mode du Commandeur (ou un Stage `kg`-like) listant la grille hotkey → action → état. ETA 30min en utilisant `CommandeurResultRow` existant.

### F6. `[P1] [S]` `useSelectionStore` n'a aucun feedback central ni `clear()` exposé

`stores/selection.ts:37-41` + 12 usages dans `app/`

La sélection est posée par 7 surfaces (`SourceCitation`, `ChatAssetCard`, `AssetCompareStage`, `AssetMeta`, `missions/page.tsx`, `assets/page.tsx`) mais : (a) aucun pixel ne signale visuellement à l'utilisateur qu'une sélection est active dans le Cockpit (le ContextRail lit le store mais c'est tout), (b) il n'y a aucun raccourci ni bouton pour `clear()`, (c) Escape ne déselectionne pas. Conséquence : on ne sait pas qu'on est "sélectionné", on ne sait pas comment se "désélectionner" — friction du pattern select-then-act qui devient invisible.

Proposition : (1) F2 étendu — quand on est en `mode: "cockpit"` et qu'une selection est active, Escape appelle `clear()` avant de tenter back(). (2) Ajouter une SelectionChip flottante (en haut du Stage cockpit, comme `FocusBadge`) qui montre "Sélectionné : {label} · Esc pour annuler". 20 lignes calquées sur FocusBadge.tsx.

### F7. `[P1] [M]` Toast d'échec orchestrate sans bouton Retry

`app/(user)/components/ChatDock.tsx:227, 287`

`toast.error("Échec de l'envoi", "Erreur serveur: 500")` n'a pas d'action Retry. Le système toast lui-même n'a pas d'API `action` (cf. `use-toast.ts:14-18` — interface ToastItem ne porte que id/type/title/message). Conséquence : l'utilisateur doit retaper son message dans le composer (souvent perdu — `setInput("")` ligne 125 de ChatInput vidé optimistically AVANT la confirmation serveur). Double friction : message perdu + retry manuel.

Proposition : (1) étendre `ToastItem` avec `{ action?: { label: string; onAction: () => void } }`. (2) Dans ChatDock.tsx:227 et :287, passer `{ action: { label: "Réessayer", onAction: () => handleSubmit(message, opts) } }`. (3) Bonus : ne vider l'input qu'après réception du `run_started` event canonique (déplacer `setInput("")` de ChatInput.tsx:125 vers une callback `onAccepted`).

### F8. `[P1] [S]` Commandeur sans `scrollIntoView` sur la row active

`app/(user)/components/Commandeur.tsx:126-140` (handler ArrowDown/Up)

L'index actif change mais la liste (`max-h-[60vh] overflow-y-auto` ligne 202) ne scrolle pas vers la row active. Quand l'utilisateur descend dans une liste filtrée longue (~25 actions hardcoded + résultats search), la row sélectionnée sort de viewport et il navigue à l'aveugle.

Proposition : passer un `ref` aux `CommandeurResultRow` (ou data-attribute `data-cmd-row-index`), et dans le handler keydown ligne 130, après `setActiveIndex` appeler `requestAnimationFrame(() => document.querySelector(`[data-cmd-row-index="${nextIndex}"]`)?.scrollIntoView({ block: "nearest" }))`. 8 lignes.

### F9. `[P2] [S]` Thread créé en anglais : `addThread("New", surface)`

`app/(user)/components/ChatDock.tsx:163`, `WelcomePanel.tsx:23`, `timeline-rail/TimelineRail.tsx:115`

Le nom temporaire `"New"` reste visible dans la TimelineRail entre la création du thread et l'arrivée du premier message (latence orchestrate ~1-2s). Sur un app FR pure ça crève l'œil. L'invariant ADD I-9 du timeline-rail spec mentionne `addThread("New", "home")` mais c'est un identifiant interne, pas un label visible — la valeur peut être changée sans rompre l'invariant tant que la signature reste.

Proposition : remplacer les 3 occurrences par `addThread("Nouvelle conversation", surface)`. Truncation auto dans `ThreadRow` gère déjà la longueur.

### F10. `[P2] [S]` `ContextRailShell` aria-label en anglais + texte "Context" non traduit

`app/(user)/components/context-rail/ContextRailShell.tsx:38, 41`

`<p>Context</p>` et `aria-label="Close"` dans le seul code de l'app — visible uniquement en drawer mobile mais c'est la dernière surface en anglais qui fait tâche. Détectable au seul grep `aria-label="Close"`, 1 unique occurrence.

Proposition : `Context` → `Contexte`, `aria-label="Close"` → `aria-label="Fermer"`.

---

## 3 quick wins < 1h

1. **Microcopy sweep** : F1 (StageFooter STATE_MAP en FR) + F9 ("Nouvelle conversation" × 3) + F10 (ContextRailShell). 3 fichiers, ~20 lignes, 15 min, zéro risque (test e2e ne match aucun de ces strings).
2. **Stop button dans le composer** : F3. Remplacer le spinner ligne 215 de `ComposerActions.tsx` par un button qui appelle `useRuntimeStore.getState().stopRun()`. 15 lignes, 20 min. Gain immédiat : crédits LLM économisés à chaque abort, sans aller chercher le StageFooter.
3. **Commandeur fallback "Demander à Hearst"** : F4. Une row synthétique injectée quand `sections.length === 0`. 12 lignes, 15 min. Plus de cul-de-sac, plus le bon réflexe orchestrateur.

---

## 2 paris structurants > 1 jour

### P1. Esc-as-back universel + SelectionChip flottante (F2 + F6)

Réécrire la sémantique Escape comme "remonte d'un niveau" à travers toute la couche cockpit. Concrètement :

- Étendre `use-global-hotkeys.ts:76` pour cascader : (a) si modale ouverte → fermée par useModalA11y déjà ; (b) sinon si `commandeurOpen` → close ; (c) sinon si `useSelectionStore.current` → clear() ; (d) sinon si `useStageStore.current.mode !== "cockpit"` → back() ou setMode cockpit.
- Ajouter `SelectionChip.tsx` (60 lignes max, calqué sur `FocusBadge.tsx`) — pin flottant top-left avec label de la sélection et `· Esc`.
- Bonus : multi-select. Étendre `selection.ts` avec `selectMany(sels: Selection[])` et `toggle(sel)`. Permettre Shift+Click dans `/assets/page.tsx` et `/missions/page.tsx`, puis "Comparer 2 assets" (action Commandeur déjà existante) consomme la sélection au lieu d'ouvrir un modal de picker.

Effort : 1-1,5 jour. ROI : la grammaire d'interaction devient enfin lisible — un seul Esc remonte, une chip rappelle ce qui est sélectionné, plus de cul-de-sac, plus de pixel inutile à l'écran.

### P2. Toast → Action API + retry safe-state pour les runs orchestrate (F7)

Refondre légèrement le toast manager pour porter une action optionnelle, puis câbler "Réessayer" sur les erreurs orchestrate / mission / connection. En parallèle, faire passer `ChatInput.handleSubmit` en deux temps :

1. Envoyer + garder le message en buffer pendant la phase `connecting/streaming`
2. Vider l'input uniquement à réception de l'event `run_started` (preuve serveur)

Conséquence : on n'efface plus jamais un message qui n'a pas été reçu, et un échec réseau garde le message + propose Retry en un tap. Aligné direct sur la promesse "Feedback temps réel : ce qui échoue propose une issue".

Effort : 1 jour (3 endpoints toast à toucher, un test e2e à mettre à jour). ROI : zéro perte d'input utilisateur, retry inline, pattern réutilisable partout.

---

## Diff microcopy avant/après

| Lieu | Avant | Après |
| --- | --- | --- |
| `StageFooter.tsx:18` (label idle) | `Online` | `En ligne` |
| `StageFooter.tsx:21` (label streaming) | `Running` | `En cours` |
| `StageFooter.tsx:22` (label awaiting_approval) | `Approval required` | `Validation demandée` |
| `StageFooter.tsx:23` (awaiting_clarification) | `Clarification required` | `Précision demandée` |
| `StageFooter.tsx:24` (error label + tone) | `Error` | `En échec` |
| `StageFooter.tsx:53` (action en error) | `Réinitialiser` | `Reprendre` |
| `ChatDock.tsx:163` + `WelcomePanel.tsx:23` + `TimelineRail.tsx:115` (thread name) | `New` | `Nouvelle conversation` |
| `Commandeur.tsx:192` (input placeholder) | `Rechercher...` | `Que veux-tu faire ?` |
| `Commandeur.tsx:204` (empty state) | `Aucun résultat.` | `Rien ne match. Demande à Hearst : « {query} »` (devient une row actionnable) |
| `Commandeur.tsx:197` (loading indicator) | `Recherche…` | `Hearst regarde…` |
| `ContextRailShell.tsx:38` (drawer label) | `Context` | `Contexte` |
| `ContextRailShell.tsx:41` (aria-label close) | `Close` | `Fermer` |
| `PulseBar.tsx:218` (CTA Commandeur) | `Demande à Hearst…` | (conserver — bon, mais ajouter hint hotkey adjacent — déjà fait ligne 229) |
| `ComposerActions.tsx:220-229` (label send) | `Envoyer` (title + aria) | `Envoyer · ↵` (incorporer hotkey discoverable) |
| `ChatDock.tsx:227` (toast échec) | `"Échec de l'envoi" + "Erreur serveur: 500"` | `"Hearst n'a pas pu répondre" + "Code {status}. Réessayer ?"` + action button |
| `ChatDock.tsx:287` (toast réseau) | `"Erreur de connexion" + errorMsg` | `"Réseau indisponible" + "Vérifie ta connexion puis réessaie"` + action button |
| `TimelineRail.tsx:91-94` (toasts archive) | `"Conversation archivée" + "Retrouve-la dans Archive (⌘K → « Voir l'archive »)"` | OK tel quel (exemple à imiter ailleurs) |

---

## Annexe — preuves rapides

- Verrou ADD : `docs/AGENT-LOCK.json` → `locked: false` (lecture seule respectée par cet audit).
- Aucun fichier modifié : seul ce rapport `.md` est ajouté.
- `/spatial-safe` non touché (zone read-only absolue).
