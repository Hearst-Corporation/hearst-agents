# Pre-Meeting Intel — `pre-meeting-intel`

## Métadonnées

| Champ              | Valeur                                                            |
| ------------------ | ----------------------------------------------------------------- |
| **id**             | `pre-meeting-intel`                                               |
| **statut**         | `in_progress`                                                     |
| **owner**          | Adrien                                                            |
| **dernière revue** | 2026-05-10                                                        |
| **version spec**   | 1.0                                                               |
| **niveau**         | P2 — briefing automatique sur events Calendar, fail-soft critique |
| **livrée**         | Sprint 3 (S3-A)                                                   |

## Description

Briefing automatique généré 30 minutes avant chaque événement Google Calendar. Pour chaque participant identifié (email), lookup dans le Knowledge Graph utilisateur (interactions passées, threads, mentions). Génère un agenda court via Claude Haiku : qui sont les participants, contexte récent, points à aborder, questions à poser.

Philosophie : **devancer la prep meeting** — quand le user reçoit le push 25-35min avant, tout est déjà prêt. Le ContextRail change automatiquement vers une vue dédiée.

## Surface publique

### Composants

- [app/(user)/components/ContextRailForPreMeeting.tsx](<../../app/(user)/components/ContextRailForPreMeeting.tsx>) — surface ContextRail dédiée pendant la fenêtre 25-35min avant un event Calendar

### Pas d'endpoint dédié

Consommé via le payload `getCockpitToday()` (cf [cockpit.md](cockpit.md)) ou push notification.

## Architecture interne

### Librairies

- [lib/cockpit/pre-meeting-intel.ts](../../lib/cockpit/pre-meeting-intel.ts) — `buildPreMeetingIntel(scope, eventId)` : pour un event Calendar donné, lookup KG par participant + génère agenda Haiku
- [lib/jobs/inngest/functions/pre-meeting-intel.ts](../../lib/jobs/inngest/functions/pre-meeting-intel.ts) — fonction Inngest cron `*/5 * * * *` (toutes les 5 minutes) qui :
  1. Liste users actifs avec Calendar connecté
  2. Pour chaque user : liste events dans la fenêtre 25-35min à venir
  3. Filtre dédup (skip si intel déjà généré <30min)
  4. Génère intel + persiste dans `assets` kind=`pre_meeting_intel`
  5. Notifie le user (whisper PulseBar ou push)

### Knowledge Graph lookup

- Reuse `getKgContextForUser()` (cf [memory-kg.md](memory-kg.md))
- Filter par participant email
- Top 3 interactions récentes par participant

### Dépendances externes

- Composio `GOOGLECALENDAR_LIST_EVENTS` — fenêtre +25min..+35min
- Anthropic Haiku — génération agenda
- Inngest — cron `*/5 * * * *`

## Data flow

```
[Cron Inngest "*/5 * * * *"]
   ↓ users actifs avec Calendar connecté
[Per user : list events dans fenêtre +25..+35min]
   ↓ skip si intel déjà généré pour cet event (dedup 30min)
[buildPreMeetingIntel(scope, eventId)]
   ├─ KG lookup par participant email
   ├─ Haiku prompt → agenda { participants, contexte, points, questions }
   └─ persist asset kind=pre_meeting_intel
[ContextRail détecte fenêtre active]
   ↓ render ContextRailForPreMeeting avec intel
[User notifié 30min avant]
```

## Invariants verrouillés

### I-1. Cron `*/5 * * * *` (toutes les 5 minutes)

Fréquence figée pour rester réactif sur la fenêtre 25-35min. Sub-5min = trop coûteux Composio. Sup-5min = events ratés (window 10min trop courte).

### I-2. Fenêtre 25-35min avant l'event

Cron filtre les events `start` dans `[now+25min, now+35min]`. 30min cible avec ±5min de tolerance pour le timing du cron tick.

### I-3. Dédup 30min par event

Si un intel a déjà été généré pour cet `eventId` dans les 30min précédentes, skip. Évite les doublons quand le cron rejoue.

### I-4. Fail-soft Calendar + KG

- Si Composio Calendar down → skip ce user (log warn), pas de crash global
- Si KG lookup vide pour un participant → continue avec les autres
- Si Haiku quota dépassé → skip narration, persist intel "structure-only"

### I-5. Asset kind = `pre_meeting_intel`

Persisté dans la table `assets` avec `kind=pre_meeting_intel`, `metadata.eventId`, `metadata.eventStart`, `metadata.participantsCount`. Pas de table dédiée.

### I-6. ContextRail dédié pendant la fenêtre active

Pendant `[event.start - 35min, event.start]`, le ContextRail rend `ContextRailForPreMeeting` au lieu de la surface par défaut du Stage actif. Cohérent avec [context-rail.md](context-rail.md) (rail polymorphe par Stage).

## Évolutions autorisées sans spec

- Ajustement du prompt Haiku (longueur, sections)
- Ajout d'une section "documents partagés" (Drive lookup)
- Polish UI `ContextRailForPreMeeting`
- Nouveau type de lookup (Slack mentions, GitHub PR)
- Ajustement du seuil dédup (30min)
- Ajout d'un opt-out par event (extended properties Calendar)

## Risques & modes de défaillance

| Risque                                    | Impact                  | Mitigation actuelle                                            |
| ----------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| Composio quota dépassé                    | Pas d'intel             | Fail-soft, log warn                                            |
| Event privé (pas de participants exposés) | Intel vide              | OK, on rend ce qu'on peut                                      |
| Recurring event spam                      | Intel chaque occurrence | Dédup par `eventId` (Calendar génère ID unique par occurrence) |
| KG vide (nouvel utilisateur)              | Intel pauvre            | Acceptable — l'intel s'enrichit avec l'usage                   |
| User dans plusieurs TZ                    | Fenêtre off             | Composio retourne dates UTC, calcul fait UTC                   |
| Haiku JSON parse fail                     | Intel structure-only    | Fallback graceful                                              |

## Tests

### Manquants (gap)

- Test fenêtre 25-35min boundaries
- Test dédup 30min
- Test fail-soft Calendar / KG / Haiku
- Test cron skip user sans Calendar connecté
- Test ContextRailForPreMeeting render dans la fenêtre active
- E2E : event simulé +30min → intel généré → ContextRail switch

## Notes & historique

- **Sprint 3 (S3-A)** — release initiale, 30min avant + KG lookup + Haiku
