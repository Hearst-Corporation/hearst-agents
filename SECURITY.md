# Sécurité — Hearst OS

## Politique secrets

- `.env.local` (et toute variante `.env*`) **ne sont jamais commités** — déjà couverts par `.gitignore`.
- Les secrets de prod vivent dans Vercel (Project Settings → Environment Variables) et Supabase (Vault pour les keys runtime).
- Pour partager un secret en équipe : 1Password / Vercel team scope, jamais Slack / mail / git.
- Rotation : tous les secrets application → **tous les 90 jours minimum**, ou immédiatement après suspicion de fuite.

## Rotation des secrets LLM

Les clés des fournisseurs IA externes doivent être régulièrement renouvelées pour éviter compromise suite à fuite.

### Procédure générale

1. **Générer la nouvelle clé** dans la console du fournisseur (Anthropic / OpenAI / Kimi API / Composer)
2. **Mettre à jour Vercel** : Project Settings → Environment Variables → éditer `API_KEY_*` avec la nouvelle valeur
3. **Redéployer** : déclenche auto-déploiement via webhook GitHub (ou `vercel deploy --prod`)
4. **Vérifier** : 24-48h après le déploiement, revenir à la console du fournisseur pour révoquer l'ancienne clé
5. **Logger l'action** : date + fournisseur + rotation UUID/hash dans un log audit (optionnel mais recommandé)

### Clés spécifiques

| Clé | Fournisseur | Cadence | Console |
|-----|-------------|---------|---------|
| `ANTHROPIC_API_KEY` | Anthropic | 90j | https://console.anthropic.com/ |
| `OPENAI_API_KEY` | OpenAI | 90j | https://platform.openai.com/account/api-keys |
| `KIMI_API_KEY` | Moonshot AI (Kimi) | 90j | https://platform.moonshot.cn/ |
| `COMPOSER_API_KEY` | Composer (si actif) | 90j | https://composer.io/account |

### Signes de fuite à surveiller

- Spike inattendu de requêtes ou de coûts facturation IA
- Alertes email du fournisseur (« clé utilisée depuis localité non-habituelle »)
- Détection GitHub Gitleaks d'une clé en clair dans git history
- Rapport utilisateur d'erreurs d'authentification IA en cascade

**En cas de suspicion immédiate** : révoquer la clé WITHOUT délai de 24h, générer replacement immédiat, redéployer.

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

## Scans automatiques

Workflows GitHub Actions actifs sur `main` (push + PR + cron lundi) :

- **Gitleaks** — secret scanning sur tout l'historique. Cron lundi 9h. Config : [.gitleaks.toml](.gitleaks.toml). Workflow : [.github/workflows/gitleaks.yml](.github/workflows/gitleaks.yml).
- **CodeQL** — SAST JavaScript/TypeScript (preset `security-extended`). Cron lundi 6h. Workflow : [.github/workflows/codeql.yml](.github/workflows/codeql.yml). Les alertes apparaissent dans l'onglet **Security → Code scanning** du repo.
- **npm audit** — intégré dans le CI principal ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

Activer **Code scanning alerts** dans Settings → Security du repo si pas déjà fait.

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
