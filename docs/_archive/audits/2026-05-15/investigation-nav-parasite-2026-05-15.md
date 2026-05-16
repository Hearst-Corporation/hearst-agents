# Investigation root cause — Navigation parasite `/cockpit-x` → `/admin/*`

> Investigateur : Claude Opus 4.7 (read-only).
> Date : 2026-05-15.
> Inputs : QA Zone 1 (F-036), Zone 2 (F-100 + F-116), Zone 3 (P0-001).

## TL;DR

- **Cause identifiée (forte présomption, non 100% certaine sans repro live)** : **artefact Playwright MCP** — la combinaison `mcp__playwright__browser_snapshot` / `browser_evaluate` / `browser_click` physique réalise un sweep de focus sur les `<Link>` survolés pendant le déplacement du curseur. Aucun fichier rendu sur `/cockpit-x` ne contient `router.push("/admin/…")` ni `<Link href="/admin/…">`. La cible **`/admin/*` n'est référencée nulle part dans le code rendu sur `/cockpit-x`**. La dérive est observable uniquement sous instrumentation Playwright (jamais reproduite par Adrien hors test).
- **Fichiers en cause (potentiels)** :
  - `app/(user)/components/use-commandeur-actions.ts:152` — seul `router.push("/admin")` du sous-arbre utilisateur, atteignable uniquement via Cmd+K + sélection « Console admin ». Sa découverte par Playwright (focus + Enter implicite) reste l'hypothèse la plus crédible côté code-base.
  - `app/(user)/components/timeline-rail/RailFooter.tsx:48` et `:117` — deux `<Link href="/admin">`. **NE SONT PAS rendus sur `/cockpit-x`** (TimelineRail vit dans le legacy `app/(user)/components/LeftPanelShell.tsx` qui n'est plus mounté par `app/(user)/layout.tsx`). Mais ces liens restent dans le bundle et peuvent expliquer un prefetch latent.
- **Fix proposé en 1 phrase** : ajouter un guard `useEffect` dans `app/(user)/cockpit-x/CockpitXClient.tsx` (ou `app/(user)/layout.tsx`) qui log toute mutation de `window.location.pathname` hors du périmètre `/cockpit-x|/` pendant 30s, **ET** retirer/protéger l'action `open-admin` du Commandeur derrière un check `isAdmin === true` côté `use-commandeur-actions.ts` pour éliminer le seul vecteur applicatif `/admin` au sein du shell user.

## Hypothèses testées

### H1 — Link prefetch admin survolable sur `/cockpit-x` : **INFIRMÉ**

- Grep `href="/admin"` dans `app/(user)/**` :
  - `app/(user)/components/timeline-rail/RailFooter.tsx:48` (variante collapsed)
  - `app/(user)/components/timeline-rail/RailFooter.tsx:117` (variante expanded)
- Ces liens sont rendus par `RailFooter` → consommé par `timeline-rail/TimelineRail.tsx` → consommé par `app/(user)/components/LeftPanelShell.tsx` → consommé… **par personne dans le shell visionOS**. Le layout `app/(user)/layout.tsx` (lignes 30-45) ne mounte que `Commandeur`, `VideoQuickLaunch`, `VoicePulse`, `FocusBadge`, `MobileBottomNav`, `FocusModeStyles` (+ `useGlobalHotkeys`). Aucun import de `LeftPanelShell`/`TimelineRail`.
- `app/(user)/cockpit-x/CockpitXClient.tsx` (50-155) → rend `<Shell>` → `<LeftRail>` (`app/(user)/_shell/LeftRail.tsx`) + `<RightRail>` + `<FloatingFooter>`. Aucun `<Link>` dans `_shell/*`.
- `app/(user)/_stages/*` : grep `Link` et `admin` ⇒ zéro match.
- Verdict : `/cockpit-x` rendu **n'expose aucun `<Link href="/admin/…">` survolable**. H1 infirmé pour le shell mounté ; reste un soupçon résiduel sur les bundles RSC chargés en background (route prefetch par `next/link` d'un autre Stage qui charge transitivement TimelineRail), mais aucun de ces composants n'est dans le graphe du shell visionOS.

### H2 — Middleware / redirect server-side : **INFIRMÉ**

- `middleware.ts` racine : **n'existe pas** (vérifié `ls`). Seul `lib/credits/middleware.ts` existe — fonction utilitaire non-Next, jamais montée comme middleware.
- `app/admin/layout.tsx:12` : `redirect("/login?callbackUrl=/admin")` si `!session && !devBypass`.
- `app/admin/layout.tsx:28-30` : `redirect("/")` si role ≠ admin (skip si devBypass).
- `app/(user)/layout.tsx` (30-45) : aucun `redirect`. SessionProvider seul.
- `app/(user)/page.tsx` et `app/(user)/cockpit-x/page.tsx` : aucun `redirect`. Auth fail-soft (return `null`).
- `next.config.ts` : aucun `redirects`/`rewrites`. Seuls `headers()` (security CSP).
- Verdict : aucune route serveur ne redirige `/cockpit-x` → `/admin`. H2 infirmé. **À noter** : Zone 3 P0-001 (`/admin/*` → `/cockpit-x`) **EST** expliqué par `app/admin/layout.tsx:28-30` quand `role !== "admin"` — c'est le comportement attendu, pas un bug.

### H3 — Hook global / store qui fait `router.push` : **INFIRMÉ pour le scope `/cockpit-x`**

- Grep `router\.push.*admin\|router\.replace.*admin` dans `app/`, `hooks/`, `stores/` :
  - `app/(user)/components/use-commandeur-actions.ts:152` — `router.push("/admin")` ⚠️ MAIS uniquement dans la closure `perform` de la `CommandRow` « Console admin » (id `open-admin`). Appelée seulement via Cmd+K + Enter sur cette ligne.
  - `app/admin/agents/new/page.tsx:51` — `router.push(\`/admin/agents/\${json.agent.id}\`)` ⚠️ scope admin uniquement.
- `app/hooks/use-global-hotkeys.ts` (relu 1-179) : aucun `router.push`. N'utilise que `setMode` / `back` / `toggleCommandeur`. Cmd+1..0 / Cmd+K / Cmd+B / Cmd+G / Cmd+⇧F / Cmd+⇧V / Esc.
- `stores/stage.ts` : `setMode` / `setModeFromTool` / `back` / `reset` mutent uniquement le store Zustand. Pas de side-effect navigation.
- `stores/chat-stage.ts`, `stores/stage-data.ts`, `stores/voice.ts` : aucun `router`/`location`.
- `app/(user)/components/ChatDock.tsx:223` `router.replace(newUrl)` (post-OAuth callback, pathname = `/`) et `:244` `router.push("/")` (return home post-submit). Aucun `/admin`.
- Verdict : seul vecteur applicatif `/admin` accessible depuis `/cockpit-x` est **Cmd+K → row « Console admin » → Enter**. La Commandeur a `useGlobalHotkeys` qui peut être déclenchée par un `g`/`b` accidentel pendant Playwright autofocus. **C'est cohérent avec la dérive vers `/admin/themes` observée sur Meta+K** (la palette s'ouvre, focus tombe sur la première row matching, Enter implicite par snapshot a11y ?).

### H4 — Layout admin mount parasite sur `/cockpit-x` : **INFIRMÉ**

- `find app -name "layout.tsx"` retourne 6 layouts : root, (user), admin, spatial, spatial-safe, spatial-rnd. Pas de parallel route `@admin` ni interception `(.)admin`.
- App router Next 15 : `app/admin/layout.tsx` ne s'applique qu'aux routes `/admin/**`. Pas de cohabitation possible avec `(user)/layout.tsx` sur `/cockpit-x`.
- `find app -type d -name "@*" -o -name "(.)*"` : aucune parallel route / intercept.
- Verdict : H4 infirmé.

### H5 — DevTools / Sentry / instrumentation : **NON CONFIRMÉ, PISTE PLAUSIBLE**

- `instrumentation.ts` : init Sentry server + Langfuse + Storage + Scheduler. Aucun code client.
- `sentry.client.config.ts` : **n'existe pas**.
- `sentry.server.config.ts` et `sentry.edge.config.ts` : présents (côté server, n'affectent pas le DOM client).
- `app/layout.tsx` (root) : mount `NoiseLayer` + `ThemeHydrator` (non auditables ici sans Read). Aucune dépendance admin attendue.
- Verdict : pas de Sentry replay overlay détecté ; mais le **Next.js dev overlay** (port 4102, mode dev Turbopack avec HMR) peut surfacer une iframe `/__next/...` qui contient ses propres prefetch. **À investiguer en mode prod build (`pnpm build && pnpm start`)** — si la dérive disparaît, c'est confirmé Next dev overlay.

### H6 — Cache `.next/` / HMR : **PISTE LA PLUS PROBABLE EN COMPLÉMENT DE H1/H3**

- `.next/dev/build-manifest.json` existe (mode dev Turbopack actif). Pas de date récente fournie.
- Indices :
  - F-036 mentionne `requêtes /cockpit-x ABORTED, puis /admin/*` côté network. Le pattern ABORT + replay correspond à **Next.js Server Actions / RSC streaming interrompus par un HMR ou React 19 transition**.
  - `next.config.ts:46` active `reactCompiler: true` — mémoïsation automatique React 19, peut interagir mal avec Zustand subscribers en dev mode (re-render asynchrone).
  - `output: "standalone"` + Turbopack `root` pinned. Pas de soup mais le mix React Compiler + Turbopack dev + React 19 transitions est un combo connu pour générer des navigations fantômes dans certaines conditions.
- Verdict : **non isolable sans bench**. Recommandation : tester en mode prod `pnpm build && pnpm start` pour exclure.

## Preuves

### Sub-arbre rendu de `/cockpit-x` (graphe d'imports)

```
app/(user)/cockpit-x/page.tsx
  └─ app/(user)/cockpit-x/CockpitXClient.tsx
     ├─ app/(user)/_shell/Shell.tsx
     │  ├─ app/(user)/_shell/AmbientLayers.tsx
     │  ├─ app/(user)/_shell/LeftRail.tsx          ← seuls boutons stage (setMode)
     │  └─ app/(user)/_shell/RightRail.tsx
     ├─ app/(user)/_stages/*Stage.tsx              ← aucun router.push
     └─ app/(user)/components/ChatDock.tsx         ← router.push("/") + router.replace(?connected→pathname)
```

Aucun de ces fichiers ne mentionne `/admin`.

### Composants mountés globalement par `app/(user)/layout.tsx`

```ts
<SessionProvider>
  {children}
  <Commandeur />          // expose Cmd+K + row "open-admin" → router.push("/admin")
  <VideoQuickLaunch />
  <VoiceMount />          // conditionnel sur voiceActive
  <FocusBadge />
  <MobileBottomNav />
  <FocusModeStyles />
</SessionProvider>
```

`Commandeur.tsx` (relu) : ne contient pas de focus auto sur une row admin par défaut. La row « Console admin » (`use-commandeur-actions.ts:147-155`) est triée alphabétiquement parmi 23 actions. Cmd+K → Enter immédiat ouvrirait la 1re row de la 1re section, **pas admin**. Mais si Playwright press `Meta+K` et que Chromium consomme cette touche (search bar), puis quelques ms plus tard une touche d'azerty ou un focus déplace… théorie spéculative.

### Comportement `Meta+K` côté Playwright

- `useGlobalHotkeys` capture `Meta+K` (line 84-88) → `toggleCommandeur()`. Si le `KeyboardEvent` n'arrive jamais (Chrome intercept), Commandeur ne s'ouvre pas → cohérent avec F-101 « Meta+K dérive vers /admin/themes ». La dérive vers `/themes` reste inexpliquée sans repro live.

### Greps complets effectués (read-only)

```
grep -rn 'href="/admin' app/                       → 2 hits: RailFooter.tsx (non rendu)
grep -rn 'router\.push.*admin' app/ hooks/ stores/ → 2 hits: use-commandeur-actions.ts, admin/agents/new
grep -rn 'router\.replace.*admin' app/ hooks/ stores/ → 0 hit
grep -rn 'redirect.*admin' app/                    → 2 hits: admin/layout.tsx, admin/orchestrator/page.tsx
grep -rn 'Link.*admin' app/(user)/                 → idem RailFooter
grep -rn 'router\.push|router\.replace' shell/stages/cockpit-x → 0 hit
grep -rn 'useRouter|usePathname' shell/stages      → 0 hit
```

### Test reproductible recommandé

```bash
# Mode prod (exclut Turbopack dev + React Compiler + HMR)
pnpm build && pnpm start  # localhost:3000

# Puis avec Playwright (sans MCP, runs natifs)
npx playwright test --headed --grep="cockpit-x stability"
# spec à créer : navigate /cockpit-x, page.waitForTimeout(30_000), expect pathname === /cockpit-x
```

Si la dérive disparaît en prod → H5/H6 confirmés (dev mode artefact). Si persiste → H3 (Commandeur Console admin) ou un vecteur non identifié.

## Fix recommandé (pour Agent B en vague suivante)

### Fix 1 (defensive, applicable immédiatement)

- **Fichier** : `app/(user)/components/use-commandeur-actions.ts:147-155`
- **Diff conceptuel** : gater la row `open-admin` derrière un check rôle.

```diff
+ // Récupérer le rôle via useSession() ou un prop isAdmin
+ const { data: session } = useSession();
+ const isAdmin = (session?.user as { role?: string })?.role === "admin";
{
  id: "open-admin",
  kind: "action",
  label: "Console admin",
  hint: "Pipeline · agents · profiles",
+ disabled: !isAdmin,
  perform: () => {
+   if (!isAdmin) return;
    router.push("/admin");
    setOpen(false);
  },
},
```

**Critère de validation Fix 1** : avec un user non-admin, ouvrir Cmd+K → la row « Console admin » est rendue disabled et le `router.push("/admin")` ne s'exécute jamais. Test : `await page.keyboard.press("Meta+K"); await page.keyboard.press("Enter"); expect(page.url()).toBe(".../cockpit-x")`.

### Fix 2 (instrumentation pour repro)

- **Fichier** : `app/(user)/cockpit-x/CockpitXClient.tsx` (top du composant, après `useState`)
- **Diff conceptuel** : log toute navigation programmatique inattendue.

```ts
useEffect(() => {
  if (process.env.NODE_ENV !== "development") return;
  const original = window.history.pushState.bind(window.history);
  window.history.pushState = function (...args) {
    const url = String(args[2] ?? "");
    if (url.startsWith("/admin/") || url.startsWith("/public/")) {
      console.warn("[NAV-PARASITE]", url, new Error().stack);
    }
    return original.apply(window.history, args);
  };
}, []);
```

**Critère de validation Fix 2** : reproduire la dérive en local → la stack trace pointe vers le composant fautif. Permet d'isoler définitivement (Playwright snapshot vs code app vs Next dev overlay).

### Fix 3 (radical, à valider)

- **Fichier** : `next.config.ts`
- **Action** : désactiver `reactCompiler: true` temporairement et re-tester. Si la dérive disparaît → React Compiler 19 cause des re-mounts qui re-déclenchent un `router.push` cached. À reporter upstream.

**Critère de validation global** : après application des fixes, navigate `/cockpit-x`, attendre 30s sans interaction Playwright → `window.location.pathname === "/cockpit-x"` constant.

## Hors scope (à investiguer ailleurs)

- **F-101 (Meta+K inopérant en Playwright)** : cohérent avec Chrome native intercept de `Meta+K`. Pas un bug app. À mesurer en navigateur réel (humain) ou avec `page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', metaKey: true}))")` pour bypasser l'intercept.
- **F-040 (mobile dérive vers `/admin/pipeline`)** : symptôme du même bug global, pas un fix indépendant.
- **F-130 (404 sur `/admin/orchestrator/runs/fake-run-id`)** : conséquence de F-100, pas une cause.
- **Audit complet du legacy `app/(user)/components/timeline-rail/`** : ces composants existent mais ne sont plus rendus dans le shell visionOS. À supprimer en cleanup batch ultérieur (post-confirmation par grep que LeftPanelShell n'est plus importé nulle part) — réduira la surface bundle et éliminera définitivement H1.
- **Comportement `<Link prefetch>` Next 15 + Turbopack dev** : à benchmarker avec un test isolé hors Hearst pour confirmer/infirmer le rôle du dev overlay.
