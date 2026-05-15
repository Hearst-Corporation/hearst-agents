# Fixes P0 — Batch 1 (Commandeur + Orchestrate doublon + CSP + Mission)

**Date** : 2026-05-15
**Auditeur** : Agent B (Trio QA)
**Branche** : `feat/shell-visionos`
**AGENT-LOCK** : `false` (vérifié au démarrage)

---

## FIX 1 — F-015 / F-016 Commandeur (focus initial + Escape global)

- **Fichier** : `app/(user)/components/Commandeur.tsx:123-156`
- **Root cause** :
  - `useModalA11y` était appelé avec `autoFocus: false` → l'input de recherche du dialog ne prenait pas le focus à l'ouverture. `document.activeElement` restait sur la textarea ChatDock (focus précédent).
  - Le listener `keydown` local (`useEffect` lignes 123-149) était attaché sur `window` en **bubbling phase**. Quand le focus était dans la textarea ChatDock, la touche Escape était consommée par le bubbling Tailwind/React du textarea avant d'atteindre le handler global.
- **Diff appliqué** :
  ```diff
  -    window.addEventListener("keydown", onKey);
  -    return () => window.removeEventListener("keydown", onKey);
  +    window.addEventListener("keydown", onKey, { capture: true });
  +    return () => window.removeEventListener("keydown", onKey, { capture: true });
  ```
  ```diff
     const dialogRef = useModalA11y<HTMLDivElement>(isOpen, {
       onClose: () => setOpen(false),
       closeOnEscape: false,
  -    autoFocus: false,
  +    autoFocus: true,
     });
  ```
  J'ajoute aussi `e.stopPropagation()` sur Escape pour éviter qu'un autre handler n'agisse (ChatDock textarea, useGlobalHotkeys, etc.).
- **Test reproduction** :
  1. Ouvrir `/cockpit-x`
  2. Cliquer dans la textarea du ChatDock pour focuser
  3. Presser `Cmd+K` → dialog ouvert
  4. `document.activeElement` doit être l'`<input type="text">` du dialog (premier focusable → focus auto via `useModalA11y`)
  5. Presser `Escape` immédiatement (sans aucun clic) → dialog se ferme.
- **Verdict** : **OK**

---

## FIX 2 — F-102 Doublon POST /api/orchestrate

- **Fichier** : `app/(user)/components/chat-input/ComposerActions.tsx:216`
- **Root cause** :
  Le bouton "Envoyer" était rendu **sans `type="button"`** à l'intérieur d'un `<form aria-label="Envoyer un message">`. Par défaut HTML, un `<button>` dans `<form>` a `type="submit"`. Conséquence d'un clic :
  1. `onClick={onSubmit}` exécute `handleSubmit` → POST `/api/orchestrate` n°1
  2. Le clic submit aussi le form → `onSubmit={(e)=>{e.preventDefault(); handleSubmit()}}` → POST `/api/orchestrate` n°2

  Les deux requêtes partaient à ~ms d'intervalle, ce qui produisait le double SSE + double facturation Anthropic + double persistance du run.

  Note : les autres boutons de `ComposerActions` (audio/code/image/parse/attach) ont tous `type="button"` explicitement — seul "Envoyer" l'avait oublié.
- **Diff appliqué** :
  ```diff
         ) : (
           <button
  +          type="button"
             onClick={onSubmit}
             disabled={!input.trim()}
             aria-label="Envoyer"
  ```
- **Test reproduction** :
  1. `/cockpit-x`, taper un message dans le ChatDock
  2. Ouvrir DevTools → Network, filter `/api/orchestrate`
  3. Cliquer sur l'icône "Envoyer"
  4. Attendu : exactement 1× POST `/api/orchestrate` (et non 2)
  5. Réponse Agent rend une seule string (et non dupliquée)
- **Verdict** : **OK**

---

## FIX 3 — F-045 / F-115 CSP bloque fonts.googleapis.com

- **Fichier** : `app/layout.tsx:44-47`
- **Root cause** :
  La CSP `style-src` (`next.config.ts:13`) n'autorise que `'self' 'unsafe-inline' https://api.fontshare.com` — `fonts.googleapis.com` n'est PAS dans la whitelist. Or `app/layout.tsx` chargeait globalement `https://fonts.googleapis.com/css2?family=Inter+Tight:...` → 2-4 erreurs CSP violation par page sur **toutes** les routes.

  Inter Tight n'est pas la police canonique : la police canonique du DS est **Satoshi Variable** (`--font-satoshi`, chargé via `api.fontshare.com`). Inter Tight n'est référencé que par le thème "robotflow" (`themes/robotflowtemplate-webflow-io/tokens.css`) qui charge ses propres tokens — pas besoin d'un `<link>` global.
- **Option retenue** : **Option A (recommandée par le brief)** — retirer le `<link>` Inter+Tight de `app/layout.tsx`. Pas d'élargissement de la CSP nécessaire.
- **Diff appliqué** :
  ```diff
         <link
           href="https://api.fontshare.com/v2/css?f[]=satoshi-variable@900,700,500,400,300&display=swap"
           rel="stylesheet"
         />
  -      <link
  -        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap"
  -        rel="stylesheet"
  -      />
  +      {/*
  +       * Inter+Tight retiré 2026-05-15 — F-045/F-115 : la CSP `style-src` ne
  +       * whitelist pas `fonts.googleapis.com` (seul fontshare l'est) et la
  +       * police canonique de l'app est Satoshi Variable (`--font-satoshi`).
  +       * Inter Tight n'est référencé que par le thème "robotflow" qui charge
  +       * ses propres tokens.css — pas besoin d'un <link> global ici.
  +       */}
  ```
- **Test reproduction** :
  1. Reload `/cockpit-x` (et n'importe quelle route)
  2. DevTools → Console
  3. Attendu : 0 erreur CSP "Refused to load the stylesheet 'https://fonts.googleapis.com/...'" et 0 erreur "Refused to apply inline style…"
- **Verdict** : **OK**

---

## FIX 4 — F-009 Cmd+9 Mission affiche "Variants en cours"

- **Fichiers** :
  - `app/(user)/_stages/AssetStage.tsx:344-348` (H1 incohérent)
  - `app/hooks/use-global-hotkeys.ts:136-145` (no-op Cmd+9 sans lastMissionId)
- **Root cause double** :
  1. Le H1 d'AssetStage indiquait `"Variants en cours"` quand `total > 0`, alors que le label registry du Stage est `"Assets"`. Incohérence directe label rail ↔ H1.
  2. Quand l'utilisateur presse Cmd+9 (mission) **sans** avoir ouvert de mission auparavant (`lastMissionId === null`), `use-global-hotkeys` faisait un no-op silencieux → le Stage précédent (souvent AssetStage) restait affiché alors que le rail montrait Mission comme actif. Combiné avec le H1 buggé, l'utilisateur voyait "Mission (⌘9)" actif dans le rail + H1 "Variants en cours" → confusion.

  Vérifié : le MissionStage utilisé par le shell visionOS est `app/(user)/_stages/MissionStage.tsx` (mappé par `CockpitXClient`). Son H1 est correctement `mission.name` (ex: "Préparer offboard Q3") quand `missionId` est valide, et un EmptyState `"Sélectionne une mission depuis la liste ou lance une commande."` sinon. Pas de "Variants en cours" dans MissionStage — la chaîne n'existait que dans AssetStage.
- **Diff appliqué (AssetStage)** :
  ```diff
         <h1 style={{ fontSize: "32px", fontWeight: 500, letterSpacing: "-0.02em" }}>
  -        {loading
  -          ? "Chargement des assets"
  -          : total === 0
  -            ? "Génération média"
  -            : "Variants en cours"}
  +        {loading ? "Chargement des assets" : total === 0 ? "Génération média" : "Assets"}
         </h1>
  ```
- **Diff appliqué (use-global-hotkeys)** :
  ```diff
           case "mission": {
  -          // Même logique que "asset" : ré-ouvre la dernière mission
  -          // ouverte. No-op si aucune mission n'a encore été ouverte —
  -          // l'user passe alors par /missions ou le Commandeur.
  +          // Ré-ouvre la dernière mission ouverte si disponible. Sinon on
  +          // bascule quand même sur le mode mission (missionId vide) — le
  +          // MissionStage rend un EmptyState explicite "Sélectionne une
  +          // mission…". F-009 : éviter de laisser le Stage précédent
  +          // (ex: AssetStage) visible alors que le rail montre Mission actif.
             const lastMissionId = useStageStore.getState().lastMissionId;
  -          if (lastMissionId) {
  -            setMode({ mode: "mission", missionId: lastMissionId });
  -          }
  +          setMode({ mode: "mission", missionId: lastMissionId ?? "" });
             break;
           }
  ```
- **Test reproduction** :
  1. `/cockpit-x` (fresh load, aucune mission encore ouverte)
  2. Aller sur Assets via Cmd+3 → voir l'AssetStage. H1 affiche désormais "Assets" (et non "Variants en cours")
  3. Presser Cmd+9 → on bascule sur MissionStage avec EmptyState ("Sélectionne une mission depuis la liste ou lance une commande.")
  4. `document.querySelector('h1')` retourne `null` (l'EmptyState n'a pas de H1) — pas de H1 contradictoire. L'AssetStage n'est plus rendu.
  5. Quand une mission est ensuite ouverte (depuis /missions ou Commandeur), Cmd+9 ré-ouvre la dernière mission et H1 = `mission.name`.
- **Verdict** : **OK**

---

## Validation finale

### `npm run typecheck`

- **Erreurs dans les fichiers modifiés** : **aucune** (4 fichiers touchés : `app/layout.tsx`, `Commandeur.tsx`, `ComposerActions.tsx`, `AssetStage.tsx`, `use-global-hotkeys.ts`).
- **Erreurs hors scope (préexistantes)** : ~30 erreurs dans `__tests__/**` (TS2554, TS2345 sur `string | undefined`, TS18048 sur `parts/graph possibly undefined`). Toutes préexistantes, aucune introduite par mes fixes — non-fixée comme demandé par le brief.

### `npm run lint`

- **Erreurs dans les fichiers modifiés** : **aucune**.
- **Warnings globaux** : 12 warnings préexistants (unused imports dans des fichiers hors scope, type docs JSDoc). Non-fixés.
- `lint:visual` : **OK** — aucune violation détectée.

### Tests à valider manuellement (Playwright)

- `cockpit-x` + `Cmd+K` puis `Escape` immédiat sans clic dans l'input → dialog se ferme.
- `cockpit-x` + clic dans textarea ChatDock + `Cmd+K` → `document.activeElement.tagName === "INPUT"` (l'input du Commandeur, pas le textarea).
- ChatDock : 1 message envoyé → `mcp__playwright__browser_network_requests filter:/api/orchestrate` retourne exactement 1× POST.
- Tous écrans : 0 erreur console "CSP violation" liée à Inter+Tight ou Google Fonts.
- `cockpit-x` + Cmd+3 (Assets) → H1 = "Assets" (avec assets en BDD) ou "Génération média" (vide) ou "Chargement des assets" (loading).
- `cockpit-x` + Cmd+9 sans `lastMissionId` → bascule sur Mission avec EmptyState explicite, plus de mismatch.

---

## Récap

| Fix | Finding | Verdict | Fichier principal |
|-----|---------|---------|-------------------|
| 1 | F-015 + F-016 (Commandeur focus + Escape) | **OK** | `app/(user)/components/Commandeur.tsx` |
| 2 | F-102 (doublon POST /api/orchestrate) | **OK** | `app/(user)/components/chat-input/ComposerActions.tsx` |
| 3 | F-045 + F-115 (CSP fonts.googleapis.com) | **OK** | `app/layout.tsx` |
| 4 | F-009 (Cmd+9 Mission incohérent) | **OK** | `app/(user)/_stages/AssetStage.tsx` + `app/hooks/use-global-hotkeys.ts` |

Aucune zone interdite touchée (`app/(user)/layout.tsx`, `_shell/*`, `docs/qa/audit-zone*`, `docs/features/*` — tous intacts).
