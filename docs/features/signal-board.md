# Signal Board — `signal-board`

## Métadonnées

| Champ              | Valeur                                                          |
| ------------------ | --------------------------------------------------------------- |
| **id**             | `signal-board`                                                  |
| **statut**         | `in_progress`                                                   |
| **owner**          | Adrien                                                          |
| **dernière revue** | 2026-05-10                                                      |
| **version spec**   | 1.0                                                             |
| **niveau**         | P2 — surface ambiante d'exception, pas critique mais surface UX |
| **livrée**         | Q3 (Q3-B) + Sprint 3 (S3-B Stage dédié)                         |

## Description

Tableau d'**ambient signals** (signaux faibles à long-terme) qui complète les notifications classiques. Détecte 5 types d'incidents système ou inactivités utilisateur, affichés en mode "whisper" dans la PulseBar (un point coloré sourd) et détaillés dans un Stage dédié `SignalBoardStage`.

Philosophie : **OS humain** — l'app se signale comme un compagnon discret quand quelque chose mérite l'attention de l'utilisateur, sans alarmes intrusives. Severity reste sourde (pas de rouge vif, pas de toast), respect pivot visuel "silent luxury".

## Surface publique

### Composants

- [app/(user)/components/stages/SignalBoardStage.tsx](<../../app/(user)/components/stages/SignalBoardStage.tsx>) — Stage dédié, liste les signals actifs avec filtres par kind / severity
- [app/(user)/components/PulseBar.tsx](<../../app/(user)/components/PulseBar.tsx>) — affiche le whisper (dot sourd + count) si signals actifs

### Endpoints API

- `GET /api/v2/cockpit/signals` ([route.ts](../../app/api/v2/cockpit/signals/route.ts))
  - **Auth** : `requireScope()`
  - **Output** : `{ signals: AmbientSignal[], generatedAt: number }`
  - **Cache** : 60s

## Architecture interne

### Librairies

- [lib/cockpit/ambient-signals.ts](../../lib/cockpit/ambient-signals.ts) — `getAmbientSignals(scope)` : assemble 5 détecteurs en parallèle fail-soft
  1. `mission_failed` — missions avec `lastRunStatus=failed` dans les dernières 24h
  2. `oauth_expired` — connexions Composio dont le token a expiré
  3. `brief_stale` — daily brief absent depuis >24h alors qu'attendu
  4. `variant_timeout` — jobs vidéo en timeout sans suite
  5. `mission_silent` — mission active dont la dernière run réussie remonte à >7j

### Types

```ts
type SignalKind =
  | "mission_failed"
  | "oauth_expired"
  | "brief_stale"
  | "variant_timeout"
  | "mission_silent";
type SignalSeverity = "info" | "attention" | "warn"; // jamais "danger"

interface AmbientSignal {
  id: string; // hash kind + entityId
  kind: SignalKind;
  severity: SignalSeverity;
  title: string; // FR voix régulière
  body?: string;
  entityId?: string; // missionId, providerId, etc.
  cta?: { label: string; href: string };
  createdAt: number;
  expiresAt: number; // TTL 30min
}
```

## Data flow

```
[GET /api/v2/cockpit/signals]
   ↓ getAmbientSignals(scope)
   ↓ 5 détecteurs en parallèle (fail-soft chacun)
   ↓ filter expiresAt > now
   ↓ dedup par id
[Cache 60s par (userId, tenantId)]
   ↓ Response { signals[], generatedAt }
[PulseBar consume]
   ↓ count > 0 → whisper dot sourd
[User clic whisper]
   ↓ navigate SignalBoardStage
   ↓ liste filtrable, CTA par signal
```

## Invariants verrouillés

### I-1. 5 kinds figés

`mission_failed`, `oauth_expired`, `brief_stale`, `variant_timeout`, `mission_silent`. Ajouter un kind = update spec. Modifier la sémantique d'un kind = update spec.

### I-2. Severity sourde — pas de rouge intense

Palette : `info` (gris), `attention` (teal sourd), `warn` (or sourd). Pas de `danger` rouge vif. Cohérent avec pivot visuel "silent luxury OS" (cf [cockpit.md](cockpit.md) I-8).

### I-3. TTL 30min par signal

Chaque signal expire 30min après création (`expiresAt`). Les détecteurs re-créent le signal au tick suivant si la condition persiste. Évite l'accumulation infinie.

### I-4. Cache 60s côté endpoint

`Cache-Control: private, max-age=60` sur `/api/v2/cockpit/signals`. Acceptable car les signals sont par nature faibles et long-terme.

### I-5. Fail-soft par détecteur

Chaque détecteur (mission_failed, oauth_expired, etc.) **doit** être wrappé dans `safe<T>()`. Une erreur sur un détecteur ne kill pas les 4 autres.

### I-6. Whisper dans PulseBar uniquement

Pas de toast. Pas de modal. Pas de notification système. Le seul point d'entrée passif est le dot whisper de la PulseBar. Le user peut ignorer 100% des signals si il choisit.

### I-7. Voix régulière FR

Titres/body en français voix régulière (ex: "3 missions en échec hier", "Connexion HubSpot expirée"). Pas de mono caps "MISSION FAILED" ni anglais. Cohérent avec voix éditoriale CLAUDE.md.

## Évolutions autorisées sans spec

- Ajout d'un nouveau détecteur **dans un kind existant** (ex: étendre `mission_failed` à 48h au lieu de 24h)
- Ajustement des thresholds (durée, count, etc.)
- Polish UI SignalBoardStage (filters, sorting, empty states)
- Ajout de CTA contextuels par signal
- Cache TTL ajustable

## Risques & modes de défaillance

| Risque                            | Impact                         | Mitigation actuelle                 |
| --------------------------------- | ------------------------------ | ----------------------------------- |
| Détecteur trop bavard             | Spam whisper                   | Severity capping + dedup id         |
| Détecteur DB lent                 | Latence /signals               | Cache 60s + parallèle fail-soft     |
| TTL trop court                    | Signal disparaît avant lecture | 30min jugé OK ; ajuster si feedback |
| OAuth expiry false-positive       | User confus                    | Vérifie `expires_at` + grace period |
| Mission_silent sur mission paused | False positive                 | Filter `enabled === true`           |

## Tests

### Manquants (gap)

- Test chaque détecteur isolément (mock conditions)
- Test fail-soft (1 détecteur throw → 4 autres OK)
- Test dedup par id (re-tick produit même signal → un seul)
- Test cache 60s
- Test PulseBar whisper rendering (count, severity)
- E2E : signal triggered → whisper visible → SignalBoardStage rendered

## Notes & historique

- **Q3 (Q3-B)** — release ambient-signals + endpoint + whisper PulseBar
- **Sprint 3 (S3-B)** — Stage dédié `SignalBoardStage` câblé
