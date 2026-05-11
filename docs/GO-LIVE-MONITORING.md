# Go-Live Monitoring & Infrastructure Runbook

**Date** : 2026-05-11
**Scope** : GL.5 du Battle Plan sécurité — configuration monitoring + infrastructure avant go-live multi-user public.

---

## 1. Variables d'environnement Vercel (prod)

Toutes ces vars doivent être set dans **Vercel → Project Settings → Environment Variables → Production** avant de promouvoir un build :

### Auth (critiques)

| Var                                         | Rôle                                                      | Source                             |
| ------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| `NEXTAUTH_URL`                              | URL canonique prod (https://hearst-agents.vercel.app)     | Vercel auto ou manual              |
| `NEXTAUTH_SECRET`                           | Signing JWT + OAuth state HMAC                            | `openssl rand -base64 32`          |
| `HEARST_ALLOWED_EMAIL_DOMAINS`              | **OBLIGATOIRE** CSV des domaines email autorisés à signup | `hearstcorporation.io,partner.com` |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | NextAuth Google provider                                  | Google Cloud Console               |
| `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET`   | OAuth Slack                                               | Slack App                          |
| `HEARST_API_KEY`                            | Server-to-server API key                                  | `openssl rand -base64 32`          |
| `TOKEN_ENCRYPTION_KEY_1`                    | AES-256 hex 64 chars pour user_tokens encrypt             | `openssl rand -hex 32`             |
| `TOKEN_ENCRYPTION_KEY_ACTIVE`               | "1" (current), bump à "2" lors de rotation                | string                             |

### DB + Storage

| Var                             | Rôle                                 |
| ------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL projet Supabase prod (hearst-ai) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (safe client)               |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server-only**, jamais bundlé       |
| `SUPABASE_ACCESS_TOKEN`         | CLI access (optionnel prod)          |

### LLM Providers

| Var                                                             | Provider        |
| --------------------------------------------------------------- | --------------- |
| `ANTHROPIC_API_KEY`                                             | Anthropic       |
| `OPENAI_API_KEY`                                                | OpenAI          |
| `GEMINI_API_KEY`                                                | Google AI       |
| `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` + `LANGFUSE_HOST` | Langfuse traces |

### Jobs + Cache

| Var                                                                  | Rôle                                                |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| `INNGEST_SIGNING_KEY`                                                | **OBLIGATOIRE PROD** — hard throw si absent (F-007) |
| `INNGEST_EVENT_KEY`                                                  | Inngest event send                                  |
| `REDIS_URL` ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate-limit + agent-lock state + cache web_search    |

### Observabilité

| Var                                                   | Rôle                           |
| ----------------------------------------------------- | ------------------------------ |
| `SENTRY_DSN`                                          | Errors capture                 |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` | Sourcemaps upload (build-time) |
| `NEXT_PUBLIC_SENTRY_DSN`                              | Client Sentry                  |
| `AXIOM_DATASET` + `AXIOM_TOKEN`                       | Logs structurés (optionnel)    |

### Sécurité externe

| Var                 | Rôle                            |
| ------------------- | ------------------------------- |
| `ARCJET_KEY`        | Rate-limit + bot detection edge |
| `RECALL_AI_API_KEY` | Meeting bots (optionnel)        |

### Garde-fous obligatoires en prod

⚠ Le boot Vercel **THROW** si une de ces vars manque en `NODE_ENV=production` :

- `NEXTAUTH_SECRET` (sinon JWT signing impossible)
- `HEARST_ALLOWED_EMAIL_DOMAINS` (sinon open enrollment — F-096)
- `INNGEST_SIGNING_KEY` (sinon `/api/inngest` accepte tout — F-007)

⚠ Ces vars **NE DOIVENT JAMAIS** être en prod :

- `HEARST_DEV_AUTH_BYPASS=1` → bypass auth (`isProductionEnv()` throw au boot — F-053)

---

## 2. Sentry — Configuration alertes

### Settings projet (Sentry dashboard)

- **`sendDefaultPii: false`** ✅ (configuré en code via `sentry.server.config.ts`)
- **`includeLocalVariables` retiré** ✅
- **Replay** : `maskAllText: true`, `maskAllInputs: true`, `blockAllMedia: true` ✅
- **`replaysSessionSampleRate: 0`** (pas de replay continu) ✅
- **`replaysOnErrorSampleRate: 1.0`** (replay uniquement sur erreur)
- **`beforeSend`** scrub : prompt/system/message/headers Authorization/cookie ✅

### Alertes à configurer (Sentry → Alerts)

#### Alerte 1 : Error rate spike (critique)

- **Conditions** : Error count > 50 events in 5 minutes
- **Actions** : Email + Slack #alerts-prod
- **Filtre** : `environment:production`

#### Alerte 2 : Auth failure spike (signal d'attaque)

- **Conditions** : Issue with tag `module:auth` count > 20 in 5 min
- **Actions** : Email + Slack #security-alerts
- **Notes** : Détecte brute-force auth / scan API key

#### Alerte 3 : LLM budget runaway

- **Conditions** : Issue with message contains `CostLimitExceededError` count > 5 in 1 hour
- **Actions** : Email + investigate per-user

#### Alerte 4 : SSRF attempts (signal d'attaque)

- **Conditions** : Issue with message contains `SsrfBlockedError` count > 3 in 5 min
- **Actions** : Email + Slack #security-alerts + investigate user

#### Alerte 5 : Tenant scope CRITICAL

- **Conditions** : Issue with message contains `[Scope] CRITICAL` count > 0
- **Actions** : PageDuty (= bug auth qui doit être fixé immédiatement)

### Sourcemaps upload (build)

Verifier que `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` sont set en build env :

```bash
# next.config.ts withSentryConfig active automatiquement si les 3 vars présentes
```

---

## 3. Langfuse — Dashboard cost monitoring

### Settings cloud Langfuse (cloud.langfuse.com)

- **PII redact** ✅ (configuré en code via `redactForLangfuse()`)
- **Retention** : 30 jours (gratuit) ou 90 jours (paid)
- **DPA** : confirmer EU region si traitement données EU users

### Dashboards à créer

#### Dashboard 1 : Cost monitoring per tenant

- **Metric** : `total_cost` (USD)
- **Group by** : `tenant_id` (depuis metadata trace)
- **Time range** : Last 30 days
- **Alerts** : Si un tenant > $50/jour → email

#### Dashboard 2 : Latency p95/p99 per model

- **Metric** : `latency`
- **Group by** : `model_name`
- **Filter** : `environment:production`

#### Dashboard 3 : Token usage per provider

- **Metric** : `input_tokens + output_tokens`
- **Group by** : `provider`
- **Compare** : vs cache_read_input_tokens (pour mesurer hit rate Anthropic cache)

#### Dashboard 4 : Error rate par tool

- **Filter** : `level:error`
- **Group by** : `tool_name`
- **Alert** : Si un tool error rate > 10% → investigate

---

## 4. Inngest — Monitoring jobs

### Settings (inngest.com dashboard)

- **`INNGEST_SIGNING_KEY` configuré** ✅
- **Apps registered** : daily-brief, audio-gen, image-gen, code-exec, document-parse, weekly-digest, monthly-card, pre-meeting-intel

### Alertes à configurer

#### Alerte 1 : Job failure rate

- **Condition** : Function failure rate > 5% in last 1 hour
- **Filter** : Production app
- **Action** : Email

#### Alerte 2 : Job stuck > 5 min

- **Condition** : Function execution time > 5 minutes
- **Action** : Email + kill job manually
- **Note** : Probablement F-087 wallclock missing si pas P11 fait

### Métriques à surveiller

- **Queue depth** : si > 100 → backpressure, investiguer worker scale
- **Retry rate** : si > 10% → check PermanentJobError classification
- **Idempotency dedup rate** : devrait être > 0% si retry serveur normal

---

## 5. Supabase — Monitoring DB

### Settings (Supabase dashboard)

- **Backups** : Daily activé ✅
- **Point-in-time recovery** : 7 jours minimum (plan Pro)
- **Database size alert** : si > 80% du quota → upgrade plan

### Métriques à surveiller

- **Connection count** : si > 80% du pool → investigate idle connections
- **Slow queries** : index manquant probable, profiler
- **RLS enforcement** : vérifier via `SELECT * FROM pg_policies` que toutes les tables sensibles ont RLS active

### Queries de monitoring (à lancer manuellement périodiquement)

```sql
-- Cross-tenant leakage check : ne doit retourner 0
SELECT count(*) FROM runs WHERE user_id IS NULL;
SELECT count(*) FROM agents WHERE tenant_id IS NULL;
SELECT count(*) FROM agent_memory WHERE user_id IS NULL OR tenant_id IS NULL;

-- Asset cleanup check : assets orphelins
SELECT count(*) FROM assets WHERE created_at < now() - interval '30 days' AND pinned = false;

-- Cost per tenant per day (require cost_usd populated post F-040)
SELECT tenant_id, sum(cost_usd), date FROM tenant_usage_daily GROUP BY tenant_id, date ORDER BY date DESC LIMIT 30;
```

---

## 6. Vercel — Deploy + rollback plan

### Pre-deploy checklist

- [ ] Toutes les env vars critiques set (cf §1)
- [ ] `npm run validate` green local
- [ ] `npm run build` réussit local
- [ ] Test smoke staging (cf GL.3)

### Deploy strategy

- **Preview** : auto sur chaque PR
- **Prod** : Push sur `main` → auto-deploy
- **Rollback** : "Promote previous deployment" via Vercel dashboard (instantané, pas de rebuild)

### Plan de rollback documenté

Si un incident survient post-deploy :

1. **Vercel Dashboard → Deployments**
2. Identifier le dernier deployment status `Ready` AVANT l'incident
3. Cliquer **"Promote to Production"**
4. Le DNS Vercel route trafic vers la version précédente en < 30s
5. **Notifier** Slack #incidents
6. **Investigate** root cause sur la version cassée

### Notes spéciales

- Migrations Supabase ne sont **PAS** auto-rolled back lors d'un Vercel rollback. Toujours pré-tester en staging.
- Si une migration breakante est dans le rollback path, créer une migration inverse en urgence.

---

## 7. Runbook incidents — Quick reference

### Cookie / session forgé détecté

- Sentry alert "module:auth" spike
- Action : Vérifier `proxy.ts` getToken JWT verify fonctionne
- Si exploit confirmé : rotate `NEXTAUTH_SECRET` (oblige re-login tout le monde)

### Tenant cross-leak suspecté

- Sentry alert "[Scope] CRITICAL"
- Action : `supabase db query` les 3 SQL "Cross-tenant leakage check" du §5
- Si rows trouvées : investiguer immédiatement, possible exploit

### Budget LLM explose

- Langfuse cost alert tenant > $50/jour
- Action : Identifier user, check `users.primary_tenant_id`, contact + rate-limit manuel
- Si attaque : revoke tenant via `UPDATE tenants SET plan = 'banned' WHERE id = ...`

### Inngest jobs stuck

- Inngest alert "execution_time > 5min"
- Action : Inngest dashboard → kill job manually
- Investigate : provider down ? E2B sandbox bloqué ?

### Sentry replay révèle PII

- ⚠ Bug critique : `maskAllText: true` ne fonctionne pas
- Action : Désactiver Sentry replay temp (`replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 0`)
- Investiguer + fix + redeploy

---

## 8. Cron jobs / scheduled tasks à valider

### Inngest crons

- `weekly-digest-cron` : vendredi 17h Paris
- `pre-meeting-intel` : `*/5 * * * *`
- `monthly-card-cron` : 1er du mois 9h Paris

### Mission scheduler (BullMQ workers, Railway)

- Lance les missions selon `schedule` de chaque mission

### Asset cleanup (Railway worker)

- Daily 2h UTC
- Vérifier qu'il ne supprime pas les assets référencés (post F-019 fix)

---

## 9. Cost monitoring (manuel hebdomadaire)

À surveiller dans les premiers mois post-launch :

- **Anthropic spend** : dashboard Anthropic console
- **OpenAI spend** : dashboard OpenAI billing
- **Gemini spend** : Google Cloud billing
- **Supabase** : DB size + bandwidth + edge functions
- **Vercel** : function invocations + bandwidth + serverless duration
- **Upstash Redis** : commands count + storage
- **Inngest** : function runs (free tier limits)
- **Sentry** : events ingested (free tier limits)
- **Langfuse** : traces ingested

### Budget cap recommandé (alerts)

- Anthropic : $200/mois soft / $500 hard
- OpenAI : $100/mois soft / $300 hard
- Vercel : $40/mois (pro plan)
- Supabase : $25/mois (pro plan)

---

## 10. Status page (recommandé)

Service gratuit suggéré : [statuspage.io](https://statuspage.io) ou auto-hébergé via Vercel + un simple JSON.

Composants à monitorer :

- Frontend (https://hearst-agents.vercel.app)
- API auth (`/api/auth/[...nextauth]`)
- API orchestrate (`/api/orchestrate`)
- LLM providers (Anthropic/OpenAI/Gemini status)
- Supabase DB
- Upstash Redis
- Inngest workers
- Sentry monitoring

---

## Validation GL.5

- [x] Doc monitoring créée
- [x] Alertes Sentry listées + critères seuils
- [x] Dashboards Langfuse listés
- [x] Inngest alertes documentées
- [x] Supabase monitoring queries fournies
- [x] Plan de rollback Vercel documenté
- [x] Runbook incidents reference
- [x] Status page recommandé

⚠ **Actions manuelles user requises** (hors automatisable) :

1. Set toutes les env vars critiques en Vercel
2. Créer les alertes Sentry dans le dashboard
3. Créer les dashboards Langfuse
4. Activer monitoring Inngest
5. Configurer status page (optionnel)
