# LLM Project Map — Hearst OS

> **Ce fichier est la source de vérité pour tout agent IA travaillant sur ce codebase.**
> Lis-le AVANT de créer un fichier, déplacer un fichier, ou ajouter un composant/hook/provider.
> Il décrit la structure **réelle** du projet (convention de colocation Next.js App Router),
> pas une structure générique idéale. Ne réorganise pas vers `components/ui|features|layout` :
> ce projet n'utilise pas ce schéma, et un déménagement massif est explicitement proscrit.

Dernière mise à jour : 2026-05-22 (passe de nettoyage : suppression code mort + doc anti-rechute).

---

## Golden rules (à appliquer sans exception)

1. **Cherche avant de créer.** Avant tout nouveau composant/hook/util, `grep` le nom et le rôle. Si une primitive existe, utilise-la.
2. **Un seul chat.** Le chat actif est `app/(user)/_shell/RightRailChat.tsx`. Ne recrée pas de `ChatDock` / `ChatInput` (supprimés, voir « Patterns supprimés »).
3. **Une seule barre de navigation.** Mobile = `app/(user)/components/MobileBottomNav.tsx`. Rail gauche = `app/(user)/_shell/LeftRail.tsx`. Ne recrée pas `BottomBar` / `HubBar` / `PulseBar` (supprimés).
4. **Une seule primitive par rôle UI.** Bouton = `<Action>`. Bouton icône = `<IconButton>`. Carte/surface = `<PanelCard>`. Modale = focus trap via `useModalA11y` + scrim. Ne duplique pas.
5. **Pas de composant « au cas où ».** Si ce n'est pas monté dans un arbre de rendu atteignable, ça n'existe pas — ne le crée pas, ne le garde pas.
6. **Pas de provider non monté.** Les seuls providers React montés sont `<SessionProvider>` et `<CockpitShell>` (dans `app/(user)/layout.tsx`). N'ajoute un provider que s'il est monté dans un layout.
7. **Vérifie l'usage avant d'éditer.** `grep` les imports réels. Méfie-toi des barrels `index.ts` (un export peut sembler inutilisé mais transiter par le barrel).
8. **Respecte les zones verrouillées** (voir plus bas) : `spatial-safe/`, features ADD verrouillées.
9. **Lance `npm run validate`** (typecheck + lint + test) avant de proposer un patch.

---

## Responsabilités des dossiers (structure réelle)

### `app/` — routes Next.js App Router + code colocalisé
Le projet **colocalise** le code près de ses routes. Trois segments :

- **`app/(user)/`** — l'app utilisateur authentifiée (le cockpit). Contient :
  - `_shell/` — le shell de rendu : `Shell.tsx`, `LeftRail.tsx`, `RightRailChat.tsx`, `KpiGrid.tsx`, `PageLayout.tsx`, `HubBar`/`BottomBar` supprimés. **C'est ici que vit le layout cockpit.**
  - `_stages/` — les 12 « stages » (vues plein-écran : cockpit, chat, asset, browser, meeting, kg, voice, simulation, mission, artifact…). Pilotés par `_stages/registry.ts` et `stores/stage.ts`.
  - `components/` — composants métier du segment user. Sous-dossiers par domaine (`connections/`, `reports/`, `marketplace/`, `settings/`, `voice/`, `kg/`, `browser/`, `artifact/`…).
  - `components/ui/` — **design system primitif canonique** (voir liste ci-dessous). C'est LA source de vérité des primitives. Import : `@/app/(user)/components/ui`.
  - `lib/` — helpers spécifiques au segment user (`cockpit-entry.ts`, `sanitize-error.ts`).
  - `hooks/` *(legacy, peut contenir `useModalA11y`)* — préférer `app/hooks/` pour les nouveaux hooks transversaux.
- **`app/admin/`** — back-office (gouvernance ADD, agents, métriques, runs, thèmes…). Composants admin dans `app/admin/_components/`.
- **`app/api/`** — route handlers (REST + SSE). Namespaces : `orchestrate` (run live), `orchestrator` (mesh HOM), `v2`, `webhooks`, `cron`, etc.
- **`app/(public)` / `app/public/`, `app/login/`, `app/hearst-card/`** — routes non authentifiées.

### `components/` (racine)
**Contient uniquement `spatial-safe/`** (couche 3D/WebGL Spline, route `/spatial-safe`). 🔒 **Lecture seule absolue** (voir CLAUDE.md). Ne rien y modifier.

### `app/components/system/`
Composants shell montés dans le **layout racine** (`app/layout.tsx`) : `ThemeHydrator`, `NoiseLayer`. (`ToastHost` vit dans `components/ui/`.) Ne pas y ajouter de composant feature.

### `hooks/` (racine) + `app/hooks/`
- `app/hooks/` — **hooks transversaux app-level** (source de vérité) : `use-toast`, `use-global-hotkeys`, `use-oauth-completion-poll`, `use-oauth-expiry`.
- `hooks/` (racine) — résiduel : `usePoll` + `hooks/spatial-safe/` (🔒). Préférer `app/hooks/` pour tout nouveau hook réutilisable.
- Hook **spécifique à une seule feature** → colocalise-le À CÔTÉ de son composant (ex. `use-commandeur-*` vivent près de `Commandeur.tsx`), ne le mets pas dans `app/hooks/`.

### `lib/` (racine) — logique métier serveur/pure (gros module)
LLM (`lib/llm/`), engine d'orchestration (`lib/engine/`), connecteurs (`lib/connectors/`, `lib/capabilities/`), plateforme (`lib/platform/`), domaine (`lib/domain/`), UI-helpers non-React (`lib/ui/`), etc. Pas de React ici (sauf helpers de rendu purs).
- ⚠️ **« provider » est surchargé** : `lib/providers/` = IDs OAuth/connector métier ; `lib/capabilities/providers/` = clients HTTP d'API externes ; `providers/spatial-safe/` = React Context (🔒). Trois sens différents — vérifie le contexte.

### `stores/` — Zustand (état client global)
16 stores : `stage`, `stage-data`, `chat-stage`, `chat-context`, `focal`, `focus-mode`, `navigation`, `notifications`, `oauth`, `reports`, `runtime`, `selection`, `services`, `voice`, `working-document`. Source de vérité de l'état UI.

### `providers/` (racine)
Uniquement `providers/spatial-safe/` (🔒). Aucun provider global hors spatial ici.

### `docs/` — documentation projet + agents
`AGENT-DRIVEN-DEV.md` (protocole ADD), `AGENT-LOCK.json` (verrou), `features/*.md` (specs verrouillées), ce fichier.

---

## Primitives UI canoniques (`app/(user)/components/ui/`)

`Action` · `IconButton` · `PanelCard` · `EmptyState` · `FilterTabs` · `FormField` (`FormInput`/`FormTextarea`) · `ScreenShell` · `SearchField` · `SectionEyebrow` · `SectionHeader` · `Skeleton` (`CardSkeleton`/`RowSkeleton`) · `StageErrorBanner` · `ToastHost` · `ValidatedForm` (`FieldError`/`fieldA11yProps`).

**Avant de styler un `<button>`/`<div>` à la main, vérifie si une de ces primitives couvre le besoin.**
Accessibilité des modales : `useModalA11y` (focus trap + ESC + restore focus).

---

## Avant de créer un fichier — checklist

Cherche d'abord :
- même nom de composant (`grep -rn "MonComposant"`)
- même rôle visuel (bouton ? carte ? modale ? barre ?)
- primitive existante dans `components/ui/`
- hook existant dans `app/hooks/` ou colocalisé
- provider existant (presque toujours non — n'en ajoute pas)

Ne crée un nouveau fichier **que si** aucun existant ne porte cette responsabilité.

### Où placer un nouveau fichier
| Type | Emplacement |
|---|---|
| Primitive générique réutilisable | `app/(user)/components/ui/` (+ export dans `index.ts`) |
| Composant métier d'un domaine | `app/(user)/components/<domaine>/` |
| Vue plein-écran (stage) | `app/(user)/_stages/` + enregistrer dans `registry.ts` |
| Élément de shell (rail, barre, layout) | `app/(user)/_shell/` |
| Hook transversal app | `app/hooks/` |
| Hook spécifique à une feature | à côté du composant qui le consomme |
| Logique pure / client API / serveur | `lib/<domaine>/` |
| État global client | `stores/` |
| Route | `app/<segment>/.../page.tsx` ou `route.ts` |

---

## Zones à NE PAS modifier sans raison vérifiée

- 🔒 **`spatial-safe/`** (sous `components/`, `hooks/`, `lib/`, `providers/`, `styles/`, `app/spatial-safe/`) — sauvegarde de référence figée. **Lecture seule absolue** (CLAUDE.md). Ne jamais éditer/supprimer/déplacer.
- 🔒 **Features ADD verrouillées** — vérifie `docs/AGENT-LOCK.json` (`locked`) et `docs/AGENT-DRIVEN-DEV.md` avant d'écrire. Si `locked: true`, refuse toute modif.
- 🔒 **`lab/`** — sandbox Vite isolée, hors lint, hors scope du cockpit. Ne pas importer depuis/vers l'app principale.
- ⚠️ **`lib/database.types.ts`** — généré, ne pas éditer à la main.

---

## Sources de vérité

| Sujet | Source de vérité |
|---|---|
| Chat | `app/(user)/_shell/RightRailChat.tsx` |
| Navigation des stages | `app/(user)/_stages/registry.ts` + `stores/stage.ts` |
| Raccourcis clavier | `app/hooks/use-global-hotkeys.ts` |
| Primitives UI | `app/(user)/components/ui/index.ts` |
| Tokens design (couleurs/espacements/typo) | `app/globals.css` (variables `--ct-*`, classes `.t-N`) + voir `~/.claude/assets/cockpit/SPEC.md` |
| Providers React montés | `app/(user)/layout.tsx` (`SessionProvider`, `CockpitShell`) + `app/layout.tsx` (`ThemeHydrator`, `NoiseLayer`, `ToastHost`) |
| Code mort | `npx knip` (config `knip.json`) — attention aux faux positifs de barrel |

---

## Patterns supprimés (NE PAS recréer)

Passe de nettoyage 2026-05-22 — ~32 fichiers de code mort prouvé supprimés :

- **`ChatDock` + `chat-input/`** (composant chat legacy complet + ses hooks/utils) — jamais monté. Le chat actif est `RightRailChat`. → Ne recrée pas de `ChatInput`/`ChatDock`.
- **`PulseBar` + `NotificationBell` + `SpaceSelector` + `ghost-icons`** — barre jamais montée + sa cascade. → La navigation passe par `LeftRail` / `MobileBottomNav`.
- **`video-quick-launch/` + `VideoQuickLaunch` + `stores/video-quick-launch`** — panel zombie (store + hotkey ⌘G existaient mais le panel n'était jamais rendu). Le raccourci ⌘G a été retiré de `use-global-hotkeys`. La string `origin: "video-quick-launch-batch"` reste dans `app/api/v2/assets/batch` (valeur DB historique, pas un composant).
- **`_shell/BottomBar`, `_shell/HubBar`, `_shell/RightRail`, `_shell/stage-icons`, `components/_shell/StageFooter`** — éléments de shell legacy non montés.
- **`lib/core/types/*`** — ancien barrel de types (`agents`, `assets`, `common`, `runtime`, `focal`, `index`) consommé uniquement par `ChatDock` (mort). Les types vivants sont dans `stores/*` et `lib/<domaine>/`.
- **`lib/ui/format-time.ts` + `lib/utils/date-format.ts`** — deux formateurs de date morts. Pour formater une date : `Intl.DateTimeFormat` ou `lib/connectors/composio/preview-formatters/shared.ts` (`formatDateFR`, interne aux previews).
- **`lib/assets/content-parser.ts`**, **export `RailSection`** — orphelins.
- **`hooks/use-conversation-history.ts`**, **`use-asset-drag`**, **`use-offline-status`** — hooks orphelins.

### Comment éviter de recréer un doublon
Avant d'ajouter un composant « barre », « chat », « modale », « carte » : `grep` la famille, lis ce tableau, et utilise la primitive/le composant canonique. Si tu penses qu'un composant manque, vérifie d'abord qu'il n'a pas été supprimé ici pour cause de mort.

---

## Pièges connus

1. **`run/` redirige vers… non — `runs/` redirige vers `/run`.** `app/(user)/run/` est la route réelle ; `app/(user)/runs/` est un `redirect("/run")`. Édite `/run`, jamais `/runs`.
2. **`admin/runs/` ≠ `admin/orchestrator/runs/`.** Le premier liste les runs Supabase (facturation/tokens) ; le second liste les runs du mesh HOM (release candidates). Noms proches, systèmes différents.
3. **Barrels trompeurs.** Un export listé « unused » par knip peut transiter par un `index.ts`. Vérifie l'usage réel avant de supprimer un export de barrel.
4. **« provider » a 3 sens** (voir `lib/`). Ne confonds pas React context et provider métier OAuth.
5. **Worktrees `.claude/`.** knip peut compter des milliers de faux positifs venant de `.claude/worktrees/` — toujours filtrer ces chemins.

---

## Commandes à lancer avant de proposer un patch

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # biome check + lint-visual (tokens --ct-*)
npm run test        # vitest run
npm run validate    # les trois ci-dessus enchaînés
npx knip            # détection code mort (filtrer .claude/worktrees)
```
