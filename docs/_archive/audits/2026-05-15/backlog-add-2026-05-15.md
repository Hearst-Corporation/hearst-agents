# Backlog ADD — Issu du QA Audit 2026-05-15

> Specs ADD générées à partir des 3 audits QA du 2026-05-15 (Zone 1 / Zone 2 / Zone 3).
>
> **Sources** :
> - `docs/qa/audit-zone1-auth-shell-2026-05-15.md`
> - `docs/qa/audit-zone2-stages-chat-spatial-2026-05-15.md`
> - `docs/qa/audit-zone3-admin-connections-public-2026-05-15.md`

## Tableau des specs créées

| Spec                                  | Findings source                                  | Priorité | Path                                                                                  |
| ------------------------------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| qa-shell-navigation-stability         | F-036, F-100, F-116, P0-001                     | P0       | [docs/features/qa-shell-navigation-stability.md](../features/qa-shell-navigation-stability.md) |
| qa-commandeur-a11y                    | F-015, F-016, F-022, F-033, F-034               | P0       | [docs/features/qa-commandeur-a11y.md](../features/qa-commandeur-a11y.md)              |
| qa-chat-orchestrate-deduplication     | F-102, C-004                                     | P0       | [docs/features/qa-chat-orchestrate-deduplication.md](../features/qa-chat-orchestrate-deduplication.md) |
| qa-shell-hotkeys                      | F-101, F-046, F-026                              | P0       | [docs/features/qa-shell-hotkeys.md](../features/qa-shell-hotkeys.md)                  |
| qa-stage-mission-coherence            | F-009, F-026, S-09                               | P0       | [docs/features/qa-stage-mission-coherence.md](../features/qa-stage-mission-coherence.md) |
| qa-csp-fonts                          | F-045, F-115, P1-001                             | P1       | [docs/features/qa-csp-fonts.md](../features/qa-csp-fonts.md)                          |
| qa-stage-persistance-url              | F-008, F-039                                     | P1       | [docs/features/qa-stage-persistance-url.md](../features/qa-stage-persistance-url.md)  |
| qa-mentions-doublons                  | F-113, C-012                                     | P1       | [docs/features/qa-mentions-doublons.md](../features/qa-mentions-doublons.md)          |
| qa-spatial-data-source                | F-111, F-123, SP-002, SP-006                     | P1       | [docs/features/qa-spatial-data-source.md](../features/qa-spatial-data-source.md)      |
| qa-voice-stage-placeholder            | F-110, S-07                                      | P1       | [docs/features/qa-voice-stage-placeholder.md](../features/qa-voice-stage-placeholder.md) |
| qa-chat-affordance-disabled           | F-031, F-122, C-008, F-114                       | P1       | [docs/features/qa-chat-affordance-disabled.md](../features/qa-chat-affordance-disabled.md) |
| qa-admin-runs-pii                     | P1-004                                           | P1       | [docs/features/qa-admin-runs-pii.md](../features/qa-admin-runs-pii.md)                |
| qa-admin-health-label                 | P1-002                                           | P1       | [docs/features/qa-admin-health-label.md](../features/qa-admin-health-label.md)        |
| qa-admin-404-coquille                 | P1-003, F-005                                    | P1       | [docs/features/qa-admin-404-coquille.md](../features/qa-admin-404-coquille.md)        |
| qa-connections-a11y                   | P1-005                                           | P1       | [docs/features/qa-connections-a11y.md](../features/qa-connections-a11y.md)            |
| qa-features-manifest-empty            | P1-006                                           | P1       | [docs/features/qa-features-manifest-empty.md](../features/qa-features-manifest-empty.md) |
| qa-mobile-fallback                    | F-112, F-040                                     | P1       | [docs/features/qa-mobile-fallback.md](../features/qa-mobile-fallback.md)              |
| qa-signal-stage-data                  | F-117                                            | P1       | [docs/features/qa-signal-stage-data.md](../features/qa-signal-stage-data.md)          |
| qa-greeting-skeleton                  | F-006, F-120                                     | P1       | [docs/features/qa-greeting-skeleton.md](../features/qa-greeting-skeleton.md)          |
| qa-shell-interactive-elements         | F-012, F-013, F-048, F-049                       | P1       | [docs/features/qa-shell-interactive-elements.md](../features/qa-shell-interactive-elements.md) |
| qa-auth-bypass-validation             | F-001, F-005, F-037, F-038, F-044                | P1       | [docs/features/qa-auth-bypass-validation.md](../features/qa-auth-bypass-validation.md) |

## Total

- **21 specs créées**
- **5 specs P0** : qa-shell-navigation-stability, qa-commandeur-a11y, qa-chat-orchestrate-deduplication, qa-shell-hotkeys, qa-stage-mission-coherence
- **16 specs P1** : qa-csp-fonts, qa-stage-persistance-url, qa-mentions-doublons, qa-spatial-data-source, qa-voice-stage-placeholder, qa-chat-affordance-disabled, qa-admin-runs-pii, qa-admin-health-label, qa-admin-404-coquille, qa-connections-a11y, qa-features-manifest-empty, qa-mobile-fallback, qa-signal-stage-data, qa-greeting-skeleton, qa-shell-interactive-elements, qa-auth-bypass-validation

## Couverture

### Findings P0 couverts

Tous les P0 sont couverts par une spec (parfois mutualisés) :

| Finding source         | Spec ADD                              |
| ---------------------- | ------------------------------------- |
| F-015, F-016 (Zone 1)  | qa-commandeur-a11y                    |
| F-022 (Zone 1)         | qa-commandeur-a11y                    |
| F-026 (Zone 1)         | qa-stage-mission-coherence + qa-shell-hotkeys |
| F-009 (Zone 1)         | qa-stage-mission-coherence            |
| F-036 (Zone 1)         | qa-shell-navigation-stability         |
| F-005, F-044, F-001, F-037 (Zone 1) | qa-auth-bypass-validation |
| F-100 (Zone 2)         | qa-shell-navigation-stability         |
| F-101 (Zone 2)         | qa-shell-hotkeys                      |
| F-102 (Zone 2)         | qa-chat-orchestrate-deduplication     |
| F-103 (Zone 2)         | (non converti — voir ci-dessous)      |
| F-104 (Zone 2)         | (non converti — voir ci-dessous)      |
| P0-001 (Zone 3)        | qa-shell-navigation-stability         |

### Findings P1 couverts

Sélection des plus impactants couverts. Quelques P1 polish ou tests bloqués non convertis (voir ci-dessous).

### Findings non convertis (justifier)

| Finding   | Raison                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-002, F-003 (Zone 1) | OAuth Google / Outlook — tests bloqués par dev-bypass, couverts indirectement par `qa-auth-bypass-validation`. Pas de spec dédiée car flux providers déjà couverts par `auth.md` v1.0. |
| F-004 (Zone 1)        | Liens Confidentialité/Conditions/Aide non cliquables sur `/login` — P2 polish, pas worth d'une spec ADD séparée. À traiter en cleanup général.            |
| F-103 (Zone 2)        | `/api/cc/stream` et `/api/runs/events` 404 — à confirmer si frontend a un fallback EventSource. Si non, pas un bug. À investiguer avant spec dédiée.       |
| F-104 (Zone 2)        | Tab `about:blank` co-existant — probable side-effect Playwright MCP. À valider en condition réelle Chrome avant spec dédiée.                              |
| F-118 (Zone 2)        | `aria-current` OK sur LeftRail — réfute le finding Zone 1 F-047. **Pas de bug**, marqué comme info / non-finding.                                         |
| F-124 (Zone 2)        | Stage Asset variants "Rendu en cours" statique — P2 mock data, à investiguer en réel avant spec.                                                          |
| F-130, F-131, F-132 (Zone 2) | Erreurs console liées à F-100 — disparaissent si nav parasite fixée. Pas de spec séparée.                                                            |
| F-035 (Zone 1)        | textarea VideoQuickLaunch sans aria-label — P2, couvert implicitement par `qa-commandeur-a11y` (mêmes invariants a11y dialogs).                            |
| F-040 (Zone 1)        | Responsive 375 mobile sans scroll horizontal — info, lié à `qa-mobile-fallback` (mais OK fonctionnel).                                                     |
| F-038 (Zone 1)        | `/login` reste affiché si loggé — couvert par `qa-auth-bypass-validation` I-5.                                                                             |
| F-006 (Zone 1)        | Greeting flicker — couvert par `qa-greeting-skeleton`.                                                                                                    |
| P2-001 (Zone 3)       | `/api/admin/events-stream` 0 byte — à confirmer si réellement utilisé. P2 polish.                                                                          |
| P2-002 (Zone 3)       | `/admin/orchestrator/drift` pagination — P2 admin, à traiter en sprint admin dédié.                                                                       |
| P2-003 (Zone 3)       | `/admin/pipeline` bouton sans état visuel — P2 polish admin.                                                                                              |
| P2-004 (Zone 3)       | Heartbeat sans fuseau horaire — P2 polish.                                                                                                                |
| P2-005 (Zone 3)       | `/admin/agents` boutons Démarrer/Pauser absents — P2 feature complétion admin.                                                                            |
| P3-001, P3-002, P3-003 (Zone 3) | Polish admin pur — pas worth d'une spec ADD séparée.                                                                                          |
| F-121 (Zone 2)        | "Suggestion partiel" mono caps collés — P2 typo, fix CSS local.                                                                                            |
| Tests bloqués Zone 3  | Admin agents/[id] avec id réel, public/* avec token valide, permissions non-admin — bloqueurs de validation, pas des bugs en soi.                          |

## Lien avec les specs verrouillées existantes

Certaines specs QA recoupent des invariants des specs verrouillées v1.0. **Aucune contradiction** introduite :

- `qa-auth-bypass-validation` complète [auth.md](../features/auth.md) sans contredire ses invariants I-1 à I-10.
- `qa-shell-hotkeys` recouvre [stage.md](../features/stage.md) sur le mapping hotkeys.
- `qa-stage-mission-coherence` recouvre [missions.md](../features/missions.md) côté UI.
- `qa-signal-stage-data` complète [signal-board.md](../features/signal-board.md) en spécifiant l'empty state UI.
- `qa-spatial-data-source` respecte la zone INTERDITE `/spatial-safe` (mentionnée explicitement en I-3).

## Prochaines étapes

1. Exécuter `npm run features:manifest` pour régénérer `_manifest.json`.
2. Trier les specs P0 par dépendance d'implémentation (`qa-shell-navigation-stability` probablement en premier, c'est la cause root de plusieurs autres).
3. Battle Plan : créer un batch par spec P0 + un batch consolidé pour les P1 par zone (shell, chat, admin).
4. Pour les tests bloqués (auth sans bypass, tokens valides) : créer un sous-environnement Playwright dédié.
