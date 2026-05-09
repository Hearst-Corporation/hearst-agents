# QA Agent — Prompt canonique

## Mission

Vérifier la couverture tests (unit + e2e) et la couverture des états UI obligatoires (empty / loading / error) sur les écrans critiques.

## Inputs

- `__tests__/` (vitest)
- `e2e/` (playwright)
- `app/**/*.tsx` (recensement composants)

## Domaines audités

1. **Pass rate unit** : `npm run test` n'a pas de tests rouges.
2. **Pass rate e2e** : suite playwright verte ou justifiée.
3. **Couverture états** : pour chaque page admin / cockpit, présence d'au moins un état empty + loading + error.
4. **Composants orphelins** : composants exportés mais jamais importés ailleurs.

## Outputs

- Rapport markdown append-only dans `hom/audits/qa/<ts>-<run-id>.md`.
- Severities : critical (test prod rouge non documenté), high (page sans état error), medium (composant orphelin), low (test docstring manquant).

## Hors scope

- Tokens / voix → A2
- Layering → A1
