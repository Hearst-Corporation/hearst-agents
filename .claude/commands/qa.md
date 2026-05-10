---
description: Audit QA UI/UX ultra-détaillé — alignements, spacing, cohérence, états, responsive. Senior QA Electron perfectionist.
---

# /qa — Audit QA UI/UX complet

Tu es Claude Code. Agis comme un senior QA UI/UX + frontend perfectionist spécialisé Electron desktop apps.

Objectif : faire un audit manuel ultra-détaillé de toute l'interface pour détecter absolument tous les problèmes visuels, d'alignement, de cohérence, de responsive, de hiérarchie, de spacing, de superposition, de tailles et de qualité perçue.

Tu dois te comporter comme un QA obsessif du détail et considérer que tout défaut visuel est un bug.

## Arguments optionnels

`$ARGUMENTS` — scope ciblé (ex: `app/(admin)` pour l'admin seul, `components/missions/` pour un module). Vide = audit complet de toute l'interface.

## Mission

Parcours toute l'application écran par écran, composant par composant, état par état.

Vérifie :

- alignements horizontaux et verticaux
- espacements incohérents
- marges/paddings différents
- tailles de titres incohérentes
- hauteurs de lignes
- largeurs de containers
- cartes mal alignées
- boutons non homogènes
- formulaires irréguliers
- tableaux désalignés
- problèmes de grille
- chevauchements/superpositions
- textes coupés
- scrolls anormaux
- double scroll
- éléments collés
- responsive desktop/tablette/fenêtres réduites
- sidebar/topbar
- modales
- dropdowns
- tooltips
- z-index incorrects
- ombres incohérentes
- rayons de bordure différents
- problèmes dark/light mode
- états loading/error/empty
- transitions et animations
- densité visuelle
- équilibre des layouts
- cohérence admin vs app principale
- éléments qui semblent "cassés" visuellement
- éléments qui donnent une impression non premium

Tu dois aussi détecter :

- composants dupliqués visuellement
- styles contradictoires
- pages qui ne respectent pas le design system
- composants qui n'utilisent pas les bons wrappers/layouts
- éléments qui changent de taille sans raison
- comportements UI instables
- problèmes de focus/clavier
- zones cliquables incohérentes

## Inspection statique du codebase

!find app/ -name "_.tsx" | xargs grep -l "style={{" | grep -v node_modules | head -30
!find app/ -name "_.tsx" | xargs grep -l "className=._\[" | grep -v node_modules | head -30
!grep -rn "z-index\|z-\[" app/ --include="_.tsx" --include="_.css" | grep -v node_modules | head -30
!grep -rn "overflow" app/ --include="_.tsx" --include="*.css" | grep -v node_modules | head -30
!grep -rn "position.*absolute\|position._fixed" app/ --include="_.tsx" | grep -v node_modules | head -30

## Sous-agents à déclencher

Spawn 3 sous-agents en parallèle :

### 1. Sous-agent Layout & Alignment QA

Détecte tous les problèmes d'alignement, spacing, tailles et grilles.

- Scanne tous les composants dans `app/` et `components/`
- Cherche les magic numbers de spacing (valeurs arbitraires hors token)
- Identifie les flex/grid incohérents
- Repère les hauteurs/largeurs hardcodées
- Vérifie que les containers utilisent les bons tokens `--space-*`

### 2. Sous-agent Interaction & States QA

Teste hover, focus, loading, modales, dropdowns, scrolls, responsive et comportements dynamiques.

- Cherche les états manquants (loading sans skeleton, error sans message, empty sans fallback)
- Vérifie les `hover:` et `focus:` sur tous les éléments interactifs
- Identifie les modales sans trap focus
- Repère les scrolls imbriqués problématiques
- Vérifie les transitions (`transition-*`, `duration-*`)

### 3. Sous-agent Visual Consistency QA

Vérifie typographie, couleurs, cartes, boutons, formulaires, shadows, radius et cohérence admin/app.

- Compare les composants admin vs app principale
- Vérifie que les boutons sont tous issus du même composant Button
- Contrôle la cohérence des `--radius-*` sur les cartes
- Vérifie les shadows (`--shadow-card`, `--shadow-card-hover`)
- Repère les couleurs hardcodées hors palette `globals.css`

## Pour chaque problème trouvé

```
[GRAVITÉ] Composant/Fichier:ligne
  Problème  : description précise
  Impact    : ce que l'utilisateur perçoit
  Correction: action concrète
  Statut    : appliqué | en attente
```

**Gravité :**

- `CRITIQUE` — casse l'UX, illisible, chevauchement, crash visuel
- `MOYEN` — incohérence notable, impression non premium
- `MINEUR` — pixel off, détail imperceptible à froid

## Règles strictes

- Ne casse aucune logique métier
- Ne modifie pas les APIs sauf nécessité absolue
- Ne fais pas de redesign complet
- Harmonise et perfectionne l'existant
- Garde une cohérence premium et moderne
- Priorité absolue : cohérence visuelle globale
- Applique les corrections sûres directement (mineur/moyen sans risque)
- Demande confirmation pour les corrections critiques qui touchent le layout global

## Critères d'acceptation

- Aucun élément désaligné visible
- Aucun chevauchement
- Aucun spacing incohérent
- Titres cohérents partout
- Boutons uniformes
- Cartes homogènes
- Layout stable sur toutes les tailles de fenêtre
- UI premium, propre et cohérente
- Partie admin parfaitement intégrée visuellement au reste
- Aucun composant "cheap", cassé ou incohérent visuellement

## Livrable final + Rapport HTML

Produis le rapport textuel :

1. Liste complète des problèmes trouvés (triés par gravité)
2. Corrections appliquées (avec fichiers modifiés)
3. Points restant à améliorer
4. Score final de qualité UI/UX estimé sur 10

Puis génère un fichier HTML complet à `/tmp/rapport-qa.html` et ouvre-le dans Chrome.

Le HTML doit :

- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "QA UI/UX Audit", date/heure, scope analysé, score /10 en grand
- Jauge score visuelle : arc SVG coloré (rouge < 5, orange < 7, vert >= 8)
- 3 colonnes de compteurs : CRITIQUE (rouge) / MOYEN (orange) / MINEUR (jaune)
- Section par sous-agent (Layout / Interaction / Visual) avec ses findings
- Chaque finding : badge gravité coloré, fichier cliquable `vscode://file/...`, problème, correction, statut (✅ appliqué / ⏳ en attente)
- Section "Corrections appliquées" : liste des fichiers modifiés avec diff résumé
- Section "Restant à faire" : roadmap priorisée
- Footer : durée d'audit, composants inspectés, date

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-qa.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-qa.html
