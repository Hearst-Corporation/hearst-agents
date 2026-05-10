# Hearst Card — `hearst-card`

## Métadonnées

| Champ              | Valeur                                                               |
| ------------------ | -------------------------------------------------------------------- |
| **id**             | `hearst-card`                                                        |
| **statut**         | `in_progress`                                                        |
| **owner**          | Adrien                                                               |
| **dernière revue** | 2026-05-10                                                           |
| **version spec**   | 1.0                                                                  |
| **niveau**         | P2 — wrapped mensuel public partageable, fail-soft Playwright requis |
| **livrée**         | Sprint 4 (S4-A)                                                      |

## Description

"Wrapped" mensuel inspiré de Spotify : agrégation de l'activité du mois (missions exécutées, assets créés, briefs, top sources, KPIs), rendu visuel signature exporté en PNG via Playwright headless, avec partage public via URL HMAC signée. Le cron Inngest génère automatiquement la card du mois précédent le 1er de chaque mois à 9h Paris.

Philosophie : **objet émotionnel** (récap éditorial des accomplissements du mois) plus que tableau de bord. Token HMAC permet de partager une card publique sans exposer la session.

## Surface publique

### Pages

- [app/hearst-card/[userId]/[yearMonth]/page.tsx](../../app/hearst-card/[userId]/[yearMonth]/page.tsx) — page privée, requiert session, rend la card pour l'utilisateur connecté
- [app/public/hearst-card/[token]/page.tsx](../../app/public/hearst-card/[token]/page.tsx) — page publique, vérifie HMAC, rend la card en mode lecture-seule

### Endpoints API

- `GET /api/v2/hearst-card/[yearMonth]` ([route.ts](../../app/api/v2/hearst-card/[yearMonth]/route.ts))
  - **Auth** : `requireScope()`
  - **Input** : `yearMonth` format `YYYY-MM` (ex `2026-04`)
  - **Output** : `MonthlyCardPayload` agrégé (KPIs, top missions, top sources, narration)
  - **Cache** : 1h via Cache-Control headers

### Composants

- [lib/cockpit/monthly-card-view.tsx](../../lib/cockpit/monthly-card-view.tsx) — composant React qui rend la card (layout signature pour PNG export)

## Architecture interne

### Librairies internes

- [lib/cockpit/monthly-card.ts](../../lib/cockpit/monthly-card.ts) — `getMonthlyCard(userId, yearMonth)` : agrège missions, assets, briefs, sources sur la fenêtre `YYYY-MM-01..fin de mois`. Génère narration éditoriale.
- [lib/cockpit/monthly-card-token.ts](../../lib/cockpit/monthly-card-token.ts) — sign/verify HMAC token (`{ userId, yearMonth, exp }` → token base64url). Secret via `MONTHLY_CARD_SECRET`.
- [lib/jobs/inngest/functions/monthly-card.ts](../../lib/jobs/inngest/functions/monthly-card.ts) — fonction Inngest cron `0 9 1 * *` (Paris TZ) → boucle sur tous les users actifs → génère + persiste la card du mois précédent.

### Génération PNG

- Playwright headless lance la page privée serveur-side, screenshot en `1200x630` (open-graph compatible).
- Fail-soft : si Playwright crash (env serverless sans bin), on garde la version HTML/JSON sans PNG. La card reste consultable via la page Next.

### Dépendances externes

- `playwright` — PNG export (optionnel, fail-soft)
- Inngest — orchestration cron mensuel
- Anthropic SDK (Haiku) — narration éditoriale ≤ 200ch

## Data flow

```
[Cron Inngest "0 9 1 * *" Paris TZ]
   ↓ liste users actifs
[Pour chaque user : getMonthlyCard(userId, yearMonth-1)]
   ↓ agrège missions + assets + briefs + sources sur la fenêtre
   ↓ narration Haiku
[Sign HMAC token { userId, yearMonth, exp: +30j }]
   ↓ persiste asset kind=hearst_card
   ↓ Playwright PNG screenshot (fail-soft)
   ↓ R2 upload
[User reçoit notification "Ta Hearst Card d'avril est prête"]
```

## Invariants verrouillés

### I-1. Token HMAC obligatoire pour le partage public

La page `/public/hearst-card/[token]` **doit** vérifier la signature HMAC avant de rendre. Pas de fallback "userId+yearMonth en clair" sans token. Secret via env `MONTHLY_CARD_SECRET`.

### I-2. Format `yearMonth` strict `YYYY-MM`

Validation Zod côté endpoint et token. Pas de mois futurs (max = mois en cours).

### I-3. Fail-soft Playwright

Toute erreur Playwright (pas installé, timeout, crash) → la card reste accessible en HTML, le PNG est juste manquant. Ne fail pas le job Inngest.

### I-4. Cache 1h sur l'endpoint

`Cache-Control: private, max-age=3600` sur `GET /api/v2/hearst-card/[yearMonth]`. Le payload mensuel ne change quasiment plus passé le 1er du mois.

### I-5. Cron mensuel `0 9 1 * *` Paris TZ

1er du mois à 9h Paris (heure éditoriale, pas UTC). Génère la card du **mois précédent**.

### I-6. TTL token public 30 jours

Le token signé expire à +30j (rotation forcée si re-partage après ce délai). Stocké dans `exp` du payload HMAC.

## Évolutions autorisées sans spec

- Ajout de KPIs dans le payload `MonthlyCardPayload`
- Refonte visuelle de `monthly-card-view.tsx` (layout, typo, couleurs)
- Polish de la narration Haiku (prompt, longueur)
- Ajout d'un partage Twitter/Linkedin direct
- Cache TTL ajustable
- Fail-soft additionnel sur sources d'agrégation

## Risques & modes de défaillance

| Risque                              | Impact                    | Mitigation actuelle                                       |
| ----------------------------------- | ------------------------- | --------------------------------------------------------- |
| Playwright bin absent en serverless | PNG manquant              | Fail-soft : HTML reste accessible                         |
| HMAC secret leak                    | Cards publiques forgables | Rotation secret + invalidation tokens (manuel)            |
| Cron Inngest miss                   | Cards retardées           | Trigger manuel possible via endpoint admin                |
| Aggregation lente (user actif)      | Timeout 60s               | Window mensuelle bornée + index DB sur (user, created_at) |
| Token expiré                        | Page publique 410         | Message clair + CTA "régénérer le lien"                   |

## Tests

### Manquants (gap)

- Test sign/verify token HMAC (round-trip + altération)
- Test idempotence cron (re-run même mois ne dup pas)
- Test fail-soft Playwright (mock crash → HTML survive)
- Test cache header sur endpoint
- Test format `yearMonth` invalide → 400

## Notes & historique

- **Sprint 4 livraison initiale** — wrapped mensuel + partage HMAC + cron Inngest.
- Pas encore verrouillé v1.0 : l'expérience visuelle peut encore évoluer.
