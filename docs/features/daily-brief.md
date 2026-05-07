# Daily Brief — `daily-brief`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `daily-brief` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 — Inngest cron + providers externes multi-source |

## Description

Briefing éditorial quotidien PDF 2 pages signé par Claude Sonnet 4.6. Synthétise 5 sources user (Gmail 24h, Slack 4h, Calendar, GitHub PRs, Linear issues) + extras Composio. Orchestré via Inngest (event `app/daily-brief.requested`, 2 retries). Idempotent par (user, targetDate). PDF stocké R2 + signed URL 24h.

## Surface publique

- `POST /api/v2/daily-brief/generate` — enqueue Inngest ou inline
- `GET /api/v2/daily-brief/today` — brief du jour
- `GET /api/v2/daily-brief/history` — historique des briefs
- `GET /api/briefing` (v1 legacy) — brief du jour

Pas de store Zustand dédié. State via Inngest job queue + assets table.

## Types clés

```ts
interface DailyBriefData {
  emails: DailyBriefEmailItem[];    // Gmail 24h, max 12
  slack: DailyBriefSlackItem[];     // 4h window, max 8
  calendar: DailyBriefCalendarItem[]; // today + tomorrow
  github: DailyBriefGithubItem[];   // 7 jours, max 8
  linear: DailyBriefLinearItem[];   // 7 jours, max 8
  extras: ExtraSource[];
  sources: string[];  // "gmail:empty", "slack:error", etc.
  generatedAt: number;
  targetDate: string;  // YYYY-MM-DD
}

interface DailyBriefNarration {
  lead, people, decisions, signals: string;
  action?: string;  // optionnel
  costUsd: number;
}
```

Storage : assets table (kind=`daily_brief`). Pas de table dédiée.

## Invariants verrouillés

### I-1. Inngest function ID = `"daily-brief"`, retries = 2, event = `"app/daily-brief.requested"`

### I-2. Modèle = `claude-sonnet-4-6` avec prompt caching (pas Haiku, pas Opus)

### I-3. JSON output 4 sections minimum (lead, people, decisions, signals) + action optionnel
Parse robuste tolère prefix/suffix. Si parse fail → skip narration.

### I-4. Idempotence par (userId, targetDate)
Si asset kind=`daily_brief` pour la date existe → retour 200 + asset existant. Pas de re-génération.

### I-5. Assemblage fail-soft — source échoue → marquée dans `sources[]`
Ex: `"gmail:error"`, `"slack:empty"`. Le brief continue avec les sources disponibles.

### I-6. Limits par source figées
Gmail 24h max 12 · Slack 4h max 8 · GitHub 7j max 8 · Linear 7j max 8.

### I-7. PDF stocké R2, signed URL valide 24h

### I-8. `costUsd` calculé + stocké dans `contentRef` (metrics reporting)

### I-9. Fallback inline si pas d'Inngest : timeout 120s maximum (Vercel)

### I-10. `targetDate` format ISO `YYYY-MM-DD` strict (Zod)

## Tests

Existants : `__tests__/memory/briefing-injection.test.ts` (format + serialization)

Manquants : idempotence date, sources fail-soft, limits par source, Inngest event schema, PDF upload R2, parse robuste JSON narration.
