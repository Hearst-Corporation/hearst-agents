# Timeline Rail — `timeline-rail`

## Métadonnées
| **id** | `timeline-rail` |
| **statut** | `verrouillé v1.1` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-09 |
| **version spec** | 1.1 |
| **niveau** | P2 |
| **pivot visuel** | 2026-05-09 (silent luxury OS — alignement palette teal sourd, sidebar architecturale) |

## Description

Rail gauche multi-objet introduit lors du pivot 2026-04-29. Remplace l'ancien `LeftPanel` qui n'exposait que des conversations. Le `TimelineRail` groupe tous les objets de travail (threads de chat, missions, assets) en 4 sections canoniques ordonnées par recency : **Now**, **Récents** (Today + Last 7 days), **Archive**, et les entrées de navigation rapide (Home, App, Chat). Le composant est wrappé par `LeftPanelShell` qui gère le responsive drawer mobile.

## Surface publique

- `app/(user)/components/TimelineRail.tsx` — composant principal
- `app/(user)/components/LeftPanelShell.tsx` — shell responsive (inline desktop / drawer mobile)
- `stores/navigation.ts` — Zustand store persisté (`hearst-navigation`, version 2)

## Types clés
```ts
// stores/navigation.ts
export type Surface = "home" | "inbox" | "calendar" | "files" | "tasks" | "apps" | "settings";

export interface Thread {
  id: string;
  name: string;
  surface: Surface;
  lastActivity: number;
  pinned?: boolean;
  archived?: boolean;
}

interface NavigationState {
  leftCollapsed: boolean;        // desktop rail collapse — persisté
  leftDrawerOpen: boolean;       // mobile drawer open — volatile (non persisté)
  surface: Surface;
  threads: Thread[];
  activeThreadId: string | null;
  addThread: (name: string, surface: Surface) => string;
  setActiveThread: (id: string | null) => void;
  updateThreadName: (id: string, name: string) => void;
  removeThread: (id: string) => void;
  togglePinned: (id: string) => void;
  toggleArchived: (id: string) => void;
  messages: Record<string, Message[]>;
  // + helpers messages (addMessageToThread, etc.)
}
```

## Invariants verrouillés

### I-1. Sections toujours rendues
Les 4 sections (Now/Récents/Archive + navigation) sont **toujours présentes** avec leur empty state interne. Jamais de `{section.length > 0 && <Section>}` autour d'un bloc complet — la structure du rail ne doit pas changer selon la présence de données.

### I-2. Regroupement temporel immuable
- `today` : threads avec `lastActivity >= now - 24h` (non archivés)
- `thisWeek` : threads avec `lastActivity >= now - 7j` et `< now - 24h` (non archivés)
- `archive` : threads `archived === true` ou `lastActivity < now - 7j`
- Seuils en ms : `ONE_DAY_MS = 86_400_000`, `SEVEN_DAYS_MS = 604_800_000`

### I-3. Sélection d'un thread → double action
`handleThreadSelect` appelle toujours `setActiveThread(threadId)` **ET** `setStageMode({ mode: "chat", threadId })`. Ne jamais séparer ces deux appels.

### I-4. Largeur par token CSS
- Expanded : `var(--width-threads)`
- Collapsed : `var(--width-threads-collapsed)`
- Transition : `transition-[width] duration-slow ease-out-soft`
- Pas de valeur numérique inline pour la largeur du rail.

### I-5. Collapsed mode : max 12 tiles
En état collapsed, seuls les 12 premiers threads sont rendus (`threads.slice(0, 12)`). Pas de scroll infini en mode icône.

### I-6. setActiveThread ferme le drawer mobile
`setActiveThread` pose `leftDrawerOpen: false` de manière inconditionnelle. Ce comportement est dans le store, pas dans le composant.

### I-7. leftDrawerOpen non persisté
`leftDrawerOpen` est **exclu** de `partialize` — il n'est pas écrit dans localStorage. Au rechargement, le drawer est toujours fermé.

### I-8. Navigation Home → mode cockpit
`handleHome` appelle `setActiveThread(null)` puis `setStageMode({ mode: "cockpit" })`. Le click logo/Home ne doit jamais forcer un mode `chat`.

### I-9. Nouveau thread → mode chat
`handleNewThread` crée un thread via `addThread("New", "home")` puis appelle `setStageMode({ mode: "chat", threadId })`. L'ID retourné par `addThread` est transmis au Stage immédiatement.

### I-10. Logo Hearst intouchable
En état expanded, le logo est rendu via `<HearstLogo className="h-10 w-auto" />`. En collapsed, seul le caractère `H` est affiché en couleur d'accent système (cible v1.1 : `var(--accent-teal)`, teal sourd ; actuellement `var(--cykan)` dans le code, rename différé après validation mockup `docs/visual/cockpit-2026-05.html`). Jamais d'autre asset ou texte logo.

### I-11. Archive depuis le rail
`toggleArchived(threadId)` dans le store : si le thread devient archivé et qu'il était actif, `activeThreadId` passe à `null`. Pas de navigation forcée vers un autre thread.

### I-12. Store migration v2
Le store utilise `version: 2`. La migration filtre les threads `id === "default" && name === "Accueil"` qui existaient en v1 et réinitialise `activeThreadId = null` si il vaut `"default"`.

## Tests
Existants :
- Aucun test dédié au TimelineRail ou à LeftPanelShell répertorié dans le repo au 2026-05-08.

Manquants (P0) :
- `groupThreadsByDate` : test unitaire des 3 buckets (today / thisWeek / archive) avec timestamps mock
- `toggleArchived` : vérifier que activeThreadId → null quand le thread actif est archivé
- `setActiveThread` : vérifier que leftDrawerOpen passe à false
- `LeftPanelShell` : test responsive — drawer visible mobile, inline desktop
