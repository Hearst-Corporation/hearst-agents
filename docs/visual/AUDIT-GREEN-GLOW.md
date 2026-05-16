# Audit consolidé — "Apple green glow" sur `dashboard-template.html`

**Date** : 2026-05-16
**Auditeur** : Claude (orchestrateur Hearst OS) + 3 agents de recherche web 2025-2026
**Cible** : reproduire le langage visuel "macOS Sequoia / visionOS Tahoe / Apple Intelligence / Liquid Glass" en CSS 2D pur (pas de 3D, pas de WebGL)

---

## 1. Diagnostic — pourquoi le vert ne sort PAS aujourd'hui

État actuel du fichier (après 2 passes du codeur) :

```css
:root { --bg: #030305; --teal: #5EE5C3; }

.amb-halo {
  position: fixed; inset: 0; z-index: 0;
  background: radial-gradient(ellipse 50% 50% at 50% 40%, rgba(74, 139, 134, 0.15), transparent 80%);
  filter: blur(100px);
}

body::after {  /* noise overlay */
  position: fixed; inset: 0;
  z-index: 999;          /* ❌ par-dessus le glow */
  opacity: 0.015;
  background-image: url("data:image/svg+xml,...feTurbulence...");
}
```

**6 bugs cumulés** identifiés par les 3 agents :

| # | Bug | Effet | Source |
|---|-----|-------|--------|
| 1 | **Pas de `mix-blend-mode: screen`** sur les couches lumineuses | Compositing `normal` sur `#030305` écrase les alphas → halo invisible même à 0.30 | Agent Premium Lights |
| 2 | **Alpha 0.15 trop bas** sur le core | Sur fond `#030305`, en dessous de 0.18 le canal vert tombe sous ~11/255 = invisible | Agent Apple Liquid Glass |
| 3 | **Une seule couche** (pas de hiérarchie core/bloom/ambient) | Apple stratifie toujours 3 couches (core net + bloom mid blur + ambient wide blur). Une seule = "spot mou" amateur | Convergence 3 agents |
| 4 | **Pas de `saturate(180-200%)`** après le blur | Le blur Gaussien CSS tue ~40% de la saturation → on récupère du gris-vert au lieu d'un vert pur | Agent Apple Liquid Glass |
| 5 | **Noise overlay en `z-index: 999`** | Le grain par-dessus le glow éteint les hautes lumières. Apple met systématiquement le grain SOUS la lumière | Convergence 3 agents |
| 6 | **Mauvaise teinte** (`rgba(74,139,134,0.15)` = vert-kaki désaturé) | Régression de la 2ème passe du codeur. Token `--teal: #5EE5C3` toujours présent mais plus utilisé pour le halo | Audit code |

**Le bloqueur #1 c'est `mix-blend-mode: screen`. Sans ça, peu importe l'alpha, le halo restera mat.**

---

## 2. Teinte canonique "Apple green" — les hex à connaître

Apple n'a pas UN vert mais une famille. Pour un cockpit "green glow Apple 2026", viser un **duo** :

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **systemGreen (dark mode)** | `#30D158` | `rgb(48, 209, 88)` | Bouton vert Apple officiel iOS/macOS dark |
| **systemGreen (light mode)** | `#34C759` | `rgb(52, 199, 89)` | Variante light |
| **Mint Apple Intelligence** | `#7CFFD4` | `rgb(124, 255, 212)` | Mint chaud Sequoia / halo Siri |
| **Tailwind Emerald 400** | `#34D399` | `rgb(52, 211, 153)` | Compromis Linear/Vercel/Cursor |
| **Tailwind Emerald 300** | `#6EE7B7` | `rgb(110, 231, 183)` | Doux, idéal pour le noyau bloom sur fond sombre |
| **Token actuel Hearst** | `#5EE5C3` | `rgb(94, 229, 195)` | Trop froid + trop pastel, disparaît sur `#030305` |

**Recommandation duo** (pattern Linear/Vercel) :
- **Core** : `#7CFFD4` ou `#A8FFDC` (mint chaud, plus pâle au centre, lisible)
- **Bloom/Ambient** : `#34D399` ou `#30D158` (saturation tenue après blur)

---

## 3. Pattern aurora 2026 — HTML statique copiable

À sauver dans `docs/visual/aurora-hearst-test.html` puis ouvrir dans Chrome pour valider à l'œil avant intégration.

```html
<!doctype html>
<html>
<head>
<style>
:root {
  --bg: #030305;
  --mint-core: #7CFFD4;       /* Apple Intelligence mint chaud */
  --emerald: #34D399;          /* Tailwind emerald-400 — bloom */
  --system-green: #30D158;     /* Apple systemGreen dark — ambient */
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; background: var(--bg); overflow: hidden; }

.stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  isolation: isolate;          /* CRITIQUE : confine les blend-modes */
  overflow: hidden;
}

/* === COUCHE 1 — Mesh ambient large (lumière diffuse) === */
.aurora-mesh {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(60% 50% at 30% 20%, rgba(52, 211, 153, 0.32) 0%, transparent 60%),
    radial-gradient(50% 40% at 80% 90%, rgba(48, 209, 88, 0.22) 0%, transparent 65%);
  filter: blur(120px) saturate(180%);
  mix-blend-mode: screen;       /* additif sur fond noir = CLÉ DU GLOW */
  animation: meshDrift 60s ease-in-out infinite alternate;
  will-change: transform;
}

@keyframes meshDrift {
  0%   { transform: translate(0%, 0%) rotate(0deg) scale(1); }
  50%  { transform: translate(2%, -1%) rotate(2deg) scale(1.05); }
  100% { transform: translate(-1%, 2%) rotate(-1deg) scale(1.02); }
}

/* === COUCHE 2 — Conic rotation lente (Apple Intelligence) === */
.aurora-conic {
  position: absolute;
  inset: -50%;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    rgba(124, 255, 212, 0.18) 80deg,
    transparent 160deg,
    rgba(52, 211, 153, 0.14) 240deg,
    transparent 320deg,
    transparent 360deg
  );
  filter: blur(80px) saturate(160%);
  mix-blend-mode: plus-lighter;
  opacity: 0.9;
  animation: spin 90s linear infinite;
}

@keyframes spin { to { --angle: 360deg; } }

/* === COUCHE 3 — Core net (l'âme du glow) === */
.aurora-core {
  position: absolute;
  top: 18%;
  left: 28%;
  width: 280px;
  height: 280px;
  background: radial-gradient(
    circle,
    rgba(168, 255, 220, 0.45) 0%,
    rgba(124, 255, 212, 0.20) 30%,
    transparent 70%
  );
  filter: blur(24px) saturate(180%);
  mix-blend-mode: plus-lighter;
  animation: coreBreath 9s ease-in-out infinite;
  will-change: transform;
}

@keyframes coreBreath {
  0%, 100% { transform: scale(1)    translateZ(0); }
  50%      { transform: scale(1.08) translateZ(0); }
}

/* === COUCHE 4 — Grain SVG sous le glow === */
.grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size: 200px 200px;
  opacity: 0.035;               /* 3-5% MAX */
  mix-blend-mode: overlay;
  z-index: -1;                  /* SOUS les couches glow */
}

/* === COUCHE 5 — Vignette focus (optionnel) === */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(3,3,5,0.6) 100%);
  pointer-events: none;
}

/* === Contenu lisible par-dessus === */
.content {
  position: relative;
  z-index: 10;
  color: rgba(255, 255, 255, 0.92);
  font: 600 48px/1.2 -apple-system, system-ui;
  display: grid;
  place-items: center;
  height: 100%;
}

/* === SURFACE GLASS DEMO (card par-dessus le glow) === */
.glass-panel {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  padding: 32px 48px;
  box-shadow:
    0 4px 30px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

/* Pickup chromatique vert sur la surface glass */
.glass-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    120% 80% at 30% 0%,
    rgba(124, 255, 212, 0.06) 0%,
    transparent 50%
  );
  border-radius: inherit;
  pointer-events: none;
}
</style>
</head>
<body>
  <div class="stage">
    <div class="grain"></div>
    <div class="aurora-mesh"></div>
    <div class="aurora-conic"></div>
    <div class="aurora-core"></div>
    <div class="vignette"></div>
    <div class="content">
      <div class="glass-panel">Hearst OS</div>
    </div>
  </div>
</body>
</html>
```

### Les 6 invariants qui rendent ce pattern "Apple"

1. **`isolation: isolate`** sur la stage → confine les blend-modes, sinon ils fuient.
2. **`mix-blend-mode: screen` / `plus-lighter`** sur les couches lumineuses → additif sur noir = glow visible même à faibles alphas. **C'est LE déblocage.**
3. **Stack 3 couches** (mesh wide blur 120px + conic rotatif blur 80px + core net blur 24px) → hiérarchie Apple, pas un blob amateur.
4. **`saturate(160-200%)`** après chaque blur → compense la perte de chroma du Gaussien.
5. **`@property --angle`** + animation conic-gradient → interpolation propre, pas de saut.
6. **Grain en `z-index: -1`** sous les glows, `opacity: 0.035`, `mix-blend-mode: overlay` → casse le banding sans tuer la lumière.

---

## 4. Anti-patterns à fuir

| Anti-pattern | Pourquoi | Fix |
|--------------|----------|-----|
| Alpha < 0.15 sur le core | Canal vert tombe sous 11/255 = invisible | Core ≥ 0.25, ambient ≥ 0.15 |
| 1 seule couche radiale | Pas de hiérarchie → spot mou | Toujours 3 couches min |
| `blur(80px)` sans `saturate()` | Tue 40% de la saturation → gris-vert | `blur(X) saturate(160-200%)` |
| Noise au-dessus à opacity 0.1+ | Éteint les chromas additifs | Noise SOUS, opacity ≤ 0.05, overlay |
| `mix-blend-mode` sans `isolation: isolate` | Les blend modes fuient sur les parents | Wrapper avec isolation |
| Animer `opacity` du halo | Pulse jouet 2018, anti-luxe | Animer `transform` ou `background-position` |
| Hex pur saturé `#00FF88` | Trop vif, casse le luxe sourd | Duo : core pâle/chaud + ambient saturé |
| `background-color` opaque sur glass | Tue le pickup chromatique | `rgba(255,255,255,0.04)` max |
| Animation < 8s | Site crypto 2021 | 40-80s minimum, ease-in-out ou linear |

---

## 5. Composants drop-in ready (si on veut éviter de coder)

| # | Composant | URL | Verdict |
|---|-----------|-----|---------|
| 1 | **React Bits Aurora** | https://www.reactbits.dev/backgrounds/aurora | **TOP 1** — emerald + teal flow, CSS only 60fps, install shadcn |
| 2 | **Aceternity Aurora Background** | https://ui.aceternity.com/components/aurora-background | Production-ready, animation 60s, le plus copié |
| 3 | **21st.dev Ambient Aurora** | https://21st.dev/community/components/dhileepkumargm/ambient-aurora | Drifting orbs, subtil pour cockpit |
| 4 | **LunarLogic/auroral** (CSS pur, MIT) | https://github.com/LunarLogic/auroral | Drop-in CSS sans React, 6 presets, palette northern matche exactement notre besoin |
| 5 | **LogRocket Liquid Glass SVG filter** | https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/ | Pour les CARDS Stage (réfraction réelle iOS 26). Fallback Safari requis |

---

## 6. Patch chirurgical pour `dashboard-template.html`

Ordre d'exécution (chaque patch testable indépendamment).

### Patch 1 — Bypass auto du login (DX)

Ajouter en haut du `<script>` existant, ou inline en début de body :

```js
// Auto-bypass si on arrive directement sur une route dashboard
if (location.hash && location.hash !== '#login') {
  document.getElementById('login-view').style.display = 'none';
}
```

### Patch 2 — Tokens couleur hiérarchisés

Dans `:root`, remplacer/ajouter :

```css
--mint-core: #7CFFD4;
--emerald-bloom: #34D399;
--system-green: #30D158;
--teal: #5EE5C3;                          /* conservé pour pulse status / badges existants */
--glow-core: rgba(124, 255, 212, 0.45);
--glow-bloom: rgba(52, 211, 153, 0.22);
--glow-ambient: rgba(48, 209, 88, 0.18);
--glow-rim: rgba(124, 255, 212, 0.06);
```

### Patch 3 — Ambient layer 3 couches (le cœur du fix)

Remplacer l'unique `.amb-halo` + `.amb-dots` actuels par :

```html
<!-- dans chaque scene -->
<div class="amb-mesh"></div>
<div class="amb-conic"></div>
<div class="amb-core"></div>
<div class="amb-dots"></div>
```

CSS :

```css
.scene { isolation: isolate; }  /* CRITIQUE */

.amb-mesh {
  position: fixed; inset: -20%; z-index: 0; pointer-events: none;
  background:
    radial-gradient(60% 50% at 30% 20%, var(--glow-bloom) 0%, transparent 60%),
    radial-gradient(50% 40% at 80% 90%, var(--glow-ambient) 0%, transparent 65%);
  filter: blur(120px) saturate(180%);
  mix-blend-mode: screen;
  animation: ambMesh 60s ease-in-out infinite alternate;
}

@keyframes ambMesh {
  0%   { transform: translate(0%, 0%) rotate(0deg) scale(1); }
  50%  { transform: translate(2%, -1%) rotate(2deg) scale(1.05); }
  100% { transform: translate(-1%, 2%) rotate(-1deg) scale(1.02); }
}

@property --angle {
  syntax: "<angle>"; initial-value: 0deg; inherits: false;
}

.amb-conic {
  position: fixed; inset: -50%; z-index: 0; pointer-events: none;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    rgba(124, 255, 212, 0.18) 80deg,
    transparent 160deg,
    rgba(52, 211, 153, 0.14) 240deg,
    transparent 320deg
  );
  filter: blur(80px) saturate(160%);
  mix-blend-mode: plus-lighter;
  opacity: 0.9;
  animation: ambSpin 90s linear infinite;
}

@keyframes ambSpin { to { --angle: 360deg; } }

.amb-core {
  position: fixed; top: 18%; left: 28%; z-index: 0; pointer-events: none;
  width: 320px; height: 320px;
  background: radial-gradient(circle, var(--glow-core) 0%, rgba(124, 255, 212, 0.20) 30%, transparent 70%);
  filter: blur(24px) saturate(180%);
  mix-blend-mode: plus-lighter;
  animation: ambBreath 9s ease-in-out infinite;
}

@keyframes ambBreath {
  0%, 100% { transform: scale(1) translateZ(0); }
  50%      { transform: scale(1.08) translateZ(0); }
}

.amb-dots {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1.5px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at 50% 40%, black 20%, transparent 80%);
  -webkit-mask-image: radial-gradient(circle at 50% 40%, black 20%, transparent 80%);
}
```

### Patch 4 — Noise SOUS le glow

Modifier `body::after` :

```css
body::after {
  content: "";
  position: fixed; inset: 0;
  z-index: -1;                /* SOUS la scène, pas par-dessus */
  pointer-events: none;
  opacity: 0.035;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,...feTurbulence baseFrequency='0.85' numOctaves='2'...");
}
```

Et s'assurer que `.scene` ait `z-index: 0` ou un background transparent pour que le noise passe à travers.

### Patch 5 — Reflets teintés sur `.vision-glass`

```css
.vision-glass {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.14);   /* Fresnel highlight */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 20px;
  box-shadow:
    0 4px 30px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    inset 0 0 40px var(--glow-rim);                   /* pickup vert subtil */
}

.vision-glass::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(120% 80% at 30% 0%, var(--glow-rim) 0%, transparent 50%);
  border-radius: inherit;
  pointer-events: none;
}
```

### Patch 6 — Revert régressions couleur de la 2ème passe

```css
@keyframes pulseT {
  0%, 100% { box-shadow: 0 0 0 0 rgba(94, 229, 195, 0); }
  50%      { box-shadow: 0 0 0 8px rgba(94, 229, 195, 0.25); }
}

@keyframes pulseG {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229, 195, 94, 0); }
  50%      { box-shadow: 0 0 0 8px rgba(229, 195, 94, 0.18); }
}

.slot .bg.v3 { background: linear-gradient(135deg, #34d2be, #2a91ff 60%, #6b53ff); }
```

Et restaurer le button BYPASS DEV en gold (`rgba(229,195,94,.12)` + `var(--gold)`).

---

## 7. Réponse à la proposition "thème clair" de Gemini

**Position** : techniquement valide mais résout le mauvais problème.

1. Le bug actuel n'est pas que le fond est trop sombre. C'est l'absence de `mix-blend-mode: screen` + une stack à une seule couche + alpha sous-dosé + noise mal positionné. Sur `#030305` avec un blend mode additif, un halo `rgba(94,229,195,0.18)` devient parfaitement visible et soyeux. C'est ce que font Vercel, Linear, Cursor, Aceternity, React Bits, Auroral.

2. Aller clair = pivot identité de 3-5 jours + perte des tokens couleur sémantiques (teal/gold/danger) qui structurent la hiérarchie d'attention du cockpit. CLAUDE.md dit explicitement "L'app est dark mode unique — pas de light mode, pas de toggle theme."

3. Le segment "cockpit AI 2026" (Linear, Vercel, Cursor, Raycast, v0, Bolt, Granola, Replit, Lovable, Claude.ai, ChatGPT) est intégralement sombre. Apple lui-même fait visionOS Home View et Apple Intelligence sombres sur les surfaces compute. Le clair Apple est sur les surfaces transactionnelles (Settings, App Store, Pages).

4. La proposition supprime de fait toute couleur d'accent ("le tout sans aucune couleur d'accent"). Sur un dashboard utilisé 8h/jour, c'est mortel : l'œil n'a plus rien à accrocher pour distinguer un agent live, une mission needs-approval, un asset ready.

**Décision recommandée** : on garde le fond sombre actuel `#030305` et on applique le patch chirurgical ci-dessus. Test visuel sur le HTML statique section 3 avant intégration au template.

---

## 8. Ordre d'exécution conseillé

1. **Patch 1** (bypass auto) — 1 ligne, débloque l'itération
2. **Patch 2** (tokens) — base sémantique
3. **Patch 3** (3 couches ambient + isolation + screen) — **C'EST LÀ qu'on gagne le glow Apple**
4. **Patch 4** (noise sous) — débloque la visibilité du glow
5. **Patch 5** (rim teinté glass) — la touche finale qui vend la profondeur
6. **Patch 6** (revert régressions) — recouvre les chaudes (gold, teal localisés)

Screenshot avant/après chaque patch. Test sur `#home`, `#chat`, `#mission`.

---

## 9. Sources principales

- [Sarunw — Apple system colors dark/light hex officiels](https://sarunw.com/posts/dark-color-cheat-sheet/)
- [Manav Kaushal — Engineering Behind Apple Liquid Glass](https://medium.com/@manavkaushal756/engineering-behind-apple-liquid-glass-ui-fb51b1d599ad)
- [Kevin Bism — Recreating Apple's Liquid Glass with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
- [Josh Comeau — Next-level frosted glass with backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/)
- [Aceternity UI — Aurora Background](https://ui.aceternity.com/components/aurora-background)
- [React Bits — Aurora](https://www.reactbits.dev/backgrounds/aurora)
- [Albert Walicki — Aurora UI tutorial](https://albertwalicki.com/blog/aurora-ui-how-to-create)
- [LunarLogic — Auroral CSS library](https://github.com/LunarLogic/auroral)
- [Dalton Walsh — Aurora CSS Background Effect](https://daltonwalsh.com/blog/aurora-css-background-effect/)
- [LogRocket — Liquid Glass with CSS+SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- [Apple Intelligence Glow Effect — GitHub](https://github.com/jacobamobin/AppleIntelligenceGlowEffect)
- [CSS-Tricks — Grainy Gradients](https://css-tricks.com/grainy-gradients/)
- [MDN — mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode)
- [21st.dev Ambient Aurora](https://21st.dev/community/components/dhileepkumargm/ambient-aurora)
- [CodePen Apple Intelligence glow (Bastien D.)](https://codepen.io/Bastien-D/pen/jOoGMrM)
- [CodePen Glowing Background Balls (walpolea)](https://codepen.io/walpolea/pen/ZERZOaB)
