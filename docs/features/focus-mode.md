# Focus Mode — `focus-mode`

## Métadonnées

| Champ              | Valeur                                  |
| ------------------ | --------------------------------------- |
| **id**             | `focus-mode`                            |
| **statut**         | `in_progress`                           |
| **owner**          | Adrien                                  |
| **dernière revue** | 2026-05-10                              |
| **version spec**   | 1.0                                     |
| **niveau**         | P2 — pure UX, pas de data flow critique |
| **livrée**         | Sprint 4 (S4-B)                         |

## Description

Mode plein écran pour le Stage actif : ⌘⇧F masque les rails (Timeline + Context), élargit le Stage à 100vw, ajoute un badge discret en haut à gauche pour rappeler qu'on est en mode focus. ESC quitte le mode. État persisté en localStorage (le user retrouve son mode focus au reload).

Philosophie : **immersion sans distraction** — quand l'utilisateur travaille sur un asset complexe (ReportSpec, mission builder, chat profond), il peut isoler le Stage central des rails périphériques.

## Surface publique

### Composants

- [app/(user)/components/FocusBadge.tsx](<../../app/(user)/components/FocusBadge.tsx>) — badge discret top-left (label "Focus" + hint ESC), visible uniquement en mode focus
- [app/(user)/layout.tsx](<../../app/(user)/layout.tsx>) — applique conditionnellement les classes/styles pour masquer les rails

### Stores Zustand

- [stores/focus-mode.ts](../../stores/focus-mode.ts) — `useFocusModeStore`
  - State : `enabled: boolean`
  - Actions : `enable()`, `disable()`, `toggle()`
  - Persist : localStorage `hearst.focus-mode`

### Hooks

- [app/hooks/use-global-hotkeys.ts](../../app/hooks/use-global-hotkeys.ts) — enregistre ⌘⇧F (toggle) + ESC (disable si actif)

## Architecture interne

### Layout integration

- `(user)/layout.tsx` consomme `useFocusModeStore.enabled`
- Si `enabled` :
  - Rails Timeline + Context : `display: none` ou `width: 0`
  - Stage : `width: 100vw`
  - Transition CSS via `var(--duration-slow)` et `var(--ease-out)`

### Hotkey priority

- ⌘⇧F enregistré global
- ESC enregistré conditionnellement (uniquement si `enabled === true`) pour ne pas voler ESC à d'autres modaux/inputs

## Data flow

```
[User presse ⌘⇧F]
  ↓ use-global-hotkeys.ts → toggle()
  ↓ store.enabled = !store.enabled
  ↓ persist localStorage
[(user)/layout.tsx re-render]
  ↓ rails masqués / Stage 100vw
  ↓ FocusBadge visible si enabled
[User presse ESC]
  ↓ disable() (no-op si déjà false)
[Reload page]
  ↓ store hydrate depuis localStorage
  ↓ état restauré
```

## Invariants verrouillés

### I-1. Hotkey ⌘⇧F (toggle)

Mac : ⌘⇧F. Windows : Ctrl+Shift+F. Enregistré global via `use-global-hotkeys.ts`. Ne doit pas conflicter avec hotkey navigateur (Cmd+Shift+F = recherche full-text dans certains éditeurs ; OK car app capture).

### I-2. ESC pour quitter (jamais pour activer)

ESC enregistré uniquement si `enabled === true`. Ne pas voler ESC quand mode désactivé (ESC reste pour fermer modaux, voice input, etc.).

### I-3. Persistance localStorage

Clé : `hearst.focus-mode`. Format : `{ enabled: boolean }` ou plain boolean. Hydrate au mount du store.

### I-4. Transition CSS via tokens

Les transitions d'apparition/disparition des rails utilisent `var(--duration-slow)` et `var(--ease-out)` (cohérent avec [globals.css](../../app/globals.css)). Pas de hardcode 300ms.

### I-5. FocusBadge non interactif primary action

Le badge top-left est purement informatif (label + hint ESC). Pas de bouton "Quitter" cliquable (force l'ergonomie clavier ESC). Hover = halo subtil teal sourd OK (cohérent voix éditoriale).

### I-6. Rails masqués, pas démontés

Les rails sont masqués via CSS (display:none ou width:0) mais leur state Zustand reste actif. Re-affichage instantané au disable. Pas d'unmount/remount (perte d'état coûteuse).

## Évolutions autorisées sans spec

- Polish FocusBadge (animations, position, copy)
- Ajustement durée transition
- Ajout d'un mode "ultra-focus" (PulseBar + ChatDock masqués aussi)
- Ajout d'un toggle visible dans Settings
- Hotkey configurable (custom binding)
- Synchronisation cross-tab (storage event)

## Risques & modes de défaillance

| Risque                                   | Impact               | Mitigation actuelle                                           |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------- |
| Hotkey conflit IME/éditeur               | Toggle pas déclenché | À surveiller — exclude focus dans `<input>`/`<textarea>`      |
| LocalStorage indisponible (private mode) | Pas de persist       | OK, fallback in-memory                                        |
| Re-render rails coûteux                  | Latence toggle       | Mitigé par `display:none` (pas de unmount)                    |
| ESC vole le flow d'un modal              | Modal pas fermé      | ESC enregistré conditionnellement (uniquement si focus actif) |
| Focus cumulatif (focus + voice + cmdK)   | Ambiguïté            | Voice et CmdK ont leur propre ESC handler en priorité         |

## Tests

### Manquants (gap)

- Test toggle store + persist localStorage
- Test hotkey ⌘⇧F enregistré + ne se déclenche pas dans `<input>`
- Test ESC enregistré uniquement si enabled
- Test layout.tsx applique classes correctement
- Test FocusBadge visible uniquement si enabled
- E2E : ⌘⇧F → rails disparus → ESC → rails reviennent

## Notes & historique

- **Sprint 4 (S4-B)** — release initiale, persist + hotkey + badge
