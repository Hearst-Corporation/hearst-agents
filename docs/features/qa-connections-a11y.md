# QA — `/connections` : a11y + heading + labels — `qa-connections-a11y`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-connections-a11y`                                                                        |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — page critique (gestion apps tierces) sans heading ni labels, WCAG 2.2 AA cassé      |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`, `a11y`                                                       |

## Description

La page `/connections` (gestion des apps connectées : Composio + natives) souffre de plusieurs problèmes d'accessibilité :

1. **Aucun heading** : `document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length === 0`
2. **Boutons sans aria-label** : 140 boutons sur la page, premier bouton textuel `"1"` (sans label, probable badge notification)
3. **Boutons catégories agglutinés** : `Tout123`, `Développement19`, `Collaboration15` → lus par les lecteurs d'écran comme "Tout cent vingt-trois", "Développement dix-neuf"

Page critique pour la connexion d'apps OAuth — utilisateur lecteur d'écran ou keyboard-only ne peut pas l'utiliser.

## Findings source

- **P1-005** (Zone 3) — `/connections` sans heading + boutons sans label + catégories agglutinées

## Surface concernée

- [app/(user)/connections/page.tsx](<../../app/(user)/connections/page.tsx>) — page racine
- [app/(user)/components/connections/ConnectionsHub.tsx](<../../app/(user)/components/connections/ConnectionsHub.tsx>) — composant principal
- [app/(user)/components/connections/](<../../app/(user)/components/connections/>) — sous-composants (cards, filters, catalog)

## Invariants verrouillés

### I-1. Hierarchy de headings claire

La page **doit** exposer :
- `<h1>Connexions</h1>` en haut de la page (1 unique)
- `<h2>Connectés</h2>` pour la section apps actives
- `<h2>Pour aller plus loin</h2>` pour les recommandations
- `<h2>Catalogue</h2>` pour la liste complète
- `<h3>` pour les sous-sections si pertinent (par catégorie)

### I-2. Tout bouton a un nom accessible

Pour chaque `<button>` :
- texte visible non vide, OU
- `aria-label`, OU
- `aria-labelledby` pointant vers un élément textuel

Le bouton "1" (probable badge) → `aria-label="Voir les 1 notification de connexion"` (ou cacher si purement décoratif).

### I-3. Catégories : label + count séparés

Les boutons de filtre catégorie **doivent** séparer visuellement et sémantiquement le label et le count.

Forme recommandée :
```html
<button aria-label="Filtrer par développement (19 apps)">
  <span>Développement</span>
  <span aria-hidden="true">19</span>
</button>
```

Lecteur d'écran lit "Filtrer par développement, 19 apps".

### I-4. Focus visible sur tous les contrôles

Tous les contrôles interactifs (boutons, inputs, sliders, etc.) doivent avoir un focus ring visible (cohérent avec le DS Hearst).

### I-5. Pas de div interactives non-button

Aucun `<div onClick>` ou `<span onClick>` sur cette page. Tout interactif = `<button>` ou `<a>` natif.

### I-6. Form fields labellisés

Les inputs de recherche / filtres ont :
- `<label for="...">` associé, OU
- `aria-label`

## Critères d'acceptation testables

1. **Heading count** : `expect(document.querySelectorAll('h1,h2,h3').length).toBeGreaterThanOrEqual(4)`.
2. **H1 unique** : `expect(document.querySelectorAll('h1').length).toBe(1)`.
3. **Tous boutons nommés** : `Array.from(document.querySelectorAll('button')).every(b => b.textContent.trim() || b.getAttribute('aria-label'))`.
4. **Catégories aria-label** : `[aria-label*="Filtrer par"]` count > 0.
5. **Axe scan** : `npx @axe-core/cli http://localhost:4102/connections` → 0 violation critical / serious.

## Évolutions autorisées

- Ajout de catégories.
- Refactor en sous-composants tant que la hiérarchie de headings tient.
- Customisation du copywriting des labels.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Refactor casse les headings         | A11y régression silencieuse             | Test axe E2E         |
| Nouveaux composants sans label      | Bug récurrent                           | ESLint jsx-a11y      |
| Catégories ajoutées sans label      | Lecture cassée                          | Lint des aria-labels |

## Tests à écrire

- E2E : `tests/e2e/connections-a11y.spec.ts` — heading + button labels
- Axe : intégration `@axe-core/playwright` sur cette page
- Unit : `__tests__/connections/ConnectionsHub.test.tsx` — render h1 / h2 attendus

## Notes & historique

- 2026-05-15 — Bug identifié Zone 3 par scan a11y automatique.
- Page critique car c'est le point d'entrée de l'écosystème connecteurs (Composio + native Google).
