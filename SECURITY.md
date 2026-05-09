# Sécurité — Hearst OS

## Politique secrets

- `.env.local` (et toute variante `.env*`) **ne sont jamais commités** — déjà couverts par `.gitignore`.
- Les secrets de prod vivent dans Vercel (Project Settings → Environment Variables) et Supabase (Vault pour les keys runtime).
- Pour partager un secret en équipe : 1Password / Vercel team scope, jamais Slack / mail / git.
- Rotation : `NEXTAUTH_SECRET`, `HEARST_API_KEY`, providers OAuth → tous les 90 jours minimum, ou immédiatement après suspicion de fuite.

## Routes protégées par Arcjet

Voir `proxy.ts` → `ARCJET_PROTECTED_PATHS` :

- `/api/orchestrate` (règles **strictes** — coût LLM)
- `/api/v2/jobs`
- `/api/v2/missions`
- `/api/auth`

Arcjet applique : rate limit + bot detection + shield (XSS/SQLi). Désactivé si `ARCJET_KEY` absent (`isArcjetEnabled()`).

## Auth & dev bypass

- Auth normale : session NextAuth (cookie `next-auth.session-token` ou `__Secure-…`) **ou** `HEARST_API_KEY` via header `x-api-key` / `Authorization: Bearer …`.
- `HEARST_DEV_AUTH_BYPASS=1` : flag **dev-only** qui court-circuite l'auth dans `proxy.ts`. Boot guard prod doit refuser ce flag (vérifier `lib/env.server.ts`). Ne **jamais** activer en prod.

## Rapports de vulnérabilités

Email sécurité : **à définir** (placeholder `security@hearstcorporation.io`). En attendant, ouvrir une issue privée GitHub ou contacter Adrien direct.

Ne pas divulguer publiquement avant patch (90 jours window standard).

## Dépendances

```bash
npm audit --omit=dev --audit-level=high
```

À intégrer dans le CI (pre-deploy ou daily cron). Les vulnérabilités `high`/`critical` doivent être patchées sous 7 jours en prod.

## Electron

Configuration sécurité (vérifiée dans `electron/main.ts`) :

- `nodeIntegration: false`
- `contextIsolation: true`

Préload script : `electron/preload.ts` — expose seulement les APIs nécessaires via `contextBridge`. Aucun accès direct `require()` côté renderer.

Si tu modifies `electron/main.ts` ou `electron/preload.ts`, audit sécurité recommandé : pas de `webSecurity: false`, pas d'`allowRunningInsecureContent`, CSP stricte.

## Données utilisateur

- Stockées dans Supabase (RLS activé sur les tables sensibles — vérifier `supabase/migrations/`).
- Assets dans Supabase Storage (bucket `assets`) ou R2 fallback.
- Secrets utilisateur (OAuth tokens, API keys connecteurs) chiffrés côté DB via `lib/security/`.

## Liens

- [proxy.ts](proxy.ts) — guard auth + Arcjet
- [lib/env.server.ts](lib/env.server.ts) — validation env vars
- [lib/security/](lib/security/) — Arcjet + chiffrement secrets
- [RUNBOOK.md](RUNBOOK.md) — procédures incident sécurité
