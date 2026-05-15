# Grammaire visuelle — Dribbble George Railean "AI Command Line to Dashboard"

Source : 50 frames extraites de la vidéo (`docs/visual/refs/frames/f01-f50.png`),
shot 26648227, designer George Railean / Fuselab Creative.

But : extraire la grammaire pour informer le langage visuel du lab `cli-os`,
**sans copier** — on prend les principes structurants, on adapte la palette à Hearst.

---

## 1. Vue d'ensemble — ce que raconte le shot

Le shot raconte une seule histoire en 23 s : **un dashboard fund analytics est manipulé**
par un assistant IA. La caméra zoome sur des micro-interactions (toggle Assets/Funds,
treemap qui se reconstruit, donut animé, switch dark/light) plutôt qu'une "transition
CLI → Dashboard" littérale. Le "command line" du titre = les **chips d'actions en bas**
("Summarize", "Explain key comparisons", "Describe top funds") qui sont les invocations
sémantiques de l'IA.

Deux thèmes : **dark** (~70 % du shot) et **light** (~30 %, scène Activities). On garde
**dark only** pour Hearst — cf CLAUDE.md, dark mode unique.

---

## 2. Palette extraite (dark theme)

```
Background        #000000  (pur)
Surface elev      #0a0a0a → #0d0d0d
Border subtle     rgba(255,255,255, 0.06–0.10)
Text primary      #f5f5f5 → #ffffff
Text secondary    rgba(255,255,255, 0.55)
Text muted        rgba(255,255,255, 0.28)
Text faint        rgba(255,255,255, 0.15)

— Accent signal (news / hot info)
Amber-orange      #ff7a59 → #fb923c   (utilisé sur titres news droite)

— Palette catégorielle (donut/treemap, 6 segments)
Pink              #ec4899
Blue              #3b82f6
Purple            #8b5cf6
Cyan              #06b6d4
Orange            #fb923c
Gray-cool         #94a3b8

— Badge "Mutual fund"
Purple soft       rgba(124, 58, 237, 0.15) + texte #c4b5fd
```

**Reco Hearst** : on garde **dark + 1 accent signal** mais on remplace `#ff7a59`
(connoté finance / Fuselab) par `#c2f0ff` ou `#7dd3fc` (teinte glacée, plus OS / luxe).
La palette catégorielle multi-couleurs **ne s'applique pas** à Hearst — chez nous les
agents/missions/assets n'ont pas besoin d'un code couleur par type. Restons monochrome
+ accent.

---

## 3. Typographie

```
Font family       Humanist sans, géométrique, ouvertures arrondies.
                  Probablement Geist Sans ou Inter (tabular nums sur chiffres).
                  → Hearst conserve Satoshi côté prod, mais le lab démarre
                    sur Geist (gratuit, proche du shot, neutre).

Échelle observée :
                  Big number       48px / 600 / -0.02em
                  H1 page          32px / 500 / -0.015em
                  H2 section       20px / 500 / -0.01em
                  Body             15px / 400 / 0em
                  Label            13px / 500 / 0em / tracking 0.01em
                  Caption          11px / 500 / uppercase / tracking 0.08em

Couleurs typo :
                  Title white      #f5f5f5
                  Big number       #ffffff
                  Body             text-secondary
                  Label discret    text-muted
                  Accent (rare)    #ff7a59 — uniquement news hot
```

---

## 4. Layout — ratios observés

Viewport ~1440 px de référence. Le dashboard est **centré, avec énorme respiration**
latérale :

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌──┐                                              ┌──┐  ┌────────┐ │
│  │  │                                              │  │  │ ☀ ☾   │ │ ← theme pill top-right
│  │  │   ┌──────────────────────────────────────┐  │  │  └────────┘ │
│  │N │   │                                      │  │N │             │
│  │a │   │   Fidelity and T. Rowe Price funds   │  │e │  News rail  │
│  │v │   │   ▸ Mutual fund                      │  │w │  ◦ Item 1   │
│  │  │   │                                      │  │s │  ◦ Item 2   │
│  │  │   │   ▾ Summary description              │  │  │  ◦ Item 3   │
│  │  │   │                                      │  │  │             │
│  │  │   │   Lorem ipsum body 3 lines…          │  │  │             │
│  │  │   │                                      │  │  │             │
│  │  │   │   Asset & Fund Overview      ┌──┬──┐ │  │  │             │
│  │  │   │                              │AA│FD│ │  │  │             │
│  │  │   │                              └──┴──┘ │  │  │             │
│  │  │   │                                      │  │  │             │
│  │  │   │       ┌──────┐                       │  │  │             │
│  │  │   │       │ 7.88B│   • 13.45% Domestic   │  │  │             │
│  │  │   │       │donut │   • 12.17% Foreign    │  │  │             │
│  │  │   │       └──────┘   • 19.4%  Cash       │  │  │             │
│  │  │   │                  …                    │  │  │             │
│  │  │   │                                      │  │  │             │
│  │  │   └──────────────────────────────────────┘  │  │             │
│  │  │                                              │  │             │
│  └──┘                                              └──┘             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ⌘ Analysis    [Summarize] [Explain…] [Describe…]  [Report]  │    │ ← footer chips
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

Ratios approximatifs :
- **Left rail** : 56 px, fixed.
- **Right news rail** : 200 px, fixed.
- **Centre content** : ~720 px max-width, marges fluides.
- **Padding extérieur** : 64-80 px horizontal.
- **Rythme vertical** : 24/32/48 px entre sections.
- **Footer chips bar** : ~52 px hauteur, full-width interne, rounded-pill conteneur.
- **Donut diamètre** : ~280 px, soit ~40 % de la largeur centre.

---

## 5. Motifs récurrents (les "primitives" du shot)

### 5.1 Toggle pill segmenté

```
┌─────────────────────────────────┐
│  [Assets Allocation]  Fund Dist │  ← selected = solid white-95%, dark text
└─────────────────────────────────┘     unselected = transparent, white-dim
```

- Conteneur pill, fond ~rgba(255,255,255, 0.05), border 0.
- Item selected : fond #f5f5f5, texte #0a0a0a, shadow inset très subtil.
- Switch animé : spring (overshoot 6 %, ~280 ms).

### 5.2 Row legend (donut)

```
●  13.45%  Domestic Stock
```

- Pill horizontal full-width, ~36 px haut, rounded-full.
- Fond : gradient subtil de gauche (rgba(255,255,255,0.04)) → transparent.
- Border 1 px rgba(255,255,255, 0.06).
- Dot : 4 px, couleur de la catégorie.
- `%` en weight 600 #fff, label en weight 400 text-secondary.

### 5.3 Footer action chips

```
⌘ Analysis      Summarize    Explain key comparisons    Describe top funds      [Report] [Chat]
                                                                                  ↑ légèrement plus opaque
```

- Hauteur ~24 px, padding 8/16, rounded-full.
- Fond default : transparent.
- Texte 13 px, text-secondary.
- "Report" / "Chat" : fond rgba(255,255,255, 0.05), légère élévation.
- Hover : fond rgba(255,255,255, 0.04).
- À gauche : breadcrumb "⌘ Analysis" qui signale le mode actif.

### 5.4 Donut centre

```
       ┌──────────────┐
      /                \
     /     ┌──────┐     \
    │      │ 7.88B│      │
    │      │ Total│      │
    │      └──────┘      │
     \                  /
      \                /
       └──────────────┘
```

- Outer ring : segments multi-couleurs, gap ~2 deg entre segments.
- Inner ring trace : 1 px rgba(255,255,255, 0.08), comme une orbite fantôme.
- Center : nombre 48 px / 600 + label 13 px text-muted.

### 5.5 Treemap

- Grille de rectangles, radius 14-16 px.
- Padding intérieur 14/20.
- Title petit 11 px text-muted (en haut-gauche).
- Big number 28-32 px (en bas-gauche).
- Ticker badge en bas-droite, rounded-md, fond surface elev.
- Couleurs : nuances de purple/blue dominantes, avec accents pink/cyan.

### 5.6 Theme toggle pill

```
┌──────────┐
│ ☀  ●  ☾  │   thumb white sur côté actif
└──────────┘
```

- ~120 px de large, hauteur ~36 px.
- Thumb : circle blanc, smooth glide.
- Halo ripple à la transition (concentric arcs ~400 ms).

### 5.7 Badge catégorie

```
▸ Mutual fund
```

- Pill, fond rgba(124, 58, 237, 0.15), texte #c4b5fd, 13 px weight 500.
- Icône emoji ou symbol à gauche.

---

## 6. Hiérarchie d'information (ce qui crie / ce qui chuchote)

| Niveau | Élément | Volume visuel |
|---|---|---|
| 1 — crie | Big number donut (7.88B) | 48 px white pur |
| 1 | Title page (Fidelity…) | 32 px white-95 |
| 2 — parle | Section headers (Asset & Fund Overview) | 20 px white-90 |
| 3 — informe | Body paragraphs | 15 px text-secondary |
| 4 — accompagne | Legend rows (13.45% label) | 13 px mixed weights |
| 5 — chuchote | Captions, breadcrumb, hotkey hints | 11-13 px text-muted |
| 6 — signal | News title hot (orange) | 13 px #ff7a59 |

**Principe d'or** : au plus 3 niveaux concurrents visibles dans un même viewport. Le reste
doit chuchoter ou disparaître.

---

## 7. Séquence chronométrée (récit du shot)

```
0–2 s    Dashboard repos, donut + legend
2–4 s    Zoom sur toggle Assets/Funds — focus micro-interaction
4–6 s    Toggle switche → donut fade out, treemap fade in (cross-fade ~600 ms)
6–9 s    Treemap fully assembled, stagger spring-grow cards
9–12 s   Zoom out, full dashboard avec treemap
12–14 s  Light theme variant (même layout)
14–18 s  Cut → scène Activities (cards "Hey Sophia", stats, Pinned items)
18–23 s  Theme toggle animation, donut se redessine en dark
```

**Insight** : le shot **ne raconte pas** une transition "CLI vide → Dashboard plein". Il
raconte une **manipulation continue** d'un dashboard déjà chargé. La "command line" est
incarnée par la **footer chips bar** — la ligne d'invocation IA est intégrée au dashboard
en bas, pas isolée en intro.

→ **Pour Hearst** : le cockpit ne doit pas faire de "splash CLI vide qui se déploie". Il
doit **partir d'un état dashboard sobre déjà chargé**, avec une ligne d'invocation
permanente en bas. La sobriété vient de la respiration et de la palette monochrome, pas
d'un état "vide".

---

## 8. Motion — chronométrages observés

| Action | Durée | Easing |
|---|---|---|
| Toggle Assets/Funds switch | 280 ms | spring overshoot 6 % |
| Donut segments draw stagger | 50 ms entre segments, 600 ms total | ease-out-cubic |
| Treemap cards spring grow | scale 0.7 → 1, 320 ms, stagger 40 ms | spring damping 18 |
| Theme toggle halo ripple | 400 ms, 3 arcs concentriques | ease-out-expo |
| Dashboard fade in (initial) | 400 ms, opacity 0 → 1, y +12 → 0 | ease-out |
| Hover chips footer | 120 ms | ease-out |

**Principe** : tout ce qui change d'état le fait avec **spring**, jamais en linear / ease.
Le rythme est rapide (200-400 ms) mais avec un overshoot tiny qui donne du "poids".

---

## 9. Ce qu'on prend / ce qu'on jette pour Hearst

| ✅ On prend | ❌ On jette |
|---|---|
| Background pur #000, respiration radicale | Palette catégorielle multi-couleurs |
| Hiérarchie 3 niveaux max par viewport | Big number 48 px partout (pas de chiffres KPI à crier dans Hearst) |
| Pill segmented toggle | Light theme (Hearst = dark only) |
| Footer chips d'actions IA permanent | Orange amber #ff7a59 (on cherche une teinte cool) |
| Row legend gradient subtil | Donut + treemap (Hearst ne fait pas du fund analytics) |
| Spring motion 280-400 ms partout | Theme toggle (Hearst = dark only, pas de toggle) |
| 1 seul accent signal | Avatar en haut-gauche (Hearst pousse l'agent au centre) |
| Breadcrumb mode (⌘ Analysis) bottom-left | News rail droite (Hearst remplace par missions actives) |

---

## 10. Tokens à proposer pour le lab

```ts
// Couleurs
--color-bg:           #000000;
--color-bg-elev-1:    #0a0a0a;
--color-bg-elev-2:    #111111;
--color-border:       rgba(255, 255, 255, 0.07);
--color-border-soft:  rgba(255, 255, 255, 0.04);
--color-ink:          #f5f5f5;
--color-ink-strong:   #ffffff;
--color-fg-dim:       rgba(245, 245, 245, 0.55);
--color-fg-mute:      rgba(245, 245, 245, 0.28);
--color-fg-faint:     rgba(245, 245, 245, 0.14);

// 1 accent signal — à valider visuellement
--color-accent:       #c2f0ff;          // glace bleutée, alt cool
// ou
--color-accent-alt:   #ffd9c2;          // peau d'orange, alt chaud (proche shot mais désaturé)

// Typo
--font-sans:          "Geist Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono:          "Geist Mono", ui-monospace, monospace;

// Échelle
--text-cap:           11px;
--text-sm:            13px;
--text-base:          15px;
--text-md:            20px;
--text-lg:            32px;
--text-xl:            48px;

// Espacements
--space-1:            4px;
--space-2:            8px;
--space-3:            12px;
--space-4:            16px;
--space-5:            20px;
--space-6:            24px;
--space-8:            32px;
--space-12:           48px;
--space-16:           64px;
--space-20:           80px;

// Radius
--radius-xs:          4px;
--radius-sm:          8px;
--radius-md:          12px;
--radius-lg:          16px;
--radius-xl:          20px;
--radius-pill:        9999px;

// Motion
--ease-spring:        cubic-bezier(0.34, 1.56, 0.64, 1);   // overshoot léger
--ease-out:           cubic-bezier(0.22, 1, 0.36, 1);
--duration-fast:      120ms;
--duration-base:      280ms;
--duration-slow:      400ms;
```

---

## 11. Implications pour le cockpit Hearst

Sur la base de cette grammaire, la première page du cockpit Hearst devrait :

1. **Démarrer chargé**, pas vide. État repos = sessions visibles + ligne d'invocation
   permanente en bas + 1-2 panneaux d'info sobres au centre. PAS de splash CLI.
2. **Respirer radicalement** : padding extérieur 64-80 px, max-width centre 720-880 px.
3. **3 niveaux d'info max** visibles à un moment donné. Le reste chuchote ou disparaît.
4. **Footer chips d'actions IA permanent**, bottom-centered. C'est notre "command line".
5. **Left rail très mince** (~56 px) pour navigation Stages ⌘1-9, icônes seulement.
6. **Right rail mince** (~200 px) qui devient le slot pour missions actives /
   sessions récentes (équivalent du news rail Dribbble).
7. **1 seul accent** dans tout le viewport. Tout le reste = nuances de blanc sur noir.
8. **Spring motion partout**, 280-400 ms, jamais de linear.

C'est le point de départ pour `RestScene` (la première scène du lab) — on plante ces
ratios, ces tokens, ce footer, et on itère.
