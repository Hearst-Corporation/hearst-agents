# Theme: robotflowtemplate-webflow-io

- **Source** : https://robotflowtemplate.webflow.io/home-pages/home-v1
- **Capturé** : 2026-05-15
- **Mood** : Tech dark futuriste — fond near-black (#050607), accent violet électrique (#523ff5), coins ultra-arrondis (cards 32px / boutons 200px pill), typographie Inter Tight medium
- **Reference** : ./reference.png (viewport 1440x900) · ./reference-full.png (page complète)
- **Assets** : ./assets/logo.svg + ./assets/[6 images du site]
- **Polices détectées** : `Inter Tight` (primaire), Line Rounded Icon Font Brix, Robotflow Icon, Social Media Icon Font Brix
- **Couleurs dominantes** :
  - bg `#050607` (near-black)
  - surface `#121418` (card)
  - text body `#b6bcc9`
  - text bright `#ffffff`
  - accent `#523ff5` (violet électrique)
  - border `#3b3e45`
- **Nb de samples** : 26 selectors couverts · 15 couleurs uniques · 11 tailles typo · 8 radius

## Tokens clés

| Token             | Valeur      | Usage observé             |
| ----------------- | ----------- | ------------------------- |
| `--color-bg`      | `#050607`   | Body background           |
| `--color-surface` | `#121418`   | Cards (`[class*='card']`) |
| `--color-accent`  | `#523ff5`   | Liens violets, focus      |
| `--font-family`   | Inter Tight | 519 occurrences en 18px   |
| `--font-size-6xl` | 72px        | H1 hero                   |
| `--font-size-4xl` | 48px        | H2 sections               |
| `--radius-lg`     | 32px        | Cards (15 occ)            |
| `--radius-pill`   | 200px       | Boutons CTA (9 occ)       |
| `--space-30`      | 120px       | Section padding standard  |
| `--container-max` | 1280px      | Wrapper principal         |

## Quick apply

```html
<html data-theme="robotflowtemplate-webflow-io"></html>
```

ou via JS :

```ts
import "themes/robotflowtemplate-webflow-io/tokens.css";
document.documentElement.dataset.theme = "robotflowtemplate-webflow-io";
```

## Sandbox

Ouvre `./sandbox.html` dans le navigateur — tu vois palette, typo, cards, boutons et un side-by-side avec la référence Robotflow.
