# QA — Commandeur & dialogs : focus + Escape — `qa-commandeur-a11y`

## Métadonnées

| Champ              | Valeur                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| **id**             | `qa-commandeur-a11y`                                                            |
| **statut**         | `draft`                                                                         |
| **owner**          | Adrien                                                                          |
| **dernière revue** | 2026-05-15                                                                      |
| **version spec**   | 1.0                                                                             |
| **niveau**         | **P0** — un utilisateur clavier-only ne peut pas utiliser le Commandeur sans clic souris préalable |
| **priorité**       | `P0`                                                                            |
| **tag**            | `priorité-P0`, `qa-2026-05-15`, `a11y`                                          |

## Description

Le Commandeur (⌘K) et le VideoQuickLaunch (⌘G) sont des dialogs modaux qui souffrent du même bug d'accessibilité : à l'ouverture, le focus n'est pas transféré au premier élément focusable du dialog, et la touche Escape ne ferme pas le dialog tant que le focus n'a pas été manuellement déplacé via clic souris.

WCAG 2.1.2 (No Keyboard Trap) inversé : ce n'est pas un trap, c'est une **inaccessibilité totale au clavier**.

## Findings source

- **F-015** (Zone 1) — Cmd+K ouvre le Commandeur sans transférer le focus
- **F-016** (Zone 1) — Escape ne ferme pas le Commandeur quand le focus est ailleurs (textarea ChatDock)
- **F-022** (Zone 1) — recherche Commandeur non testable car focus jamais transféré
- **F-033** (Zone 1) — VideoQuickLaunch ouvert par lettre `g` non filtrée dans textarea
- **F-034** (Zone 1) — Escape ne ferme pas VideoQuickLaunch

## Surface concernée

- [app/(user)/components/Commandeur.tsx](<../../app/(user)/components/Commandeur.tsx>) — ligne 126 (keydown global), ligne 155 (`autoFocus: false`)
- [app/(user)/components/VideoQuickLaunch.tsx](<../../app/(user)/components/VideoQuickLaunch.tsx>) — dialog hotkey ⌘G
- [app/hooks/use-global-hotkeys.ts](../../app/hooks/use-global-hotkeys.ts) — filtrage `isInInput` à appliquer
- Hook `useModalA11y` (à créer ou compléter) — focus transfer + Escape global

## Invariants verrouillés

### I-1. Focus transféré au mount du dialog

Quand `useStageStore.setCommandeurOpen(true)` (ou équivalent `setVideoQuickLaunchOpen(true)`) passe à `true`, le composant **doit** dans son `useEffect` appeler `.focus()` sur le premier élément focusable (typiquement l'input de recherche ou le textarea prompt).

```tsx
useEffect(() => {
  if (isOpen && inputRef.current) {
    inputRef.current.focus();
  }
}, [isOpen]);
```

### I-2. Escape ferme le dialog quel que soit le focus

Le listener `keydown Escape` **doit** être attaché à `window` avec `{ capture: true }` ou via un wrapper `useModalA11y({ closeOnEscape: true })` qui intercepte avant le bubble.

L'écoute ne doit pas dépendre du focus actif. Un textarea qui capture l'événement ne doit pas bloquer la fermeture du dialog.

### I-3. Hotkey simple (lettre seule) filtrée dans les inputs

`useGlobalHotkeys` **doit** vérifier `document.activeElement.tagName` ∈ `["INPUT", "TEXTAREA"]` ou `[contenteditable="true"]` avant de déclencher une hotkey simple (lettre sans modifier).

Une frappe `g` ou `G` dans un textarea **ne doit jamais** déclencher l'ouverture du VideoQuickLaunch ou tout autre dialog.

Les hotkeys avec modifier (⌘K, ⌘G, ⌘1..0) restent actives même dans un input.

### I-4. `aria-modal="true"` + role="dialog" présents

Tout dialog modal **doit** exposer `role="dialog"` + `aria-modal="true"` + `aria-label` ou `aria-labelledby`.

### I-5. Body scroll lock au mount, restauré à l'unmount

`document.body.style.overflow = "hidden"` au mount, restauré à la valeur précédente à l'unmount.

### I-6. Backdrop click ferme le dialog

Click sur la zone hors dialog (`div.fixed.inset-0` parent) **doit** fermer le dialog. Déjà OK pour le Commandeur, à vérifier pour VideoQuickLaunch.

## Critères d'acceptation testables

1. **Focus auto** : `page.keyboard.press('Meta+K')` + `expect(page.evaluate(() => document.activeElement.tagName)).toBe('INPUT')`.
2. **Escape global** : ouvrir Commandeur, ne pas cliquer, `page.keyboard.press('Escape')` + assert dialog absent du DOM.
3. **Escape avec focus textarea** : focus ChatDock textarea, `Meta+K`, sans bouger le focus, `Escape` → dialog fermé.
4. **Hotkey `g` dans textarea** : focus textarea ChatDock, `page.keyboard.type('hello g world')` → aucun dialog VideoQuickLaunch ouvert.
5. **`Meta+G` dans textarea** : focus textarea, `Meta+G` → VideoQuickLaunch ouvert ET focus transféré au textarea du dialog.
6. **A11y attributs** : `expect(dialog.getAttribute('aria-modal')).toBe('true')`, `expect(dialog.getAttribute('aria-label')).toBeTruthy()`.
7. **VideoQuickLaunch textarea aria-label** : `dialog textarea` doit avoir `aria-label="Prompt vidéo"` (cf F-035).

## Évolutions autorisées

- Choix d'implémentation : `useModalA11y` custom OU primitive Radix UI / Headless UI.
- Animation d'entrée/sortie tant que `aria-modal` reste posé.
- Ajout d'autres dialogs respectant les mêmes invariants.

## Risques & modes de défaillance

| Risque                                | Impact                            | Mitigation actuelle |
| ------------------------------------- | --------------------------------- | ------------------- |
| Focus volé par un autre composant     | A11y régression silencieuse       | Test E2E systématique |
| Hotkey `g` capturée par un autre hook | Conflit ordre useEffect           | Liste prio hotkeys  |
| Escape consommé par Mode Focus        | Ferme le mauvais layer            | Z-index dialogs > Mode Focus |

## Tests à écrire

- E2E : `tests/e2e/commandeur-a11y.spec.ts` — focus + Escape + hotkey filtering
- E2E : `tests/e2e/video-quick-launch-a11y.spec.ts` — idem + filter `g` dans inputs
- Unit : `__tests__/hooks/use-global-hotkeys.test.ts` — `isInInput()` filter

## Notes & historique

- 2026-05-15 — Bug identifié en QA. Le listener keydown global du Commandeur est attaché mais bypassé par le textarea ChatDock (focus précédent conservé).
