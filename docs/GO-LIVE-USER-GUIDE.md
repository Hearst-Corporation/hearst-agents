# Hearst OS — Guide utilisateur (Go-Live)

**Date** : 2026-05-11
**Scope** : GL.6 du Battle Plan sécurité — documentation utilisateur + limites usage avant go-live.

---

## Onboarding

### Comment s'inscrire

Hearst OS est en **accès restreint** pendant la phase beta.

1. Allez sur https://hearst-agents.vercel.app/login
2. Cliquez **"Se connecter avec Google"** (ou Microsoft / Slack)
3. Si votre email est **dans la liste d'autorisation** (`HEARST_ALLOWED_EMAIL_DOMAINS`) → vous êtes connecté
4. Sinon → erreur 403 (contactez Adrien pour être ajouté à la liste)

### Premier login

Au premier login :

- Un **tenant** est créé automatiquement pour vous (1 user = 1 tenant = 1 workspace)
- Votre `primary_tenant_id` est unique et **isolé** des autres users
- Vos missions, agents, conversations sont **invisibles** aux autres users

---

## Limites usage

### Rate-limits (par minute / par user)

| Route | Limit |
|---|---|
| `/api/orchestrate` (chat principal) | 10 req/min (Arcjet) |
| `/api/v2/jobs/code-exec` | 20 req/min (Arcjet ajLlmJobs) |
| `/api/v2/jobs/image-gen` | 20 req/min |
| `/api/v2/jobs/audio-gen` | 20 req/min |
| `/api/v2/jobs/document-parse` | 20 req/min |
| `/api/agents/[id]/chat` | Variable selon `defaultRateLimiter` |
| Autres APIs | 100 req/min |

Dépassement → réponse `429 rate_limited` + header `Retry-After`.

### Quotas quotidiens

| Action | Cap quotidien |
|---|---|
| Daily brief generate | 5 / 24h |
| Simulations start | 3 / 24h |
| KG ingest | 10 / minute |

### Budgets LLM (per run)

- Max cost USD : $0.50 par run `/api/orchestrate`
- Max output tokens : 8000 par stream
- Max steps tool-use : 10 par run

### Limites fichiers

- Upload PDF : **25 MB max**
- Body history orchestrate : 20 messages max, 4000 chars/message
- KG ingest text : 50 000 chars max

---

## Workflow tool execution (HITL)

Quand un agent veut envoyer un email, publier sur Slack, créer un commit GitHub, etc. (actions "write"), un **workflow de confirmation humaine (HITL)** s'applique :

1. **Étape 1** : L'agent prépare un **draft** (preview) avec les args canoniques
2. **Étape 2** : Tu vois la preview dans le UI Hearst → tu valides
3. **Étape 3** : Un **token cryptographique HMAC** est émis (signed par `NEXTAUTH_SECRET`, TTL 5min)
4. **Étape 4** : L'agent re-exécute le tool avec le token → vérifié serveur-side → action commitée

**Sans token valide, AUCUN write tool ne s'exécute.** Le `_preview: false` envoyé seul par le LLM est rejeté (cf F-010 fix).

---

## Sécurité données

### Données chiffrées

- **OAuth tokens** (Google Gmail, Slack, etc.) : AES-256-GCM en DB Supabase (`TOKEN_ENCRYPTION_KEY`)
- **TLS partout** : HSTS preload-eligible (max-age 2 ans)
- **CSP** : strict (default-src 'self' + Sentry/Langfuse/Supabase explicitement allowlistés)

### Données PII non envoyées à des tiers

- **Sentry** : `sendDefaultPii: false` + `beforeSend` strip prompts/headers/body
- **Langfuse** : `redactForLangfuse()` strip emails, phones, API keys avant trace
- **Replay Sentry** : `maskAllText/maskAllInputs/blockAllMedia` activés

### Multi-tenant isolation

- Chaque user a son `primary_tenant_id` unique
- Toutes les queries DB filtrent par `tenant_id`
- RLS Postgres actif sur `agent_memory`, `user_tokens`, etc.
- `resolveScope()` retourne 401 en prod si tenant non résolu (fail-closed)

### Audit log

- Toutes les actions critiques (login, role change, agent-lock, admin POST) sont loggées
- Sentry breadcrumbs `security_event` tag

---

## Comportements attendus / FAQ

### "Je n'ai pas accès à `/admin`"

Normal. `/admin/*` requiert le rôle `admin`. Contacte Adrien si tu as besoin de l'accès.

### "Mon agent ne peut pas envoyer d'email automatiquement"

Normal. Toutes les actions "write" (send_email, gmail_send, slack_post, etc.) demandent une **confirmation HITL** (cf section workflow ci-dessus).

### "L'agent dit `_preview: false` mais l'email n'est pas parti"

C'est voulu. Le `_preview: false` sans token cryptographique signé serveur est rejeté pour empêcher le **prompt injection** (un email malveillant qui contient "_preview: false" ne déclenche aucune action).

### "Mon job audio/image/code-exec est stuck"

- Vérifier ton **daily cap** (3 simulations / 5 daily-briefs / 24h)
- Vérifier le statut via `/api/v2/jobs/[jobId]/status`
- Si > 5 min stuck → support (probable provider down)

### "J'ai un erreur 401 après connexion"

Probable bug `[Scope] CRITICAL: session.tenantId absent`. Contacte support immédiatement (= bug critique côté serveur).

### "L'app crash au démarrage"

Probable env var manquante. Logs Vercel devraient montrer `[ENV ERROR]` ou `[FATAL]`. Set la var, redeploy.

### "Mon état de conversation a disparu après reload"

Normal. Le `localStorage` ne stocke plus le **contenu** des messages (cf F-077 fix). Seuls les IDs sont persistés ; le contenu est rechargé depuis Supabase à chaque session.

---

## Limites connues (post-launch)

Ces points sont documentés mais **pas bloquants** pour le go-live :

1. **B11.1 Layout client racine** : LCP non optimal (+300-500ms). Refactor Server Components prévu post-launch.
2. **B11.5 Wallclock agent-loop** : Browser agent peut tourner jusqu'à 15 min en théorie (avec maxSteps=15). Wallclock cap 5min à ajouter.
3. **Tests e2e multi-tenant Playwright** : pas encore implémentés (manual smoke test pour l'instant).
4. **NextAuth v4 EOL** : migration v5 prévue Q3.
5. **Hearst Card token revoke** : pas de table revoke (TTL 7j). À ajouter post-launch.

Cf [docs/audits/2026-05-10-security/BATTLE-PLAN.html](audits/2026-05-10-security/BATTLE-PLAN.html) Phase 11 pour la liste exhaustive.

---

## Support

Pendant la beta :

- **Bugs critiques** : Sentry alert auto + email Adrien
- **Bugs UX** : GitHub Issues
- **Demande accès** : Email Adrien
- **Questions feature** : Slack #hearst-beta

---

## Validation GL.6

- [x] Onboarding documenté
- [x] Limites usage listées (rate-limits, quotas, budgets, files)
- [x] Workflow HITL expliqué
- [x] Sécurité données expliquée (chiffrement, multi-tenant, audit)
- [x] FAQ comportements attendus
- [x] Limites connues post-launch listées

⚠ **Actions manuelles user requises** :
1. Communiquer cette doc aux beta-testeurs (Notion / email / Slack)
2. Mettre en place status page externe (statuspage.io ou équivalent)
3. Définir SLA support (temps de réponse aux bugs critiques)
