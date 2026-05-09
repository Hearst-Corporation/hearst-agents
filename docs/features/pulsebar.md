# PulseBar — `pulsebar`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `pulsebar` |
| **statut** | `verrouillé v1.1` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-09 |
| **version spec** | 1.1 |
| **niveau** | P2 |
| **pivot visuel** | 2026-05-09 (silent luxury OS — alignement palette teal sourd) |

## Description

Header fixe de 56px (`--height-pulsebar`) au sommet du cockpit. Trois zones : gauche (hamburger mobile), centre (Cmd+K trigger), droite (indicateurs conditionnels + NotificationBell). Rendu dans `app/(user)/layout.tsx` avant les 3 colonnes — monté une seule fois, jamais unmounté lors des navigations entre Stages.

## Surface publique

**Composants**
- `app/(user)/components/PulseBar.tsx` — composant principal (`"use client"`)
- `app/(user)/components/use-offline-status.ts` — hook `useOfflineStatus(): { isOnline: boolean }`
- `app/(user)/components/NotificationBell.tsx` — cloche de notifications (montée dans PulseBar)

**Stores consommés (lecture uniquement)**
- `useRuntimeStore` → `coreState` : détermine si un run est en cours
- `useStageStore` → `current.mode` (voice active?) + `setCommandeurOpen`
- `useNavigationStore` → `toggleLeftDrawer` (hamburger mobile)

**API appelée par PulseBar**
- `GET /api/v2/user/connections` — méta `{ connected, total }` des apps OAuth, refresh toutes les 60 s

## Types clés

```ts
// États coreState qui déclenchent l'indicateur "En cours"
type RunningState =
  | "connecting"
  | "streaming"
  | "processing"
  | "awaiting_approval"
  | "awaiting_clarification";

interface ConnectionsMeta {
  connected: number;
  total: number;
}

// useOfflineStatus retourne
interface OfflineStatus {
  isOnline: boolean; // true par défaut (SSR + navigator.onLine absent = assume online)
}
```

## Invariants verrouillés

### I-1. Hauteur fixe `--height-pulsebar`
La PulseBar doit toujours mesurer exactement `var(--height-pulsebar)`. Toute modification de padding vertical ou ajout de ligne qui fait croître le composant casse l'alignement global du cockpit (les 3 colonnes calculent leur hauteur en `flex-1`).

### I-2. Aucun coût/budget dans la PulseBar
Le cost meter a été retiré au pivot 2026-05-03 et est explicitement banni de l'UI cockpit. Ne pas réintroduire d'indicateur financier (budget, tokens consommés, coût USD) dans ce composant.

### I-3. Indicateurs droite : conditionnels uniquement
Les indicateurs ("En cours", "Voix", connections meter) ne s'affichent que lorsqu'ils sont pertinents. Ils ne doivent pas être visibles à l'état idle. Ajouter un indicateur permanent violerait la voix éditoriale minimaliste.

### I-4. Connections meter : lien vers `/apps`, refresh 60 s
Le meter est un `<a href="/apps">`, pas un bouton. Il link toujours vers `/apps`. Le polling est à 60 s (pas moins) pour ne pas saturer l'endpoint. Le meter est masqué sur mobile (`hidden md:flex`).

### I-5. Cmd+K ouvre le Commandeur via `setCommandeurOpen(true)`
Le seul effet du bouton central est d'appeler `setCommandeurOpen(true)` sur `useStageStore`. Ne pas naviguer, ne pas ouvrir de modal propriétaire — le Commandeur est l'overlay canonique.

### I-6. `useOfflineStatus` : fail-soft sur SSR et browsers anciens
Si `navigator` ou `navigator.onLine` est absent, le hook retourne `{ isOnline: true }`. Ne jamais bloquer l'UI sur un faux-négatif offline.

### I-7. VoiceMount vit dans le layout, pas dans la PulseBar
`<VoicePulse />` est monté dans `UserLayout` (root), conditionné par `voiceActive`. La PulseBar affiche uniquement l'indicateur texte "Voix" — elle ne gère pas le pipeline WebRTC.

### I-8. Halo accent uniquement sur états actifs intentionnels
Conforme au pivot éditorial 2026-04-29 : pas de `halo-on-hover` sur les boutons de la PulseBar. Le halo (`halo-dot`, `halo-cyan-sm` — à renommer en `halo-accent-sm` lors de la migration palette v1.1) est réservé aux dots d'état actif (run en cours, voix active). À partir de v1.1, la couleur cible est `--accent-teal` (teal sourd, pas cyan saturé).

### I-9. Pas de mono caps `tracking-marquee` en JSX
Les labels "En cours" et "Voix" sont en voix régulière FR avec `font-light`, pas en mono caps `tracking-marquee/section/label`. Le brief visuel "silent luxury OS" (2026-05-09) demande "tiny uppercase labels" — **explicitement écarté** : la voix éditoriale FR (pivot 2026-04-29) prime, ré-affirmée en v1.1.

## Tests

Existants : `__tests__/components/PulseBar*` (à vérifier)

Manquants :
- Indicateur "En cours" visible pour chaque `RunningState`, absent à l'état idle
- Connections meter absent si fetch échoue (fail-soft)
- `useOfflineStatus` retourne `true` si `navigator.onLine` absent
- Cmd+K trigger appelle `setCommandeurOpen(true)` et rien d'autre
