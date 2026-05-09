# Runbook — Hearst OS

Procédures incident et opérations courantes. Pour le pipeline LLM voir **[docs/RUNBOOK-LLM.md](docs/RUNBOOK-LLM.md)** (retries, fallback providers, observabilité Langfuse).

## Procédures incident

### Vercel deploy KO

1. Aller sur Vercel dashboard → Deployments → identifier le dernier deploy `Ready`.
2. **Promote to production** (rollback instantané, pas de rebuild).
3. Vérifier les env vars du deploy promu (Project Settings → Environment Variables) : `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, providers OAuth, `SUPABASE_*`, `SENTRY_DSN`, `ARCJET_KEY`, `INNGEST_*`.
4. Inspecter les logs du build cassé (Build Logs) — souvent : env var manquante, deps Electron non strippées, ou `instrumentation.ts` qui charge BullMQ workers (devrait être gated `VERCEL=1`).
5. Une fois la cause confirmée, fix sur `main` puis push, le redeploy auto-trigger.

### Sentry alerte

1. Ouvrir l'issue Sentry, vérifier `Release` (doit matcher le commit SHA déployé).
2. Si source maps manquantes : vérifier que `next.config.ts withSentryConfig` est actif et que le build CI a bien uploadé (action `@sentry/cli`).
3. `monitoring/` est la **route tunnel Sentry** (déjà dans PUBLIC_PATHS de `proxy.ts`) — ne pas la retirer sinon les events client sont bloqués par adblock / Arcjet.
4. Pour reproduire en local : utiliser `Sentry CLI` ou répliquer la requête dans `app/global-error.tsx`.

### Arcjet bloque trop

Routes Arcjet-protégées (cf. `proxy.ts`) : `/api/orchestrate`, `/api/v2/jobs`, `/api/v2/missions`, `/api/auth`. Règles strictes sur `/api/orchestrate` (coût LLM).

1. Logs Arcjet (dashboard) → identifier IP / fingerprint.
2. Whitelist IP via Arcjet dashboard (Rules → Allowlist).
3. Pour désactiver Arcjet temporairement : `unset ARCJET_KEY` (le proxy fait `isArcjetEnabled()` check).
4. Pour retirer une route de la liste protégée : éditer `ARCJET_PROTECTED_PATHS` dans `proxy.ts` (PR + valider auth flow).

### Supabase down

Le storage adapter (`lib/engine/runtime/assets/storage`) a un fallback automatique :

```
Supabase Storage  →  R2 (S3-compatible)  →  local dev (.runtime-assets)
```

Voir `instrumentation.ts` pour la priorité. Si Supabase DB elle-même tombe :

1. Vérifier https://status.supabase.com/.
2. Mode dégradé : afficher la dernière donnée cachée (Zustand persist côté client).
3. Si downtime > 1 h : envisager bascule lecture-seule.

### Port 9001 occupé

```bash
lsof -ti tcp:9001 | xargs kill -9
```

`npm run dev` le fait déjà au démarrage. Si un process zombie persiste, redémarrer le terminal.

### `.next` pourri (HMR cassé, types stale, build qui rate)

```bash
npm run dev:fresh
```

Équivalent : `rm -rf .next && npm run dev`. Si ça persiste, supprimer aussi `tsconfig.tsbuildinfo`.

### Workers BullMQ orphelins

```bash
npm run workers:audit          # liste les workers Node spawned
npm run workers:kill-orphans   # kill les orphelins (script next-worker-helper.sh)
```

Symptôme typique : ports en conflit, jobs qui stagnent dans Redis, mémoire qui gonfle.

### Verrou ADD coincé

Le verrou est piloté par `docs/AGENT-LOCK.json`. Si `locked === true` et qu'Adrien doit débloquer :

1. **Voie normale** : aller dans `/admin/agent-driven-dev` (interface gouvernance).
2. **Voie d'urgence** : éditer `docs/AGENT-LOCK.json` direct → `{ "locked": false, "lockedAt": null, "lockedBy": null, "reason": null }`.

Le hook `scripts/check-agent-lock.mjs` (PreToolUse Edit/Write/NotebookEdit) bloquera tout agent tant que `locked === true`.

### Migration cassée / DB dégradée

- Migrations Supabase : voir `supabase/migrations/` + dashboard SQL editor.
- Snapshot avant migration prod (Database → Backups).
- Si rollback nécessaire : migration inverse manuelle, pas d'auto-rollback.

## Observability

| Outil | Rôle | Lien dashboard |
| --- | --- | --- |
| Sentry | Erreurs server + client + source maps | [https://sentry.io/organizations/hearst-os/](https://sentry.io/) — projet `hearst-os` |
| Axiom | Logs structurés (server, jobs, LLM) | [https://app.axiom.co/](https://app.axiom.co/) |
| Langfuse | Traces LLM (prompts, completions, coûts) | [https://cloud.langfuse.com/](https://cloud.langfuse.com/) ou self-host |
| Vercel Analytics | Web vitals, real user monitoring | Vercel dashboard → Analytics |
| Supabase | Logs Postgres + Storage | Supabase dashboard → Logs |
| Inngest | Runs jobs async + retries | Inngest dashboard |

## Health checks

```bash
npm run health   # scripts/health-check.ts — env vars + services + providers
npm run audit    # scripts/audit-pipeline.ts — pipeline LLM + workers + queues
```

## Liens internes

- [docs/RUNBOOK-LLM.md](docs/RUNBOOK-LLM.md) — pipeline LLM détaillé
- [docs/AGENT-DRIVEN-DEV.md](docs/AGENT-DRIVEN-DEV.md) — protocole agent + verrou
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — erreurs récurrentes dev
- [SECURITY.md](SECURITY.md) — politique sécurité + secrets
