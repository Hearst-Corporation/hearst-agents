# `_shell/` — Shell 3 colonnes

Source de vérité du layout de toute l'app utilisateur.

## Layout

```
┌──────────────┬──────────────────────────────────┬────────────────┐
│              │                                  │                │
│  LeftRail    │          Centre                  │  RightRailChat │
│  88px, glass │  <main overflow-y-auto pt-6      │  320px, glass  │
│              │        pb-48>                    │                │
│  Boutons     │                                  │  Chat Kimi K2  │
│  setMode()   │  Stage actif (cockpit/chat/…)    │  (RightRail-   │
│  +           │  OU page ScreenShell             │   Chat.tsx)    │
│  Links Next  │  (via StandalonePageFrame)        │                │
│              │                                  │                │
└──────────────┴──────────────────────────────────┴────────────────┘
```

**Règle d'or** : une seule navigation dans toute l'app = rail gauche / centre /
chat droite. Il n'existe pas d'autre layout shell. Toute nouvelle page ou vue
passe par ce schéma.

---

## Fichiers du dossier

| Fichier | Rôle |
|---|---|
| `Shell.tsx` | Composant racine — orchestre AmbientLayers + LeftRail + centre (`centerContent`) + RightRailChat + composer optionnel. **LOCKED** après P2. |
| `LeftRail.tsx` | Rail gauche 88px — logo Hearst, boutons `setMode()` pour les stages internes, liens Next vers les pages-routes, avatar/session. |
| `RightRailChat.tsx` | Rail droite 320px — chat Kimi K2 via Hypercli, toujours visible. |
| `AmbientLayers.tsx` | Couche de fond z-0 — halo blanc + dots teal, effet visionOS. |
| `KpiGrid.tsx` | Grille de KPIs réutilisable dans le centre (cockpit stage). |
| `PageLayout.tsx` | Wrapper de mise en page pour les pages-routes (padding, max-width). |
| `StageLayout.tsx` | Wrapper pour les stages internes plein-écran (flex-1, overflow). |

---

## Comment ajouter une entrée de menu

### Cas 1 — Nouveau mode interne du cockpit (Stage)

Le contenu reste dans le centre, sans changer d'URL.

1. Ajouter le mode dans `stores/stage.ts` :
   ```ts
   export type StageMode = ... | "mon-nouveau-mode";
   ```
2. Créer le composant de vue dans `app/(user)/_stages/MonNouveauStage.tsx`.
3. L'enregistrer dans `app/(user)/_stages/registry.ts` :
   ```ts
   { mode: "mon-nouveau-mode", component: MonNouveauStage, label: "Mon Stage" }
   ```
4. Ajouter un bouton `setMode("mon-nouveau-mode")` dans le groupe STAGES de
   `LeftRail.tsx` (section "boutons de stages", ordre existant à respecter).

### Cas 2 — Nouvelle page-route (URL dédiée)

La page a sa propre URL et hérite du shell complet (rail + chat) gratuitement.

1. Créer `app/(user)/<route>/page.tsx` et l'envelopper dans `StandalonePageFrame` :
   ```tsx
   import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";

   export default function MaPage() {
     return (
       <StandalonePageFrame>
         {/* ScreenShell ou contenu custom ici */}
       </StandalonePageFrame>
     );
   }
   ```
   `StandalonePageFrame` rend `Shell` — le rail gauche et le chat droite
   apparaissent automatiquement, sans aucune modification supplémentaire.

2. Ajouter un `<Link href="/<route>">` dans le groupe PAGES de `LeftRail.tsx`.

---

## Notes

- `StandalonePageFrame` → `Shell` : toute page qui utilise ce wrapper hérite
  du rail gauche et du chat droite sans intervention sur Shell.tsx.
- Ne jamais modifier `Shell.tsx` directement (LOCKED P2+). En cas de bug shell,
  escalader à Adrien explicitement.
- Tokens uniquement : `--ct-*` / `.t-N`. Aucun hex hardcodé.
