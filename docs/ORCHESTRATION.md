# Hearst Operations Mesh (HOM) v1.2

> AI Operations Platform. Pilotage live + reporting signé pour Hearst OS.
> Toute la racine HOM vit sous `hom/`. La doc maître ADD reste `docs/AGENT-DRIVEN-DEV.md`.

## Topologie 4-couches

| Couche | Mode | Vit dans | Rôle |
|---|---|---|---|
| **Admin app** | live, interactif | `app/admin/orchestrator/*` | pilotage humain |
| **Command Center** | live state | `hom/command-center/state.json` | source de vérité runtime |
| **War Room** | snapshot signé | `hom/war-room/snapshots/<run-id>/` | archive HTML immutable |
| **Release dossier** | artefact final | `hom/release/<v>/` | shipping + rollback |

## Slice initial (v1.2.0)

- 3 agents : Architecture (A1), Design System (A2), QA (A8).
- Master orchestrator centralisé (lib/hom/master.ts).
- Telemetry JSONL (spans, logs, metrics) sous `hom/telemetry/`.
- Trust engine : 7 dimensions (architecture, design, qa, runtime, release, orchestration, product_experience).
- Drift engine : couleurs hardcodées, magic spacing, voix éditoriale.
- Policy engine : whitelist par défaut.
- Quarantine : anomaly score 0..1, transition healthy → suspect → quarantined.
- Replay snapshot : git + policies + contracts hashs.
- War Room HTML statique self-contained.

## Lancer un run

### CLI
```
npx tsx scripts/hom-run.ts
```
Optionnel : `--scope architecture,design-system,qa` ou `--notes "release v1.2"`.

### Admin UI
1. Aller dans `/admin/orchestrator/overview`.
2. Cliquer **« Lancer un run »**.
3. Suivre l'avancement dans `/admin/orchestrator/command-center` (SSE).
4. Inspecter le résultat dans `/admin/orchestrator/runs/<id>`.

## Registry

`/admin/orchestrator/registry` agrège : pages, composants, routes API, tests, stores.
Avec ownership inféré depuis les capability contracts et le drift par fichier.

## Validation rapide

```bash
npm run typecheck
npm run lint
npm run test
```

## Ce qui n'est pas (encore) implémenté

- A3, A4, A5, A6, A7, A9, A10, A11 (8 agents restants — prévu en Phase 12).
- Memory layer complet (anti-patterns / known-failures).
- ADR system avec workflow proposed → accepted.
- Quarantine recovery workflow complet.
- Cost governance live.
- Replay strict mode (déterminisme LLM).
- Release dossier 17 sections.

## Règles dures

1. **Append-only** : aucun rapport `/audits/*` n'est jamais écrasé.
2. **No self-approval** : un agent ne signe jamais son propre rapport.
3. **Lock-aware** : tous les agents lisent `docs/AGENT-LOCK.json` avant d'écrire.
4. **Whitelist policy** : action sans rule = deny par défaut.
5. **Critical = blocked** : un seul finding `critical` bloque la release.

## Fichiers structurels

- `hom/orchestrator/config.json` — config orchestrateur
- `hom/agents/<id>/contracts.json` — capability contract
- `hom/agents/<id>/prompts.md` — prompt canonique
- `hom/policies/fleet-policy.json` — règles globales
- `hom/policies/release-policy.json` — release gates
- `hom/war-room/trust-history.json` — historique trust
- `hom/war-room/drift-log.json` — drift cumulé
- `hom/quarantine/state.json` — agents isolés
