# Infrastructure Spatial — Audit & Lint

Ce dossier contient les outils de qualité pour le module Spatial.

## 1. Linter Statique (`npm run spatial:lint`)

Scanne les fichiers du module Spatial pour vérifier le respect des conventions R3F et TypeScript.

### Règles vérifiées :
- **Nomenclature** : Tout `<mesh>`, `<group>`, `<points>`, `<instancedMesh>` doit avoir un attribut `name`.
- **Lumières** : L'intensité des lumières doit être comprise entre 0.05 et 5 (warning) ou 0 et 10 (erreur).
- **Particules** : Le `count` des systèmes de particules est limité à 200 (warning) ou 500 (erreur).
- **Architecture** : Les composants doivent avoir la directive `"use client"`.
- **Qualité** : Interdiction du type `any` (warning) et de `@ts-ignore` (erreur).
- **Performance** : `useFrame` doit être accompagné d'un `useRef` pour éviter les mutations directes.

---

## 2. Audit Visuel (`npm run spatial:audit`)

Automatise la capture de screenshots et la comparaison pixel-à-pixel pour détecter les régressions visuelles.

### Workflow recommandé :
1. **Avant modif** : Lancer l'audit pour s'assurer que la référence est à jour et que tout est au vert.
2. **Après modif** : Relancer l'audit.
3. **Si régression** : Vérifier `docs/spatial/snapshots/diff.png`.
4. **Si modif intentionnelle** : Mettre à jour la référence avec `npm run spatial:audit -- --update-reference`.

### Options :
- `--url <url>` : Tester une autre route (par défaut `/spatial-rnd`).
- `--threshold <pct>` : Changer le seuil de tolérance (par défaut 2%).
- `--update-reference` : Forcer la mise à jour de l'image de référence.

---

## 3. Structure des fichiers

- `scripts/spatial/lint.mjs` : Logique du linter.
- `scripts/spatial/audit-visual.mjs` : Logique de l'audit Playwright.
- `docs/spatial/snapshots/` : Stockage des captures.
  - `reference.png` : **À COMMITTER**. Image de référence validée.
  - `current.png` : Ignoré. Dernière capture effectuée.
  - `diff.png` : Ignoré. Différence visuelle mise en évidence.
