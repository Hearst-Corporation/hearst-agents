# Audit UI minimaliste — Hearst OS

**Date :** 2026-05-15
**Auditeur :** Claude (Opus 4.7) — angle UI/visuel pur
**Cible visée :** "AI Command Line to Dashboard" — input central unique au repos, panneaux invocables, palette sourde, sessions discrètes.

---

## État des lieux (≤ 5 lignes)

L'app porte un cockpit 3 colonnes (PulseBar + TimelineRail + Stage + ContextRail + StageFooter + ChatDock) avec **4 couches `.shell-card` superposées** dans `app/(user)/layout.tsx` — chacune avec border + radius + shadow — qui empilent visuellement le chrome au lieu de l'effacer. Le cockpit mode ouvre directement sur l'OrbitalView (constellation 6 nodes + cœur halo) avec ChatDock toujours visible : l'input n'est jamais seul à l'écran, et le PulseBar pousse un Cmd+K pill *plus* 4 quick-actions *plus* compteur services *plus* notif bell. La voix éditoriale 2026-04-29 est partiellement transgressée (mono caps font-mono uppercase dans /admin et reports, labels anglais Online/Connecting/Running dans StageFooter, halo violet `--accent-llm` sur le thread actif en TimelineRail, neon-glow textShadow sur hover du chrome top-menu). Les tokens existent à profusion (318+) mais les écrans clé (`ThreadRow`, `RailHeader`, `OrbitalNode`) court-circuitent via inline `rgba(255,255,255,X)` hardcodés. La TimelineRail mélange brand teaser ("halo" violet rotatif en header) et conversations passées — la promesse "conversations only style ChatGPT/Claude" n'est pas tenue visuellement.

---

## Findings prioritaires

### [P0] [M] Quatre coquilles superposées dans le shell layout — `app/(user)/layout.tsx:108-187`

Le `UserLayout` empile : 1× `shell-card` autour de la PulseBar (l.108), 1× `shell-rail` gauche (l.133), 1× `shell-card` central (l.146), 1× `shell-rail` droite (l.167), 1× `shell-card` footer (l.185). Chaque `.shell-card` applique `border + radius-lg + shadow-card`. Résultat : 5 bords visibles + 5 ombres + 5 rayons sur le shell, chrome qui domine au lieu de s'effacer. Anti-pattern direct vs cible "AI Command Line to Dashboard".

**Proposition :** un seul container `.shell-bg` (le viewport, déjà présent l.95). PulseBar et StageFooter deviennent des `<header>` / `<footer>` à plat sur le bg, séparés par `--sep` 1px horizontal. Rails et Stage flottent dans un grid 3 colonnes sans cards encapsulantes — leurs surfaces internes restent translucides via `--surface-1`.

```
Avant                          Après
┌─[card]────────────────┐      ─────────── PulseBar (sep)
├─[rail]┬[card]┬[rail]──┤      Rail  │  Stage  │  Rail
└─[card]┴──────┴────────┘      ─────────── StageFooter
```

---

### [P0] [S] CockpitStage = constellation lourde + ChatDock présent — `app/(user)/components/cockpit/orbital/CockpitOrbitView.tsx:14-173`

Mode "cockpit" rend 6 OrbitalNode (carrés 110×80 avec bg/border/dot/icon/label/subInfo), un OrbeCentral 200×200 (anneau + dashed + corps + 4 particules, 3 animations infinite), des lignes de connexion absolute positionnées, un OrbitalQuickActions (5 pills), un OrbitalGreeting (h1 t-32 + sous-titre + 2 gradients radial/linear + animation fade-in)… puis le ChatDock plein-largeur en bas. **L'écran d'arrivée n'est jamais "input central, presque rien d'autre"** — c'est un dashboard saturé avec 6+ animations infinite simultanées (`pulse-breath`, `rotate-slow-clockwise` × 2, `orbe-particle`, `animate-fade-in-slide-up-subtle`).

**Proposition :** au repos, le mode cockpit rend UNIQUEMENT (a) un greeting one-liner pâle en haut centre `t-15 text-faint`, (b) le ChatDock élargi centré verticalement `max-w-input`, (c) éventuellement 3-4 quick-pills sourdes EN-DESSOUS de l'input style raccourcis. La constellation devient une vue secondaire `/cockpit/orbital` ou un Stage explicite (Cmd+K → "Constellation"), pas la home.

```
Avant cockpit home                    Après cockpit home
═══════════════════════════           ═══════════════════════════
   PulseBar                              PulseBar (minimal)
   ────────────────                      
   "Bonjour, Adrien."                    
       Voici ce qui se passe.            
   ▢ Gmail   ▢ Notion                    
        \\     /                          
         ⊙ (rotating)                      Bonjour Adrien.
        /     \\                       ┌─────────────────────────┐
   ▢ Drive    ▢ Calendar              │ Demande à Hearst…       │
                                       └─────────────────────────┘
   [Obtenir mon brief] [Analyser…]        Brief · Mission · Suivi
   ───────────────────                   
   ChatDock plein largeur                
═══════════════════════════           ═══════════════════════════
```

---

### [P0] [S] TimelineRail header = teaser brand violet rotatif — `app/(user)/components/timeline-rail/RailHeader.tsx:36-49`

En mode expanded, le header rend un cercle violet `rgba(167, 139, 250, 0.3-1)` avec border-top opaque rotaté -45° + box-shadow neon violet + texte "halo" en t-20. **C'est un teaser de rebrand violet sur le rail "conversations" qui devrait être discret façon ChatGPT/Claude.** Le RailHeader.tsx contient le commentaire « Invariant I-10 : logo Hearst intouchable » mais affiche autre chose que `<HearstLogo />`. Magic numbers inline RGB partout (l.32, 42-46, 47).

**Proposition :** revenir à `<HearstLogo />` sobre OU réduire à un simple `H` t-15 `text-soft` aligné gauche, comme Linear/Claude. Le rail conversations doit s'effacer — pas porter un teaser brand.

---

### [P0] [M] PulseBar saturée — 4 quick actions + Cmd+K + signaux + run + voix + services + bell — `app/(user)/components/PulseBar.tsx:177-405`

À droite, on a en même temps : pill Cmd+K central plein-largeur, AmbientWhisper (md:flex), badge "En cours" si run, badge "Voix" si voiceActive, compteur "N / M services", 4 quick-action icons (video/focus/signal/hearst-card), NotificationBell. Le header annoncé `≤ 56px, minimaliste Linear/Cursor/Vercel` (l.7 docblock) est devenu une barre d'instruments. Les 4 PulseBarQuickActions (l.321-405) sont des features hotkey-only "discoverability" — exactement le bruit qu'on cherche à enlever pour la cible Command Line.

**Proposition :** PulseBar redevient 3 zones strictes — gauche : SpaceSelector seul ; centre : RIEN (Cmd+K est dans le Stage) ; droite : NotificationBell + avatar. Les 4 quick-actions disparaissent (ils vivent déjà dans le Commandeur Cmd+K). L'AmbientWhisper devient une ligne sous l'input central au lieu de squatter le header.

---

### [P1] [S] ThreadRow utilise `--accent-llm` violet sur l'état actif au lieu de teal — `app/(user)/components/timeline-rail/ThreadRow.tsx:38-50`

L'icône active du thread est en `var(--accent-llm)` (violet `#a78bfa`) avec halo violet `box-shadow: 0 0 12px color-mix(--accent-llm 80%)`. Le commentaire CLAUDE.md règle 3 du pivot 2026-05-01 « accent-teal pour les états système (focus, hover, run actif, voice actif, **sélection**) ». Le thread sélectionné = sélection système → devrait être teal. La row utilise aussi 6× `rgba(255,255,255,X)` inline (l.28-29, 49, 58, 71, 83) au lieu de tokens.

**Proposition :** swap `--accent-llm` → `--accent-teal`, ramener à 1 dot `w-1.5 h-1.5` simple (drop le wrapper 24×24 + halo épais), remplacer tous les inline rgba par tokens (`--bg-elev`, `--surface-1`, `--text-soft`, `--text-faint`, `--border-soft`). `bg-[rgba(...)]` → `bg-(--bg-elev)`.

---

### [P1] [S] TopMenuItem applique `textShadow: --neon-accent-teal` sur hover du chrome — `app/(user)/components/timeline-rail/TopMenuItem.tsx:57`

Le commentaire l.5 dit « Pas de halo-on-hover sur le chrome » mais la ligne 57 fait `textShadow: highlight ? "var(--neon-accent-teal)" : "none"` où `highlight = isActive || hover`. Donc halo neon au hover sur des items de nav (Home, Apps, Chat) — viole frontalement la règle voix éditoriale 2026-04-29.

**Proposition :** garder le changement de couleur teal au hover, retirer `textShadow`. État actif = `font-medium` + color teal seule. Pas de glow.

---

### [P1] [S] StageFooter labels en anglais + voix technique — `app/(user)/components/StageFooter.tsx:18-25`

`STATE_MAP` rend : "Online", "Connecting", "Running", "Processing", "Approval required", "Clarification required", "Error". Voix éditoriale 2026-04-29 demande FR régulier ("Réussi" / "Échec" / "En cours"). Le footer est continu sous le Stage, donc visible en permanence — c'est un brisure de voix permanente.

**Proposition :**

```ts
idle:                   "Disponible"     (au lieu de "Online")
connecting:             "Connexion"
streaming:              "En cours"       (déjà utilisé dans PulseBar)
processing:             "Traitement"
awaiting_approval:      "En attente"
awaiting_clarification: "Précision demandée"
error:                  "Erreur"
```

`actionLabel` : "Réinitialiser" / "Annuler" / "Arrêter" — déjà FR, garder.

---

### [P1] [S] RunTimeline badges mono caps abrégés "OK / Attn / Err" — `app/(user)/components/RunTimeline.tsx:18-23`

`SEVERITY_BADGE = { info: "Info", success: "OK", warning: "Attn", error: "Err" }`. Mono caps abrégés bannis par la voix éditoriale.

**Proposition :** `{ info: "Info", success: "Réussi", warning: "Attention", error: "Erreur" }`. Si la largeur pose problème dans la timeline, garder seulement un dot coloré sans label texte.

---

### [P1] [S] ChatStage : strings anglais "Close / Active Brief / Active Document / Active Report" — `app/(user)/components/stages/ChatStage.tsx:92-115`

Bouton de fermeture du focal stage et labels des chips d'état rappel. CLAUDE.md règle Langue : tout en français.

**Proposition :** "Fermer" / "Brief actif" / "Document actif" / "Rapport actif". Hint hotkey reste "ESC".

---

### [P2] [M] Mono caps font-mono uppercase tracking-stretch — admin + reports — `app/admin/page.tsx:88,123,144` + `app/admin/settings/page.tsx:43,73` + `app/admin/_canvas/CanvasShell.tsx:119,129` + `app/(user)/components/reports/studio/*.tsx` × 6 + `app/(user)/components/reports/ResearchReportArticle.tsx:153`

≥ 18 occurrences `t-9/t-10 font-mono uppercase tracking-(--tracking-stretch|wide)`. La voix éditoriale 2026-04-29 interdit `tracking-marquee/display/section/label` en JSX — `tracking-stretch` (0.18em) est sur la même ligne sémantique (label mono caps techy).

**Proposition :** remplacer par voix régulière `.t-13 font-medium text-text-l1` (pattern Section.tsx du context-rail, déjà canonique cf. invariant ADD I-11). Lance un codemod ou batch grep-replace ciblé.

---

## 3 quick wins < 1h

1. **Swap `--accent-llm` → `--accent-teal` dans ThreadRow.tsx (4 occurrences l.38-50)** + retirer `box-shadow` halo violet. Fix immédiat de la cohérence palette + harmonisation avec PulseBar/StageFooter. ~10 min.

2. **Renommer 7 labels StageFooter EN→FR (`STATE_MAP` l.18-25)** + 4 labels RunTimeline (`SEVERITY_BADGE` l.18-23) + 3 strings ChatStage (l.92-115). Voix régulière FR partout. ~20 min, zéro régression fonctionnelle.

3. **Retirer `textShadow: var(--neon-accent-teal)` de TopMenuItem.tsx:57** + retirer le teaser violet du RailHeader.tsx:36-49 (revert à `<HearstLogo />`). Aligne le rail gauche sur la promesse "conversations only sobres style ChatGPT". ~15 min.

---

## 2 paris structurants > 1 jour

### Pari 1 — Démontage des 4 coquilles dans le shell layout (P0)

Refactor `app/(user)/layout.tsx` pour passer de 5 conteneurs `.shell-card`/`.shell-rail` à un **shell unique** sans bordures sur les zones primaires. PulseBar = `<header>` plat sur bg-noir. StageFooter = `<footer>` plat. Les 3 colonnes vivent dans un `grid grid-cols-[var(--width-threads)_1fr_var(--width-context)]` sans cards encapsulantes. Les rails internes utilisent `--surface-1` translucide (presque invisible) et un `--sep` 1px vertical comme seul séparateur.

**Coût :** 1-2 jours (touche au shell + retest visuel tous les Stages : 12 modes × focus mode × focal stage × working doc).

**Gain :** ouvre la voie au minimalisme cible. Sans ça, tous les efforts cosmétiques restent encadrés dans un chrome lourd. C'est *le* prérequis structurel.

---

### Pari 2 — Refonte du mode "cockpit" en Command Line Hero (P0)

Remplacer `CockpitStage` (CockpitOrbitView + 6 nodes + cœur + 5 pills + greeting bento) par un état "command line hero" : viewport quasi vide, greeting one-liner pâle haut-centre, ChatInput central agrandi (max-w-2xl, t-18, padding généreux `py-6`), 3-4 quick-pills sourds sous l'input ("Brief du jour" / "Lancer recherche" / "Mes artefacts" / "Suivre missions"). Sessions vivent dans le rail gauche pâle, missions actives signalées par 1 micro-indicateur dans la PulseBar (1 dot teal + count), pas par des cartes. La constellation orbitale devient un Stage dédié `mode: "constellation"` invocable via Cmd+K ou `/spatial-light`.

**Coût :** 2-3 jours (nouveau composant + retirer 6 sous-composants cockpit/orbital de la home + retest cockpit polling + onboarding empty state + a11y).

**Gain :** **atteint la cible "AI Command Line to Dashboard"**. C'est le pari conceptuel qui rend les autres findings cohérents. Sans Pari 2, on continue de polish un dashboard saturé.

---

## Diff microcopy/voix

```diff
# StageFooter — app/(user)/components/StageFooter.tsx:18-24
- idle:                   "Online"
- connecting:             "Connecting"
- streaming:              "Running"
- processing:             "Processing"
- awaiting_approval:      "Approval required"
- awaiting_clarification: "Clarification required"
- error:                  "Error"
+ idle:                   "Disponible"
+ connecting:             "Connexion"
+ streaming:              "En cours"
+ processing:             "Traitement"
+ awaiting_approval:      "En attente"
+ awaiting_clarification: "Précision demandée"
+ error:                  "Erreur"

# RunTimeline — app/(user)/components/RunTimeline.tsx:18-23
- success: "OK"
- warning: "Attn"
- error:   "Err"
+ success: "Réussi"
+ warning: "Attention"
+ error:   "Erreur"

# ChatStage — app/(user)/components/stages/ChatStage.tsx:93-115
- title="Close (Esc)"
- <span>Close</span>
- "Active Brief" | "Active Report" | "Active Document"
+ title="Fermer (Esc)"
+ <span>Fermer</span>
+ "Brief actif" | "Rapport actif" | "Document actif"

# OrbitalGreeting — app/(user)/components/cockpit/orbital/OrbitalGreeting.tsx:21
- "Voici ce qui se passe pour toi."
+ (à retirer si Pari 2 retenu — voix éditoriale plus calme : "Bonjour, Adrien." suffit)
```
