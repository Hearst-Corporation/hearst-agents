# API Routes legacy stables — Hearst OS

> Ce fichier est la documentation de référence des routes legacy non-versionnées.
> Il est maintenu manuellement (contrairement à `docs/api-routes.md` qui est auto-généré).

## Routes legacy stables (non-versionnées)

Ces routes sont consommées par le frontend production et **resteront stables** malgré l'absence de préfixe `/v2`. Pas de plan de migration immédiat — documenter explicitement pour clarifier l'intention (audit interne 2026-05-22).

| Route | Usage | Stabilité |
|---|---|---|
| `/api/orchestrate` | Lance un run conversationnel | stable |
| `/api/orchestrate/abort/:runId` | Abort run | stable |
| `/api/agents` | CRUD agents | stable |
| `/api/agents/:id/chat` | Chat agent | stable |
| `/api/reports/*` | Reports (templates, share, comments, versions, export, rerun) | stable |
| `/api/conversations/*` | Conversations | stable |
| `/api/composio/*` | Intégrations Composio (apps, connect, connections, diagnose) | stable |
| `/api/connections/*` | Connexions natives (native, expiring) | stable |
| `/api/notifications/*` | Notifications in-app | stable |
| `/api/settings/*` | Settings utilisateur | stable |
| `/api/briefing` | Daily brief generation | stable |
| `/api/user/theme` | Préférences thème UI | stable |
| `/api/analytics` | Métriques user-facing | stable |
| `/api/tools` | Liste tools disponibles | stable |

Le namespace `/api/v2/*` reste réservé aux nouvelles APIs (missions, plans, assets, jobs, runs, daily-brief, KG, etc.). Les routes legacy ci-dessus **ne seront pas dépréciées sans publication d'un changelog 60 jours avant.**

---
