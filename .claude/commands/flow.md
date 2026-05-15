---
description: QA flows utilisateur — navigation, friction, logique UX, CTA, cohérence. 3 agents parallèles.
argument-hint: [flow-id] (vide = audit complet)
---

# /flow — QA flows utilisateur

Audit manuel des flows réels comme un utilisateur exigeant. Read-only. Sortie : rapport HTML avec score UX /10.

## Pré-flight

!cat docs/AGENT-LOCK.json

Si `locked: true` → audit autorisé, fixes non.

## Scope

`$ARGUMENTS` — flow ciblé (ex: `onboarding`, `upload`, `admin`, `chat`). Vide = audit complet.

## Exclusions

Idem `/qa` : `spatial-safe/**`, `spatial/**`, backups.

## Perspectives utilisateur (à tenir simultanément)

- novice
- avancé
- créatif productif
- opérateur rapide
- QA obsessif détails UX

## Flows réels à couvrir (audit complet)

onboarding · création projet · génération · édition · historique · settings · admin · upload · export · suppression · retry · erreurs · offline · changement provider · navigation inter-pages · retour arrière · sauvegarde · fermeture/réouverture · modales · confirmations · raccourcis · multi-step.

## Stratégie : 3 sous-agents en parallèle

Spawn 3 Agents dans **un seul message** (subagent_type: `Explore`).

### Agent 1 — Navigation & Flow QA

- Mapper tous chemins entre pages
- Vérifier que chaque page a une issue claire
- Identifier dead-ends (pages sans retour)
- Cohérence "Annuler" / "Retour" / "Fermer"
- Transitions logiques entre étapes

Commandes :
- `find app/ -name "page.tsx" | sort`
- `grep -rEn "useRouter|router\.(push|back|replace)|redirect\(" app/ components/ --include="*.tsx" --include="*.ts"`

### Agent 2 — Product Logic QA

- Compter clics par flow critique
- Étapes fusionnables / supprimables
- Confirmations redondantes ou manquantes
- Actions destructives sans confirmation
- Flows où user peut perdre données

Commandes :
- `grep -rEn "onClick|onSubmit|onConfirm" app/ components/ --include="*.tsx"`
- `grep -rEn "confirm\(|window\.confirm" app/ components/ --include="*.tsx"`

### Agent 3 — Interaction & Feedback QA

- Action async sans loader
- Erreurs sans message actionnable
- Succès sans confirmation visuelle
- Modales : focus trap + Escape + restoration focus
- Comportements offline / erreur réseau

Commandes :
- `grep -rEn "loading|isLoading|isPending|isFetching" app/ components/ --include="*.tsx"`
- `grep -rEn "toast|notify|sonner" app/ components/ --include="*.tsx"`
- `grep -rEn "Dialog|Modal|Sheet|Popover" app/ components/ --include="*.tsx"`

## Format finding

```json
{
  "severity": "P0|P1|P2",
  "path": "app/(user)/chat/page.tsx",
  "line": 42,
  "rule": "dead-end|missing-loader|destructive-no-confirm|...",
  "title": "Description précise",
  "current": "Comportement actuel",
  "suggested": "Comportement attendu",
  "why": "Impact ressenti utilisateur",
  "status": "Clics avant: N → après: M"
}
```

Sévérités :
- **P0** — flow cassé, perte données, blocage utilisateur
- **P1** — friction notable, confusion possible
- **P2** — détail UX, wording, micro-interaction

## Score UX /10

- Base 10
- −2 par P0, −0.5 par P1, −0.1 par P2 (plancher à 0)

## Agrégation → render-report

```json
{
  "title": "QA Flows utilisateur",
  "scope": "<arg ou 'complet'>",
  "kpis": { "p0": N, "p1": N, "p2": N, "score": X },
  "sections": [
    { "name": "Navigation", "agent": "agent-1", "findings": [...] },
    { "name": "Product Logic", "agent": "agent-2", "findings": [...] },
    { "name": "Interaction & Feedback", "agent": "agent-3", "findings": [...] }
  ],
  "quickWins": [...],
  "plan": [
    { "name": "P0 — flows cassés", "items": ["..."] },
    { "name": "P1 — friction notable", "items": ["..."] },
    { "name": "P2 — polish UX", "items": ["..."] }
  ]
}
```

!node scripts/render-report.mjs --type=flow --data=/tmp/flow-data.json --open

## Réponse finale (5 lignes max)

```
Flow <scope> · UX N/10 · P0:N P1:N P2:N
Top friction : <description courte>
Rapport : docs/audit/flow-YYYY-MM-DD.html
```
