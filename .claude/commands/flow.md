---
description: QA manuel ultra-avancé des flows utilisateur — navigation, logique UX, friction, cohérence. Senior QA produit + UX architect.
---

# /flow — QA flows utilisateur complet

Tu es Claude Code. Agis comme un senior QA produit + UX architect spécialisé Electron apps complexes.

Objectif : tester manuellement tous les flows de l'application comme un vrai utilisateur exigeant et perfectionniste, détecter toutes les incohérences de navigation, de logique UX, de positionnement des actions, de retour utilisateur et optimiser les flows pour qu'ils soient fluides, intuitifs, cohérents et premium.

## Arguments optionnels

`$ARGUMENTS` — flow ciblé (ex: `onboarding`, `upload`, `admin`). Vide = audit complet de tous les flows.

## Perspectives utilisateur

Tu dois penser comme :
- un utilisateur novice
- un utilisateur avancé
- un créatif qui produit beaucoup
- un opérateur qui enchaîne rapidement les actions
- un QA obsessif des détails UX

## Mission — Flows à tester

Teste tous les flows réels :

- onboarding
- création de projet
- génération vidéo
- génération Runway
- édition
- historique
- settings
- admin
- upload
- export
- suppression
- retry
- erreurs
- états offline
- changements de provider
- navigation entre pages
- retour arrière
- sauvegarde
- fermeture/réouverture
- modales
- confirmations
- raccourcis éventuels
- multi-step flows

## Inspection statique des flows

!find app/ -name "page.tsx" | sort | sed 's|app/||;s|/page.tsx||'
!grep -rn "useRouter\|router\.push\|router\.back\|redirect" app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | head -40
!grep -rn "onClick\|onSubmit\|onConfirm" app/ --include="*.tsx" | grep -v node_modules | head -40
!grep -rn "toast\|notify\|alert\|modal\|dialog" app/ --include="*.tsx" | grep -v node_modules | head -30
!grep -rn "loading\|isLoading\|isPending" app/ --include="*.tsx" | grep -v node_modules | head -30

## Pour chaque flow, vérifie

- logique de navigation
- cohérence des boutons
- position des CTA
- présence des boutons retour
- cohérence des actions primaires/secondaires
- clarté des étapes
- réduction du nombre de clics
- feedback utilisateur
- messages de succès/erreur
- loaders
- états bloqués
- flows cassés
- pages sans issue
- actions ambiguës
- transitions
- perte de contexte
- perte de données
- flows trop longs
- double actions
- répétitions inutiles
- comportement incohérent entre admin et app principale
- différences de placement des boutons
- confirmations inutiles ou manquantes
- possibilité de revenir facilement en arrière
- cohérence des raccourcis UX

## Détection avancée

Tu dois aussi détecter :

- flows mentalement fatigants
- UX non intuitive
- étapes inutiles
- boutons mal placés
- actions importantes peu visibles
- incohérences de wording
- hiérarchie UX incorrecte
- comportements différents selon les pages
- logique produit incohérente
- manque de feedback utilisateur
- flows qui semblent "cheap" ou non premium

## Sous-agents à déclencher

Spawn 3 sous-agents en parallèle :

### 1. Sous-agent Navigation & Flow QA
Teste navigation, retour arrière, transitions, cohérence des CTA et logique de parcours.
- Mappe tous les chemins possibles entre pages
- Vérifie que chaque page a une issue claire
- Identifie les dead-ends (pages sans retour)
- Contrôle la cohérence des boutons "Annuler" / "Retour" / "Fermer"
- Vérifie que les transitions entre étapes sont logiques

### 2. Sous-agent Product Logic QA
Détecte les incohérences métier, étapes inutiles, flows trop complexes et optimisations possibles.
- Compte le nombre de clics pour chaque flow critique
- Identifie les étapes qui peuvent être fusionnées ou supprimées
- Repère les confirmations redondantes
- Vérifie que les actions destructives ont une confirmation
- Identifie les flows où l'utilisateur peut perdre des données

### 3. Sous-agent Interaction QA
Teste états loading/error/success, feedback utilisateur, confirmations, modales et comportements dynamiques.
- Vérifie que chaque action asynchrone a un loader
- Contrôle que les erreurs sont toujours expliquées et actionnables
- Vérifie que les succès sont confirmés visuellement
- Teste les modales : ouverture, fermeture, focus trap, Escape
- Vérifie les comportements en cas d'erreur réseau

## Format des findings

```
[GRAVITÉ] Flow : NomDuFlow — Étape concernée
  Fichier   : chemin/composant:ligne
  Problème  : description précise du problème UX
  Impact    : ce que ressent l'utilisateur
  Correction: action concrète à appliquer
  Clics     : avant N → après M (si applicable)
  Statut    : appliqué ✅ | proposé ⏳ | risqué ⚠️
```

**Gravité :**
- `CRITIQUE` — flow cassé, perte de données, blocage utilisateur
- `MOYEN` — friction notable, confusion possible, incohérence visible
- `MINEUR` — détail UX, wording, micro-interaction

## Règles strictes

- Ne casse aucune fonctionnalité
- Ne modifie pas les APIs sauf nécessité évidente
- Simplifie les flows au maximum
- Réduis la friction utilisateur
- Harmonise les comportements dans toute l'application
- Tous les flows doivent être prévisibles et cohérents
- Si un changement est risqué, propose-le au lieu de l'appliquer

## Critères d'acceptation

- Tous les flows sont fluides et intuitifs
- Aucun écran sans issue claire
- Les boutons importants sont toujours au bon endroit
- Les CTA sont cohérents dans toute l'app
- Les retours arrière sont toujours logiques
- Aucun flow inutilement complexe
- Aucun utilisateur ne peut se sentir perdu
- Les actions critiques sont claires et sécurisées
- L'expérience paraît premium, rapide et naturelle

## Livrable final + Rapport HTML

Produis le rapport textuel :

1. Flows testés (liste complète)
2. Problèmes détectés (triés par gravité)
3. Optimisations appliquées (avec fichiers modifiés)
4. Optimisations proposées mais non appliquées
5. Fichiers modifiés
6. Risques restants
7. Score final UX/product flow sur 10

Puis génère un fichier HTML complet à `/tmp/rapport-flow.html` et ouvre-le dans Chrome.

Le HTML doit :
- Fond sombre `#0a0a0a`, police `system-ui`, accent `#00e5cc` (cykan)
- Header avec titre "QA Flows utilisateur", date/heure, scope analysé, score UX /10 en grand
- Jauge score SVG arc coloré (rouge < 5, orange < 7, vert >= 8)
- Carte par flow testé : statut global (✅ fluide / ⚠️ friction / 🚫 cassé), nombre de clics, problèmes trouvés
- Section par sous-agent (Navigation / Product Logic / Interaction) avec ses findings
- Chaque finding : badge gravité, flow concerné, fichier cliquable `vscode://file/...`, problème, correction, statut
- Timeline visuelle des flows critiques : avant/après en nombre de clics
- Section "Optimisations appliquées" : diff résumé par fichier
- Section "Propositions" : roadmap UX priorisée avec effort estimé
- Section "Risques restants" : ce qui n'a pas été touché et pourquoi
- Footer : N flows testés, X problèmes trouvés, Y corrigés, date

!node -e "
const fs = require('fs');
const html = \`CONTENU_HTML_GENERE\`;
fs.writeFileSync('/tmp/rapport-flow.html', html);
"
!open -a 'Google Chrome' /tmp/rapport-flow.html
