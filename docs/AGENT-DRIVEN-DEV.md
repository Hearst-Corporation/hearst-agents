# Agent Driven Dev — État du projet

> **Document maître à lire en premier par tout agent intervenant sur ce repo.**
> Source de vérité unique sur l'état du verrouillage features. À jour : `2026-05-03` (auth verrouillé).

## Pour l'agent qui arrive (lecture obligatoire)

**Raccourci** : si tu utilises Claude Code, lance la slash command **`/feature [feature-id]`** — elle te déroule automatiquement le protocole ci-dessous (lock check, lecture rapport maître, ouverture spec ciblée).

Si tu es un agent (Claude, ChatGPT, Cursor, Copilot, etc.) et tu vas modifier ce repo :

0. **VÉRIFIE LE VERROU AGENT** — lis [docs/AGENT-LOCK.json](AGENT-LOCK.json). Si `locked === true`, **refuse toute écriture** (Edit, Write, NotebookEdit) et toute action destructive (rm, git commit, mv, etc.). Informe l'utilisateur qu'il doit déverrouiller depuis `/admin/agent-driven-dev`. La lecture reste autorisée.
1. **Lis ce fichier en entier.** Il te dit quelles zones sont verrouillées.
2. **Avant toute modification d'une feature listée comme `locked` ci-dessous** : ouvre `docs/features/<id>.md`, lis la section "Invariants verrouillés", vérifie que ton changement n'en contredit aucun.
3. **Si ton changement contredit un invariant** : tu dois proposer un update de spec à Adrien **avant** de coder. Pas d'exception.
4. **Si la feature n'est pas encore verrouillée** : tu suis le mode autonomie défini dans [CLAUDE.md](../CLAUDE.md).
5. **Quand tu finis du travail sur une feature spec'd** : mets à jour la section "dernière revue" dans `docs/features/<id>.md` et incrémente `version spec` si tu as touché aux invariants (avec validation préalable).

## Verrou agent (kill-switch global)

Adrien peut **verrouiller tous les agents** en un clic depuis `/admin/agent-driven-dev`. Cela écrit `locked: true` dans `docs/AGENT-LOCK.json` (fichier tracké dans le repo, donc visible par toutes les sessions).

**Quand le verrou est actif** :
- Aucun agent ne doit modifier de fichier
- Aucun agent ne doit exécuter d'action destructive (`rm`, `git commit`, `git push`, `mv`, drop DB, etc.)
- Lecture, recherche, analyse → autorisées
- L'agent doit informer l'utilisateur et l'inviter à déverrouiller

**Mécanisme d'application** :
- **Honor system** (toujours actif) : l'agent lit le fichier en début de tâche et respecte
- **Hook Claude Code** (optionnel, à activer dans `.claude/settings.json`) : bloque mécaniquement Edit/Write/NotebookEdit. Script disponible à [scripts/check-agent-lock.mjs](../scripts/check-agent-lock.mjs).

**Déverrouillage** : Adrien retourne dans `/admin/agent-driven-dev` et clique sur "Déverrouiller". Aucun agent ne peut déverrouiller.

## Méthode

L'objectif est de mettre Hearst OS sous contrôle Agent Driven Dev sans casser l'existant. La méthode :

1. **Inventaire** (fait) — 32 features identifiées rétroactivement à partir du code existant
2. **Verrouillage feature par feature** (en cours) — pour chaque feature, on écrit une spec figée dans `docs/features/<id>.md` qui capture :
   - Surface publique (composants exportés, endpoints API)
   - Architecture interne (stores, libs, dépendances)
   - **Invariants verrouillés** (ce qui ne peut pas changer sans update spec)
   - **Évolutions autorisées** (ce qui peut bouger librement)
   - Tests existants vs manquants
   - Risques connus
3. **Index des verrous** dans [docs/rules/locked-zones.md](rules/locked-zones.md)
4. **Itération** — une fois toutes les features critiques verrouillées, on traite les gaps (tests manquants, drift, code orphelin)

## Phase actuelle

**Phase 2 — Verrouillage feature par feature (pilote en cours).**

Ordre choisi : on verrouille **une feature à la fois**, on valide le format avec Adrien, puis on duplique aux suivantes.

### Pilote validé

`cockpit` v1.0 (2026-05-03) — pilote, format validé par Adrien.

### Verrouillages successifs

- `auth` v1.0 (2026-05-03) — P0, première feature après pilote.
- `stage` v1.0 (2026-05-04) — P0, routing UI central, 15 invariants.
- `chat` v1.0 (2026-05-04) — P0, cœur produit, 18 invariants (orchestrator + SSE + UI chat).
- `missions` v1.0 (2026-05-04) — P1, scheduler distribué, 18 invariants (leases, cron, mission memory).

## Tableau de bord features

| # | id | Statut | Spec | Niveau | Tests existants | Gap tests |
|---|----|----|----|----|----|----|
| F-01 | **auth** | **verrouillé v1.0** | [auth.md](features/auth.md) | P0 | 3 fichiers | élevé (e2e login + crypto roundtrip + auto-revoke + multi-tenant) |
| F-02 | **cockpit** | **verrouillé v1.0** | [cockpit.md](features/cockpit.md) | P1 | 3 fichiers | élevé (e2e + UI components + lifecycle) |
| F-03 | **chat** | **verrouillé v1.0** | [chat.md](features/chat.md) | P0 | bon (orchestrator + chat reducer + stores) | moyen (safety gate, ChatDock SSE buffer, approval E2E) |
| F-04 | **missions** | **verrouillé v1.0** | [missions.md](features/missions.md) | P1 | bon (lease + scheduler + export) | moyen (cron edge cases, ownership cross-user, mission context partial) |
| F-05 | runs | non verrouillé | — | P1 | partiel | moyen |
| F-06 | reports | non verrouillé | — | P1 | bon | faible |
| F-07 | assets | non verrouillé | — | P1 | partiel | moyen |
| F-08 | memory-kg | non verrouillé | — | P1 | partiel | élevé |
| F-09 | daily-brief | non verrouillé | — | P1 | bon | faible |
| F-10 | personas | non verrouillé | — | P2 | bon | faible |
| F-11 | connections | non verrouillé | — | P1 | partiel | moyen |
| F-12 | voice | non verrouillé | — | P2 | partiel | élevé |
| F-13 | browser | non verrouillé | — | P2 | partiel | élevé |
| F-14 | meetings | non verrouillé | — | P2 | bon | moyen |
| F-15 | marketplace | review | — | P2 | partiel | moyen |
| F-16 | commandeur | non verrouillé | — | P1 | manquant | élevé |
| F-17 | timeline-rail | in_progress | — | P2 | manquant | élevé |
| F-18 | context-rail | in_progress | — | P2 | partiel | élevé |
| F-19 | **stage** | **verrouillé v1.0** | [stage.md](features/stage.md) | P0 | partiel (stage store + focal store présent) | élevé (Stage routing, focal pin lock, mappers, sous-Stages, hotkeys) |
| F-20 | admin | non verrouillé | — | P2 | partiel | moyen |
| F-21 | notifications | non verrouillé | — | P2 | bon | faible |
| F-22 | webhooks | non verrouillé | — | P2 | bon | faible |
| F-23 | workflows | review | — | P2 | partiel | moyen |
| F-24 | datasets | review | — | P3 | manquant | élevé |
| F-25 | simulation | review | — | P3 | manquant | élevé |
| F-26 | artifact | in_progress | — | P2 | partiel | moyen |
| F-27 | onboarding | review | — | P3 | présent | faible |
| F-28 | settings | non verrouillé | — | P2 | manquant | moyen |
| F-29 | hospitality | review | — | P3 | manquant | élevé |
| F-30 | pulsebar | non verrouillé | — | P2 | manquant | moyen |
| F-31 | planner | review | — | P3 | manquant | élevé |
| F-32 | electron | review | — | P3 | manquant | élevé |

**Statuts possibles** :
- `non verrouillé` — autonomie standard, pas de spec figée
- `verrouillé v<n>` — spec figée, invariants à respecter
- `in_progress` — feature en construction active, pas verrouillable encore
- `review` — périmètre flou, à clarifier avant verrouillage
- `legacy` — pressenti obsolète, à vérifier avant suppression

## Ordre de verrouillage proposé

P0 d'abord (bloque tout si régression), puis P1, puis P2.

```
Verrouillés :
  - cockpit  (P1, pilote)         v1.x
  - auth     (P0)                 v1.0 — 2026-05-03
  - stage    (P0)                 v1.0 — 2026-05-04
  - chat     (P0)                 v1.0 — 2026-05-04
  - missions (P1)                 v1.0 — 2026-05-04

À faire (ordre proposé) :
  1. assets    (P1) — hybrid storage R2/Supabase
  2. connections (P1) — write-guard Composio
  3. reports   (P1) — sharing token public
  4. memory-kg (P1) — backfill destructif possible
  5. (... reste à arbitrer après ces 4)
```

🎉 **Tous les P0 sont maintenant verrouillés.** P1 en cours (1/4 fait).

## Procédure pour verrouiller une nouvelle feature

1. Scan détaillé du périmètre (composants, API, stores, deps externes)
2. Copier `docs/features/_template.md` → `docs/features/<id>.md`
3. Remplir toutes les sections avec ce qui est **réellement dans le code** (pas d'aspirational)
4. Identifier les invariants — règle : un invariant = une chose qui, si elle changeait, casserait silencieusement quelque chose
5. Lister les tests existants et ceux qui manquent
6. Soumettre à Adrien pour validation
7. Une fois validé : ajouter une entrée dans [docs/rules/locked-zones.md](rules/locked-zones.md)
8. Mettre à jour ce fichier (`AGENT-DRIVEN-DEV.md`) : tableau de bord features

## Drift connu (à clore)

État `git status` au moment du verrouillage cockpit :

```
M  app/(user)/components/ChatInput.tsx
M  app/(user)/components/ContextRail.tsx
M  app/(user)/components/StageFooter.tsx
M  app/(user)/components/cockpit/ActivityStrip.tsx
M  app/(user)/components/cockpit/CockpitAgenda.tsx
M  app/(user)/components/cockpit/CockpitHeader.tsx
M  app/(user)/components/cockpit/CockpitHome.tsx
M  app/(user)/components/cockpit/KPIStrip.tsx
M  app/(user)/components/cockpit/QuickActionsGrid.tsx
M  app/(user)/components/cockpit/WatchlistMini.tsx
M  app/(user)/components/right-panel/GeneralDashboard.tsx
M  app/(user)/layout.tsx
M  app/globals.css
```

⚠ La spec `cockpit` a été écrite **après** ces modifications locales — donc le verrouillage capture l'état *avec* ces changements. Si Adrien revert ces modifs, la spec doit être relue.

## Bugs runtime observés (orthogonaux au verrouillage, à traiter en feature séparée)

- `402 Payment Required` sur `/api/v2/assets/{id}/variants` (logs dev `2026-05-03`) — probable quota provider IA dépassé
- `400 Bad Request` même endpoint
- `[notifications] startPolling() est déprécié` — migration realtime non finie
- Composio SDK `0.6.11` vs `0.8.1` dispo

## Liens

- [Inventaire features complet (Phase 1)](features/) — toutes les specs au fur et à mesure
- [Index des verrous](rules/locked-zones.md)
- [Template spec](features/_template.md)
- [CLAUDE.md](../CLAUDE.md) — règles autonomie générales
- [README.md](../README.md) — entrée projet

## Historique

| Date | Événement |
|------|-----------|
| 2026-05-03 | Phase 1 — Inventaire 32 features |
| 2026-05-03 | Phase 2 — Pilote `cockpit` verrouillé v1.0 |
| 2026-05-03 | `auth` verrouillé v1.0 (P0, première après pilote) |
| 2026-05-04 | `stage` verrouillé v1.0 (P0, routing UI central, 15 invariants) |
| 2026-05-04 | `chat` verrouillé v1.0 (P0, cœur produit, 18 invariants) — tous les P0 sont fait |
| 2026-05-04 | `missions` verrouillé v1.0 (P1, scheduler distribué + lease + memory, 18 invariants) |
