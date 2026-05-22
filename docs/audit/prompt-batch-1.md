# 🟥 PROMPT 1 — BATCH 1 : Shell & Layout 3-col (P0 critiques UX)

> Orchestrateur : tu viens de superviser la fusion de 2 audits Helm (225 problèmes uniques, 22 P0). Ce prompt couvre les 10 premiers items du plan consolidé. Exécute-les dans l'ordre, 1 commit atomique par item.

---

## Contexte

- Stack : Next.js 16, Tailwind v4, React 19, Zustand 5
- Design system : tokens CSS uniquement (`--space-*`, `--radius-*`, `--accent-*`, `.t-N`), zéro px magique, zéro hex/rgb hardcodé
- Règles strictes :
  - NE JAMAIS modifier `app/spatial-safe/`, `components/spatial-safe/`, `hooks/spatial-safe/`, `lib/spatial-safe/`, `providers/spatial-safe/`, `styles/spatial-safe/`, `docs/spatial/_BACKUP_*`
  - NE JAMAIS supprimer de hooks d'état, stores, ou logique métier
  - Modifier UNIQUEMENT les classes Tailwind, styles inline, structure HTML/JSX, props
  - Commits en français, convention : `fix(shell): pb-48 conditionnel selon composer`
  - Après chaque modification : `pnpm typecheck && pnpm lint`

---

## Items à corriger

### 1.1 — `app/(user)/_shell/Shell.tsx` : `pb-48` conditionnel

Le padding-bottom de 192px (224px en 2xl) est appliqué sur **toutes** les pages, même sans `composer`. Sur les pages standalone (/reports, /settings, etc.), le bas est masqué par une zone vide.

**Recherche** (ligne ~55) :
```tsx
<main className="vision-content-depth preserve-3d flex flex-1 flex-col overflow-y-auto pt-6 pb-48 2xl:pb-56">
```

**Remplacer par** :
```tsx
<main
  id="main-content"
  className={
    "vision-content-depth preserve-3d flex flex-1 flex-col overflow-y-auto pt-6 px-4 md:px-6 " +
    (composer ? "pb-48 2xl:pb-56" : "pb-6")
  }
>
```

---

### 1.2 — `app/(user)/_shell/Shell.tsx` : fade bas adaptatif en 2xl

Le gradient de fade a `h-32` (128px) mais le padding bottom est `pb-56` (224px) en 2xl. Le contenu défile sous le fade.

**Recherche** (ligne ~62) :
```tsx
className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-32"
```

**Remplacer par** :
```tsx
className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-32 2xl:h-40"
```

---

### 1.3 — `app/(user)/_shell/Shell.tsx` : `id="main-content"` sur `<main>`

Nécessaire pour le skip-to-content (BATCH 2). Déjà inclus dans le bloc de remplacement du 1.1 ci-dessus : `id="main-content"`.

---

### 1.4 — `app/(user)/_shell/Shell.tsx` : padding horizontal manquant

Le `<main>` n'a aucun padding horizontal. Le contenu touche les bords sur mobile.

Déjà inclus dans le bloc de remplacement du 1.1 : `px-4 md:px-6`.

---

### 1.5 — `app/(user)/_shell/Shell.tsx` : `z-[25]` magique non tokenisé

Recherche (ligne ~72) :
```tsx
className="absolute right-0 bottom-0 left-0 z-[25] pointer-events-none flex justify-center"
```

Remplacer par :
```tsx
className="absolute right-0 bottom-0 left-0 z-30 pointer-events-none flex justify-center"
```

---

### 1.6 — `app/(user)/components/ui/ScreenShell.tsx` : double-scroll (overflow-y-auto)

`ScreenShell` a `overflow-y-auto` sur son `<div>` interne (ligne ~123). Quand il est rendu dans `Shell` (qui a aussi `overflow-y-auto` sur `<main>`), il y a deux contextes de scroll.

**Action** : ajouter une prop `scrollable?: boolean` (défaut `true`) à `ScreenShellProps`.

Si `scrollable === false`, retirer `overflow-y-auto` du `<div>` interne.

**Recherche** (interface + ligne ~95-125) :
```tsx
interface ScreenShellProps {
  // ... props existantes
  testId?: string;
}
```

**Ajouter** :
```tsx
  scrollable?: boolean;
```

**Recherche** (le div scrollable) :
```tsx
<div
  className="flex-1 overflow-y-auto no-scrollbar scroll-fade-bottom"
  style={{ padding: "var(--space-6) var(--space-12)" }}
>
```

**Remplacer par** :
```tsx
<div
  className={"flex-1 no-scrollbar scroll-fade-bottom " + (scrollable !== false ? "overflow-y-auto" : "")}
  style={{ padding: "var(--space-6) var(--space-12)" }}
>
```

---

### 1.7 — `app/(user)/components/standalone/StandalonePageFrame.tsx` : passer `scrollable={false}`

Les pages standalone (/reports, /settings, /marketplace, etc.) utilisent `StandalonePageFrame` > `Shell` > `ScreenShell`. Pour éviter le double-scroll, `ScreenShell` ne doit pas scroller quand il est dans un `Shell`.

**Action** : modifier `StandalonePageFrame` pour passer la prop.

**Recherche** :
```tsx
export function StandalonePageFrame({ children }: { children: ReactNode }) {
  return <Shell centerContent={children} />;
}
```

**Remarque** — StandalonePageFrame reçoit `children` qui est déjà un `<ScreenShell>`. Il ne peut pas passer `scrollable={false}` directement car `children` est un ReactNode opaque.

**Correction approche** : wrapper les children dans un contexte ou modifier StandalonePageFrame pour cloner/enrichir les children avec `scrollable={false}`. Ou bien — plus simple — modifier **Shell** pour accepter une prop `scrollable` (au lieu de ScreenShell) et StandalonePageFrame passe `scrollable={false}` au Shell :

```tsx
export type ShellProps = {
  centerContent: ReactNode;
  composer?: ReactNode;
  scrollable?: boolean;
};
```

```tsx
export function Shell({ centerContent, composer, scrollable = true }: ShellProps) {
```

Et conditionner `overflow-y-auto` du `<main>` sur `scrollable !== false` (voir 1.1).

Dans ce cas, StandalonePageFrame devient :
```tsx
export function StandalonePageFrame({ children }: { children: ReactNode }) {
  return <Shell centerContent={children} scrollable={false} />;
}
```

Et **on ne touche PAS** à ScreenShell pour le double-scroll (la prop reste inutile). **Adapte selon la technique la plus propre que tu trouves.**

---

### 1.8 — `app/(user)/layout.tsx` : `h-screen` → `h-dvh`

`h-screen` = 100vh. Sur iOS Safari avec barre d'adresse, 100vh dépasse la hauteur visible réelle (100dvh est la bonne unité dynamique).

**Recherche** (ligne ~122) :
```tsx
<div className="h-screen w-full overflow-hidden bg-black text-white antialiased">
```

**Remplacer par** :
```tsx
<div className="h-dvh w-full overflow-hidden bg-black text-white antialiased">
```

---

### 1.9 — `app/(user)/layout.tsx` : `padding-right: 2rem` inline → token

Dans `FocusModeStyles`, le padding est hardcodé en `rem`.

**Recherche** (ligne ~96) :
```tsx
.vision-content-depth { max-width: 100vw !important; padding-right: 2rem !important; }
```

**Remplacer par** :
```tsx
.vision-content-depth { max-width: 100vw !important; padding-right: var(--space-8) !important; }
```

---

### 1.10 — `app/(user)/layout.tsx` : `!important` dans style inline

Les `!important` dans le `<style>` inline sont un anti-pattern. Voir si on peut les remplacer par une spécificité CSS suffisante. Si les `!important` sont strictement nécessaires pour override des styles inline du package `@hearst/cockpit-shell`, **laisser un commentaire expliquant pourquoi**. Sinon, les retirer.

**Recherche** (ligne ~94-97) :
```tsx
<style>{`
  .vision-rail-right { display: none !important; }
  .vision-content-depth { max-width: 100vw !important; padding-right: var(--space-8) !important; }
`}</style>
```

**Action** :
- Si les `!important` sont nécessaires pour overrider des règles du package cockpit-shell, ajouter un commentaire :
  ```tsx
  <style>{/* overrides @hearst/cockpit-shell inline styles */}`
  ```
- Sinon, retirer les `!important`.

---

## Validation

```bash
pnpm typecheck && pnpm lint
```

**Critère de succès** : 0 erreur, 0 warning critique.

**Vérification manuelle rapide** (lancer `pnpm dev`, naviguer) :
- `/reports` — pas de zone vide en bas de page (pb-48 ne doit pas s'appliquer)
- `/settings` — scroll fluide, pas de double-scrollbar
- `/` (cockpit) — fade bas couvre bien le composer en 2xl
- Mobile (DevTools iPhone) — h-dvh fonctionne, pas de blanc en bas
