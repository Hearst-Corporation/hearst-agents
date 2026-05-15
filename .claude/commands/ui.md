---
description: Audit visuel d'un écran (magic numbers, hiérarchie, fidélité au design system). Audit only.
argument-hint: <chemin/vers/fichier.tsx>
---

# /ui — Audit visuel d'un écran

Audit pixel-perfect d'**un seul fichier**. Read-only — aucune modification. Si tu veux fixer après revue, demande explicitement.

## Scope

`$ARGUMENTS` = chemin du fichier. Si vide → demander à Adrien quel écran auditer.

## Étape 1 — Références canoniques

Ouvrir et garder en tête :

- [app/globals.css](app/globals.css) — tous les tokens disponibles
- [HEARST-OS-DESIGN-SYSTEM.html](HEARST-OS-DESIGN-SYSTEM.html)
- [hearst-ui-vision.html](hearst-ui-vision.html) si présent

## Étape 2 — Lecture intégrale du fichier ciblé

Lire `$ARGUMENTS` ligne par ligne. Ne sauter aucun écart.

## Étape 3 — Tableau des magic numbers

Produire un tableau markdown exhaustif :

| Ligne | Code actuel                   | Token correct                                  | Note                               |
| ----- | ----------------------------- | ---------------------------------------------- | ---------------------------------- |
| L42   | `px-12`                       | `var(--space-12)` (déjà mappé via Tailwind)    | OK si dans STRICT_PATHS — vérifier |
| L67   | `style={{ fontWeight: 700 }}` | `.t-15-strong`                                 | classe DS existante                |
| L89   | `rgba(45,212,191,0.3)`        | `var(--cykan)` + opacity ou token `--cykan-12` | couleur hardcodée                  |
| L122  | `rounded-[14px]`              | `var(--radius-md)`                             | radius hors token                  |

Catégoriser :

- **spacing** (margin, padding, gap, width, height)
- **typo** (font-size, font-weight, line-height, tracking)
- **color** (hex, rgb, hsl)
- **radius** (border-radius)
- **shadow** (box-shadow)
- **motion** (duration, easing)
- **inline-style** (style={{ ... }})

## Étape 4 — Diagnostic hiérarchie (3-5 bullets max)

- Équilibre : centrage, rythme vertical, alignements
- Hiérarchie typographique : niveau manquant ou redondant ?
- Densité : trop aéré / trop dense vs mock DS
- Cohérence : ce composant vs ses voisins
- Voix éditoriale : mono caps ? halo-on-hover sur chrome ?

## Étape 5 — Plan de correction (3 actions max, ordonnées par impact)

Pour chaque action :

- **Quoi** — token / classe DS à utiliser
- **Justification** — pointer la section du mock DS qui la valide
- **Effort** — 1 ligne / 5 lignes / refacto complet
- **Risque** — faible / moyen / élevé

## Étape 6 — Token manquant

Si un token nécessaire n'existe pas dans `globals.css` :

- Le signaler explicitement avec valeur proposée et nom de token
- **Ne pas** proposer de magic number temporaire
- Suggérer : ajouter le token dans `globals.css` puis continuer

## Règle absolue

**Aucune modification de code à cette étape.** Audit only. Adrien valide la direction → ensuite il te dit "applique".
