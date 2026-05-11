# Spatial — Langage d'interaction (v1.0)

> Spec figée du langage d'interaction de la vue Spatial.
> Date : 2026-05-11. Statut : draft, à valider par Adrien avant implémentation.
> Cette spec capture **le comportement attendu**, pas l'implémentation.

## 1. Principe fondateur

Spatial = vue 3D **alternative** du dashboard expert. Mêmes données, mêmes services, mêmes stores. Différence = **la couche présentation**. Toggle in-app entre les deux.

L'utilisateur explore son OS **comme une carte de territoire**, pas comme un dashboard 2D transposé en l'air. Chaque entité (mission, asset, report, connexion) est un objet physique dans une scène.

## 2. Architecture 3D cible

### 2.1 Moteur

- **React Three Fiber (R3F)** + **@react-three/drei** + **@react-three/postprocessing**
- Migration depuis Spline → R3F natif validée
- Le centre n'est plus un logo Spline. C'est une scène vide habitée par la lumière et la profondeur.

### 2.2 Composition de la scène

```
[Plan Z=-50]  FOND      fog exponentiel sombre + 1 directional light lointaine
[Plan Z=-8]   MID       2-3 meshes architecturaux massifs (silhouettes monolithiques)
                        rôle = donner le sens de l'échelle, jamais d'interaction
[Plan Z=-2]   CONTENT   panels <Html transform occlude> (KPI, Mission, Brief, Assets, …)
                        positionnés à différentes Z pour vraie profondeur
[Plan Z=0]    CAMERA    position initiale, FOV 28-32 (long focal cinéma)
[Plan Z=+2]   HUD       overlays 2D : ChatPill, Hotkeys, Bell, VoicePill, Breadcrumb
```

### 2.3 Lumière

- 1× directional light lointaine, intensité 1.0, cool tone (`#a8b8cc`)
- 1× accent light froide-bleutée, intensité 0.3, position décentrée
- ambient 0.15 maximum (presque rien)
- **Pas de spot light franc**, pas de soleil franc. On veut du clair-obscur.

### 2.4 Caméra

- FOV : **28** par défaut (cinéma téléobjectif), max **34**
- Position initiale : `[0, 1.5, 12]`
- Toujours **contrainte sur des cibles** — pas de free fly
- Animations via **GSAP** pour la fluidité cinéma (R3F a `useFrame` mais GSAP est meilleur pour les courbes cinématographiques)

### 2.5 Post-processing

Ordre obligatoire (rendre l'image avant le DOF de polluer) :
1. `<DepthOfField>` — focusDistance dynamique selon sélection, bokehScale 4
2. `<Bloom>` — intensity 0.3, luminanceThreshold 0.85 (seulement les hautes lumières)
3. `<Vignette>` — eskil false, offset 0.1, darkness 0.7
4. `<Noise>` — opacity 0.04 (grain film discret)

### 2.6 Ambiance volumétrique

- `<fogExp2 args={['#050507', 0.018]} />` — c'est ça qui crée la profondeur immense
- Pas de skybox HDRI cliché
- Pas de starfield, pas d'étoiles
- **DustField** : 50-100 particules max, dérive lente, uniquement tiers inférieur, comme de la brume — pas dans tous les sens

## 3. États universels des objets sélectionnables

Tous les objets interactifs (panels, cards, orbital items, KPIs, …) respectent ces 6 états visuels.

### 3.1 État `idle`
- opacity : `1`
- scale : `1`
- halo : `0`
- elevation Z : `0`
- pas d'animation

### 3.2 État `hover`
- scale : `1.04`
- halo : `var(--spatial-halo-hover)` (blanc cassé chaud, opacity 0.3)
- elevation Z : `+0.05`
- transition : `var(--spatial-duration-hover)` ease-out
- Trigger : `onPointerOver` (R3F) ou `onMouseEnter` (HTML)

### 3.3 État `selected`
- scale : `1.06`
- halo : `var(--spatial-halo-selected)` (blanc, opacity 0.6)
- elevation Z : `+0.08`
- **autres objets passent à `defocused`** (voir §3.7)
- transition : `var(--spatial-duration-focus)` cinematic
- DOF GPU recale `focusDistance` sur la position Z de l'objet

### 3.4 État `pinned`
- Comme `selected` mais persistant après autre sélection
- halo : `var(--spatial-halo-pinned)` (cyan accent-teal, opacity 0.6)
- Trigger : raccourci `P` ou clic long
- Peut coexister avec un nouveau `selected` (pinned reste net, defocused n'affecte pas les pinned)

### 3.5 État `active` / `running`
- pulsation scale `0.98 ↔ 1.02` sur cycle 1.6s ease-in-out infinite
- halo : alternance `0.4 ↔ 0.7` synchro avec scale
- Pour : missions en cours, briefing en streaming, voice active, etc.

### 3.6 État `error`
- halo : `var(--spatial-halo-error)` (ambre `#d9a86c`, opacity 0.7) — **pas rouge agressif**
- légère vibration mesh `±0.5deg rotateZ` sur 200ms (3 cycles)
- Trigger : runtime erreur (mission failed, fetch ko)

### 3.7 État `defocused` (passif, appliqué aux autres)
- opacity : `0.4`
- saturation : `0.6` (filter)
- DOF GPU les met **hors focusDistance** → vrai blur cinéma sur ces objets
- Pas de halo

### 3.8 État `disabled` / `empty`
- opacity : `0.3`
- saturation : `0`
- pas de pointer-events
- curseur not-allowed

## 4. Niveaux d'inspection (3 paliers)

Chaque objet sélectionnable expose 3 niveaux d'inspection successifs.

### 4.1 Glance — survol
- Trigger : `pointerOver` > 600ms sans clic
- Caméra : drift de 5% vers la cible (1.2s ease-out)
- Halo passe à `hover`
- Info ambiante : nom + signal visuel (statut), pas de panel d'inspection

### 4.2 Focus — clic
- Trigger : `pointerDown` / `click`
- Caméra : zoom + cible centrée (1.8s `power3.inOut`)
- État passe à `selected`
- Panel d'inspection latéral apparaît (drei `<Html>` à droite)
- DOF se règle sur Z de l'objet

### 4.3 Deep — double-clic / Cmd+Enter
- Trigger : `doubleClick` ou `Cmd+Enter` quand selected
- Caméra : entrée dans l'objet, transition fade scène → sous-scène (2.4s)
- Scène devient le sous-monde de cet objet
  - Mission → timeline 3D des runs passés, chaque run un objet visitable
  - Asset → cercle des variantes autour de l'asset au centre
  - Report → galerie des blocks du report dans l'espace
  - Connection → constellation des actions disponibles
- Échap revient au niveau parent (1.6s reverse)

## 5. Navigation cinématique

### 5.1 Style obligatoire
- Cinématique. Pas de WASD, pas de rotation libre, pas de drag.
- L'utilisateur ne pilote presque pas la caméra. Tout est déclenché par interaction sur les objets ou via hotkeys.

### 5.2 Mouvements caméra autorisés
- **Drift** (glance) : `[1.2s, ease-out, power2]`, déplacement 5% de la distance focal
- **Zoom-on-select** : `[1.8s, power3.inOut]`, recale `position` + `lookAt`
- **Deep-in** : `[2.4s, power3.inOut]`, entrée Z, fade outside-target
- **Recul-to-overview** : `[1.6s, power3.inOut]`, retour position initiale `[0, 1.5, 12]`
- **Cycle-cible** (Tab) : `[1.0s, power2.inOut]` entre cibles focusables

### 5.3 Pan/zoom manuels
- **Désactivés** par défaut. Ajout optionnel via setting "Mode libre" (v2, pas maintenant).

## 6. Hotkeys couche 2

À ajouter dans `SpatialHotkeys.tsx`.

| Touche | Action | Notes |
|--------|--------|-------|
| `Esc` | unselect + recul caméra vue d'ensemble | Toujours dispo |
| `P` | pin/unpin l'objet sélectionné | Persiste après unselect |
| `Cmd+Enter` | deep-dive sur objet sélectionné | Équivalent double-clic |
| `Space` | vue d'ensemble (zoom out max) | Toggle, retour position précédente |
| `Tab` | cycle entre objets focusables | Avec préview caméra drift |
| `Shift+clic` | multi-sélection | Cumule dans `selected[]` |
| `/` | ouvrir ChatPill flottante | Voir §8 |
| `Cmd+K` | (existant) Commandeur global | Inchangé |
| `Cmd+7` | (existant) toggle voice | Inchangé |
| `Cmd+Backspace` | (existant) router.back() | Inchangé |

## 7. Store de sélection — `useSpatialSelection`

Fichier cible : `stores/spatial-selection.ts`. Zustand léger, **autonome** pour v1 (pas branché au store global `useSelectionStore` tant que le back-end est en cours). Migration vers pont commun en v1.1.

### 7.1 API

```ts
type SpatialEntityId = string;

interface SpatialSelectionState {
  hovered: SpatialEntityId | null;
  selected: SpatialEntityId[];      // multi-sélection via Shift+clic
  pinned: SpatialEntityId[];        // persistants, indépendants de selected
  focusedDepth: 'glance' | 'focus' | 'deep' | null;
  
  hover(id: SpatialEntityId | null): void;
  select(id: SpatialEntityId, opts?: { multi?: boolean }): void;
  unselect(id: SpatialEntityId): void;
  unselectAll(): void;
  pin(id: SpatialEntityId): void;
  unpin(id: SpatialEntityId): void;
  togglePin(id: SpatialEntityId): void;
  setDepth(depth: 'glance' | 'focus' | 'deep' | null): void;
}
```

### 7.2 Règles

- `selected` et `pinned` sont **indépendants** : un objet peut être pinned sans être selected
- `defocused` (état visuel) = `!selected.includes(id) && !pinned.includes(id) && selected.length > 0`
- `hovered` ne change rien aux états des autres objets, juste l'objet courant
- Quand `selected` change, `focusedDepth` repasse à `'focus'` (sauf si déjà `'deep'` sur le même objet)

## 8. ChatPill flottante (`<SpatialChatPill>`)

Composant **séparé** du ChatDock 2D (pas de refactor du composant verrouillé `chat` v1.0).

### 8.1 Position
- `position: fixed` HUD layer (z-index `SPATIAL_Z_LAYERS.hud`)
- Centre-bas écran (40% from bottom in landscape, 20% in portrait)

### 8.2 Trois états visuels

**État `rest`**
- Barre fine glassmorphism 320px × 4px
- Lueur ambient cyan très faible (opacity 0.15)
- Pas d'input visible

**État `focus`** (clic ou hotkey `/`)
- Se déploie en pill 640px × 56px (motion `power3.out`, 320ms)
- Input + 2 boutons (envoyer, voice)
- Backdrop blur 24px saturate 130%
- Border : `1px solid rgba(255,255,255,0.10)`

**État `typing`**
- Grandit en hauteur si textarea multi-lignes (max 240px)
- Bordure passe à 0.16 (légère intensification)

**État `responding`** (back-end branchera plus tard)
- Pill garde sa forme
- Particules R3F partent de la pill vers l'objet sélectionné dans la scène
- Durée des particules : sync avec stream SSE
- Si pas d'objet sélectionné : particules se dispersent en arc autour de la pill

### 8.3 Comportement
- Clic-extérieur → repli en `rest`
- Échap → repli + blur input
- Submit → log console pour v1 (back-end pas branché), animation particules quand même

## 9. Tokens CSS à créer

À ajouter dans `styles/spatial/spatial.css` sous `:root`.

```css
:root {
  /* États halo */
  --spatial-halo-hover: rgba(255, 250, 240, 0.30);
  --spatial-halo-selected: rgba(255, 255, 255, 0.60);
  --spatial-halo-pinned: rgba(0, 229, 204, 0.50);    /* accent-teal */
  --spatial-halo-error: rgba(217, 168, 108, 0.70);    /* ambre */
  
  /* Élévations Z (utilisées en translateZ + GPU transform) */
  --spatial-elevation-hover: 0.05;
  --spatial-elevation-selected: 0.08;
  
  /* Defocus */
  --spatial-opacity-defocused: 0.4;
  --spatial-saturation-defocused: 0.6;
  
  /* Durées */
  --spatial-duration-hover: 280ms;
  --spatial-duration-focus: 1.8s;
  --spatial-duration-deep: 2.4s;
  --spatial-duration-recul: 1.6s;
  --spatial-duration-cycle: 1.0s;
  --spatial-duration-glance: 1.2s;
  
  /* Easings (correspondant à GSAP) */
  --spatial-ease-cinematic: cubic-bezier(0.65, 0, 0.35, 1);
  --spatial-ease-emerge: cubic-bezier(0.16, 1, 0.3, 1);
  
  /* Pulsation active */
  --spatial-pulse-duration: 1.6s;
  --spatial-pulse-scale-min: 0.98;
  --spatial-pulse-scale-max: 1.02;
}
```

## 10. Plan d'implémentation

### Phase 1 — Spec doc (ce fichier) — ✅ fait
### Phase 2 — Setup R3F + scène fond — 2h
- Remplacer `<SpatialScene>` HTML wrapper par `<Canvas>` R3F
- Ajouter fog + lumières + 2-3 meshes architecturaux massifs
- Ajouter `<EffectComposer>` avec DOF + Bloom + Vignette + Noise
- Caméra FOV 28 + position initiale + lookAt origine
- DustField (50-100 particules)

### Phase 3 — Store + tokens — 1h
- Créer `stores/spatial-selection.ts`
- Créer tokens CSS dans `spatial.css`
- Hook helper `useSpatialEntityState(id)` qui renvoie `{ isHovered, isSelected, isPinned, isDefocused, isActive, isError }`

### Phase 4 — Migrer panels existants en `<Html>` 3D — 3h
- `KPIBento`, `MissionPanel`, `BriefPanel`, `AssetsPanel` → wrap dans `<Html transform occlude>`
- Chaque panel reçoit un `entityId` et applique les états du store
- Tilt 3D HTML → remplacé par tilt mesh natif R3F
- Positionnement Z différencié pour profondeur naturelle

### Phase 5 — Caméra cinématique GSAP — 1.5h
- Hook `useSpatialCamera()` qui écoute `selected[0]` et tween caméra
- DOF dynamique : `focusDistance` recalé sur Z de la sélection
- Recul auto sur unselect

### Phase 6 — Hotkeys + cycle Tab — 1h
- Étendre `SpatialHotkeys` avec Esc, P, Cmd+Enter, Space, Tab, /
- Cycle Tab : récupère liste des `entityId` focusables dans une registry

### Phase 7 — ChatPill flottante — 2h
- Composant `<SpatialChatPill>` 3 états (rest, focus, typing)
- Particules R3F qui partent de la pill (visuel only, pas de back-end)
- Hotkey `/` pour ouvrir

### Phase 8 — Retrait Spline + polish — 1h
- Retirer `<SpatialLogoCore>` (Spline)
- Retirer dep `@splinetool/*` du package.json
- Migrer les bridges `useSplineXxxBridge` → `useSpatialXxxBridge` qui pilotent lumière/dust/caméra natifs
- Tests visuels

**Total estimé : ~12h** (+1h spec = 13h)

## 11. Stages couverts en v1

| Stage | v1 | v2 |
|-------|----|----|
| Cockpit (KPI + Brief + Mission + Assets) | ✓ | — |
| Mission (deep) | ✓ (panel focus) | timeline 3D des runs |
| Asset (deep) | ✓ (panel focus) | cercle variantes 3D |
| Knowledge | — | bibliothèque sphérique |
| Reports | — | galerie 3D |
| Connections | — | constellations |
| Browser | — | portail 2D dans la scène |
| Personas | — | bustes 3D |

## 12. Risques + mitigations

| Risque | Mitigation |
|--------|------------|
| Conflits avec le dev back-end en cours | Spatial reste **isolé** : pas de modif des stores partagés, pas de modif des routes API, pas de nouveaux fetchs. Toute logique métier passe par les hooks existants (à brancher en v1.1). |
| Perf GPU sur Windows / Linux Electron | DPR clamp `[1, 2]`, post-processing optionnel via setting "Qualité spatiale" (high/medium/low) |
| Lecture des panels HTML rendus en 3D | drei `<Html transform>` garde le texte natif HTML → accessibilité préservée, sélectionnable, copiable |
| ChatDock 2D vs ChatPill 3D désynchronisés | Composants séparés mais partagent les mêmes hooks (à venir : `useChatContext`, `useOrchestrate`) |
| Migration Spline → R3F casse les bridges runtime | Bridges réécrits dans la même session pour piloter lumière + dust + caméra natifs |

## 13. Validation visuelle

Pour chaque phase :
- Screenshot Playwright `/spatial` viewport 1440×900
- Comparaison `before` / `after` côte à côte
- Test mouvements caméra (sélection, deep, retour)
- Vérifier 60fps en idle, ≥45fps en transition cinéma

## 14. Hors scope v1

- Toggle 2D ⇄ 3D in-app (attend que back-end finisse + extraction hooks data partagés)
- Modèles 3D détaillés (uniquement formes géométriques abstraites)
- Mode WebXR / VR
- Mode libre / vol libre
- Sons spatialisés
- Voice command natif (déjà géré par VoicePill existant, intégration en v2)
