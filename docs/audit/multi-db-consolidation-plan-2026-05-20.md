# Audit multi-DB — Plan de consolidation
**Date** : 2026-05-20  
**Scope** : hearst-os (helm repo)  
**Auteur** : Claude Code (audit autonome)

---

## État actuel des bases de données

### Vue d'ensemble

Le projet dispose de **3 projets Supabase** identifiés, dont un seul est réellement actif en code.

| Alias | Project Ref | URL | Statut |
|---|---|---|---|
| **MAIN** | `sqznjshpjdwbxavljmxj` | `https://sqznjshpjdwbxavljmxj.supabase.co` | Actif — toute la logique applicative |
| **LEGACY-MCP** | `jnijwpqbanazuapznrzu` | `https://jnijwpqbanazuapznrzu.supabase.co` | Orphelin — `.mcp.json` + `SUPABASE_SERVICE_ROLE_KEY` incohérente |
| **SHARED** | `ctgipedecabfsxkyufvr` | `https://ctgipedecabfsxkyufvr.supabase.co` | Orphelin — env vars présentes, zéro consommation code |

---

## DB 1 — MAIN (`sqznjshpjdwbxavljmxj`)

### Rôle
Base de données principale du produit. Liée via `supabase/.temp/linked-project.json` (nom projet : `hearst-agents`). Toutes les 82 migrations SQL du repo ciblent ce projet.

### Tables actives (63 tables identifiées via grep `.from()`)

**Agents & IA**
`agents`, `agent_memory`, `agent_skills`, `agent_versions`, `actions`, `action_plans`, `model_profiles`, `skills`, `tools`

**Runs & Orchestration**
`runs`, `run_steps`, `run_logs`, `run_approvals`, `workflows`, `workflow_steps`, `simulation_runs`, `scheduler_leases`, `llm_runs`

**Missions**
`missions`, `mission_messages`, `mission_artifacts`, `mission_approvals`

**Rapports**
`artifacts`, `artifact_versions`, `report_templates`, `report_versions`, `report_shares`, `report_comments`, `report_exports`, `prompt_artifacts`

**Assets & Données**
`assets`, `asset_variants`, `datasets`, `dataset_entries`, `evaluations`, `things`

**Mémoire & KG**
`agent_memory`, `kg_nodes`, `kg_edges`, `embeddings`, `memory_policies`, `traces`

**Conversations & Chat**
`conversations`, `messages`, `chat_messages`, `voice_transcripts`

**Utilisateurs & Tenant**
`users`, `user_roles`, `user_credits`, `user_tokens`, `user_theme_preferences`, `tenant_settings`, `tenant_usage_daily`, `system_settings`

**Intégrations & Sécurité**
`integration_connections`, `custom_webhooks`, `audit_logs`, `stripe_events`, `applied_changes`, `improvement_signals`, `browser_sessions`

**Notifications & Marketplace**
`in_app_notifications`, `notifications`, `marketplace_templates`, `marketplace_ratings`, `marketplace_reports`, `hearst_card_revoked`

**Plans & Personas**
`plans`, `plan_steps`, `personas`, `profile`

### Clients consommateurs
- `lib/platform/db/supabase.ts` → `getServerSupabase()` / `requireServerSupabase()` — client singleton service-role, utilisé par ~90% du code serveur
- `lib/engine/runtime/assets/storage/supabase.ts` → client direct pour le storage R2-like
- `lib/verticals/hospitality/index.ts` → client direct pour le vertical hospitality
- `app/public/approvals/[token]/page.tsx` → client direct pour approval public

### Variables d'environnement
```
NEXT_PUBLIC_SUPABASE_URL=https://sqznjshpjdwbxavljmxj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<JWT ref=sqznjshp...>
SUPABASE_SERVICE_ROLE_KEY=<JWT ref=jnijwpqb...>  ← ⚠ INCOHÉRENCE (voir ci-dessous)
```

---

## DB 2 — LEGACY-MCP (`jnijwpqbanazuapznrzu`)

### Rôle
Ancien projet Supabase, vraisemblablement le projet initial avant migration vers `sqznjshpjdwbxavljmxj`. Apparaît dans :
- `.mcp.json` → `https://mcp.supabase.com/mcp?project_ref=jnijwpqbanazuapznrzu` (accès MCP Studio depuis Claude)
- `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` — le JWT décodé contient `"ref":"jnijwpqbanazuapznrzu"`, ce qui signifie que la clé service-role pointe vers l'ancien projet alors que l'URL SUPABASE_URL pointe vers le nouveau

### Incohérence critique
Le code utilise `NEXT_PUBLIC_SUPABASE_URL` (= `sqznjshpjdwbxavljmxj`) avec `SUPABASE_SERVICE_ROLE_KEY` (= `jnijwpqbanazuapznrzu`). Supabase valide la clé contre le projet URL → **le client service-role en production pourrait échouer silencieusement ou fonctionner si les données ont été copiées entre les deux projets**.

### Tables
Inconnues — aucune migration ni type ne cible ce projet. Probablement un snapshot obsolète ou une copie partielle des données.

---

## DB 3 — SHARED (`ctgipedecabfsxkyufvr`)

### Rôle
Projet ajouté récemment (env vars datant d'un ajout après bootstrap). Hypothèse : intention de créer une DB transversale multi-produits (partagée entre helm, hive, halo, hyper, hustle). Jamais concrétisée.

### Consommation code
**Zéro.** Grep exhaustif confirme :
- `NEXT_PUBLIC_SUPABASE_SHARED_URL` : présente en `.env.local`, absente de tout `.ts`/`.tsx`
- `NEXT_PUBLIC_SUPABASE_SHARED_ANON_KEY` : idem
- Aucun `createClient` ni `getServerSupabase` ne référence ces variables

### Tables
Inconnues — aucun code ne l'a jamais interrogée depuis ce repo.

---

## Scénarios de consolidation

### Scénario A — Tout dans MAIN (fusionner legacy vers sqznjshp)

**Description** : Corriger l'incohérence SUPABASE_SERVICE_ROLE_KEY + supprimer les deux projets orphelins.

**Actions**
| Action | Fichiers | Effort |
|---|---|---|
| Régénérer `SUPABASE_SERVICE_ROLE_KEY` depuis le dashboard `sqznjshpjdwbxavljmxj` | `.env.local`, Vercel env vars | 30 min |
| Mettre à jour `.mcp.json` vers `sqznjshpjdwbxavljmxj` | `.mcp.json` | 5 min |
| Supprimer les env vars SHARED du `.env.local` | `.env.local` | 5 min |
| Supprimer les env vars SHARED de Vercel | Dashboard Vercel | 10 min |
| Archiver/supprimer les projets Supabase orphelins | Dashboard Supabase | 20 min |
| Vérifier que les RLS de MAIN couvrent tous les cas | `supabase/migrations/` | 1h audit |

**Total estimé** : ~2h

**Risques**
- La `SUPABASE_SERVICE_ROLE_KEY` incorrecte peut avoir causé des erreurs silencieuses en production. À vérifier dans les logs Axiom/Sentry.
- Si `jnijwpqbanazuapznrzu` contenait des données de prod (comptes utilisateurs, runs historiques), une migration de données est nécessaire avant suppression.

---

### Scénario B — Tout dans SHARED (promouvoir ctgipedecabfsxkyufvr comme DB centrale)

**Description** : Migrer tout le schéma vers la DB SHARED et la nommer DB centrale multi-produits.

**Actions**
| Action | Fichiers | Effort |
|---|---|---|
| Rejouer les 82 migrations sur `ctgipedecabfsxkyufvr` | `supabase/migrations/` | 2h |
| Mettre à jour `NEXT_PUBLIC_SUPABASE_URL` vers `ctgipedecabfsxkyufvr` | `.env.local`, Vercel | 15 min |
| Régénérer les clés anon + service-role depuis `ctgipedecabfsxkyufvr` | Dashboard Supabase | 15 min |
| Migrer les données de `sqznjshpjdwbxavljmxj` vers `ctgipedecabfsxkyufvr` | pg_dump + restore | 3-4h |
| Rejouer les RLS (toutes dans les migrations) | automatique via migrations | inclus |
| Mettre à jour `supabase/.temp/linked-project.json` | `supabase/.temp/` | 5 min |

**Total estimé** : ~8h + downtime migration

**Risques**
- Migration de données à chaud risquée (race conditions sur runs en cours)
- Casse tous les clients existants pendant la fenêtre de migration
- Gain nul à court terme si SHARED reste mono-produit

**Verdict** : non recommandé sauf si l'architecture multi-produits sur une DB partagée est une décision actée.

---

### Scénario C — Garder 2 (MAIN + SHARED séparées, corriger LEGACY)

**Description** : Corriger uniquement l'incohérence LEGACY, garder SHARED pour un usage futur, rien d'autre ne change.

**Actions**
| Action | Fichiers | Effort |
|---|---|---|
| Régénérer `SUPABASE_SERVICE_ROLE_KEY` depuis MAIN | `.env.local`, Vercel | 30 min |
| Mettre à jour `.mcp.json` vers MAIN | `.mcp.json` | 5 min |
| Documenter SHARED comme "réservé multi-produits" | `docs/architecture/` | 30 min |
| Laisser `jnijwpqbanazuapznrzu` en pause (ne pas supprimer) | — | 0 min |

**Total estimé** : ~1h

**Risques**
- La dette reste (3 projets actifs mais 1 seul utile)
- Confusion future sur le rôle de SHARED
- Coût Supabase pour 2 projets inutilisés

---

## Recommandation finale

**Scénario A est la bonne décision**, exécutée en 2 étapes :

**Étape 1 (urgent — aujourd'hui)** : Corriger l'incohérence critique de `SUPABASE_SERVICE_ROLE_KEY`. La clé actuelle pointe vers `jnijwpqbanazuapznrzu` mais l'URL pointe vers `sqznjshpjdwbxavljmxj`. Cela signifie que tous les appels service-role peuvent échouer en production selon la version de Supabase installée. Régénérer la clé depuis le dashboard MAIN et mettre à jour `.env.local` + les variables Vercel. Temps : 30 minutes.

**Étape 2 (cette semaine)** : Supprimer proprement les deux projets orphelins. Avant suppression de `jnijwpqbanazuapznrzu`, vérifier via le dashboard Supabase si des données existent (tables non vides). Si oui, exporter en JSON avant archivage. Le projet SHARED (`ctgipedecabfsxkyufvr`) est vierge (zéro code le consomme) : suppression sans risque.

Le scénario C (garder 2 projets) est une fausse prudence : SHARED n'a pas de schéma, pas de données, pas de code. Le maintenir ne coûte rien sauf de la confusion et des frais Supabase inutiles. Le scénario B est prématuré : l'architecture multi-produits n'est pas encore en place et forcer la migration maintenant ajouterait 8h de risque sans valeur immédiate.

### Bilan des actions prioritaires

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| P0 | Régénérer `SUPABASE_SERVICE_ROLE_KEY` depuis MAIN | 30 min | Corrige incohérence prod critique |
| P0 | Mettre à jour `.mcp.json` vers MAIN | 5 min | MCP Studio pointe sur la bonne DB |
| P1 | Supprimer env vars SHARED de `.env.local` et Vercel | 15 min | Clarté |
| P1 | Vérifier + archiver `jnijwpqbanazuapznrzu` | 30 min | Nettoyage |
| P2 | Supprimer projet SHARED Supabase | 10 min | Économie |
