# Runbook — Restauration base de données Supabase

> **Statut** : Actif — à maintenir à jour à chaque changement de plan Supabase ou d'architecture DB.
> **Dernière révision** : 2026-05-18

---

## Contexte

Hearst OS utilise **Supabase (PostgreSQL managé)** comme base de données principale. Le schéma `public` contient l'intégralité des données métier : utilisateurs, agents, missions, runs, crédits, artifacts, tenants.

**Risque critique identifié** : corruption ou suppression accidentelle de `public.users` (ou de la table `auth.users` gérée par Supabase Auth) provoque un **blocage login total** pour tous les utilisateurs.

Ce runbook couvre les procédures de restore pour les scénarios suivants :
- Corruption de données (mauvaise migration, UPDATE/DELETE sans WHERE)
- Suppression accidentelle de table ou de lignes critiques
- Incident Supabase (panne, rollback nécessaire)

---

## Rétention des sauvegardes

| Plan Supabase | Type de backup | Rétention | PITR disponible |
|---|---|---|---|
| **Free** | Snapshots quotidiens | 7 jours glissants | Non |
| **Pro** | Snapshots quotidiens + PITR | 7 jours (snapshots) / 7 jours PITR | Oui |
| **Team** | Snapshots quotidiens + PITR | 14 jours (snapshots) / 14 jours PITR | Oui |
| **Enterprise** | Configurable | Configurable | Oui |

> **A confirmer** : vérifier le plan actif sur [app.supabase.com/project/\<ref\>/settings/billing](https://app.supabase.com).
>
> PITR = Point-in-Time Recovery. Sur Free, le restore se fait uniquement sur un snapshot quotidien (granularité = 1 jour).

---

## Procédure de restore via dashboard Supabase

### 1. Accéder aux sauvegardes

1. Aller sur [app.supabase.com](https://app.supabase.com)
2. Sélectionner le projet Hearst OS
3. Menu latéral → **Database** → **Backups**

### 2. Restore par snapshot (tous plans)

1. Dans l'onglet **Scheduled backups**, identifier le snapshot à restaurer (date/heure)
2. Cliquer **Restore** sur le snapshot cible
3. Confirmer : saisir le nom du projet pour valider l'action
4. Attendre la fin du restore (5–20 min selon la taille de la DB)
5. Vérifier la section [Vérification post-restore](#vérification-post-restore)

> **ATTENTION** : le restore d'un snapshot écrase **toute la base** avec l'état au moment du snapshot. Toutes les données écrites entre le snapshot et maintenant sont perdues.

### 3. Restore PITR — Point-in-Time Recovery (Pro/Team/Enterprise)

1. Dans l'onglet **Point in Time Recovery**
2. Sélectionner la date et l'heure cible (timestamp exact)
3. Cliquer **Recover to this point**
4. Confirmer l'action
5. Attendre la fin (plus long qu'un snapshot : 15–45 min)
6. Vérifier la section [Vérification post-restore](#vérification-post-restore)

> PITR permet une précision à la seconde. Utile si on connaît l'heure exacte d'un incident (ex : "la migration foireuse a tourné à 14h32").

---

## Procédure de restore via CLI Supabase

### Prérequis

```bash
# Installer la CLI Supabase (si absente)
brew install supabase/tap/supabase

# Authentification
supabase login

# Lister les projets pour récupérer le project-ref
supabase projects list
```

### Lister les sauvegardes disponibles

```bash
supabase db backup list --project-ref <PROJECT_REF>
```

### Télécharger un backup

```bash
supabase db backup download --project-ref <PROJECT_REF> --backup-id <BACKUP_ID> -o ./backup-hearst-<date>.dump
```

### Appliquer un backup local (via pg_restore)

```bash
# Récupérer la DB_URL depuis le dashboard Supabase : Settings > Database > Connection string
# Format : postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  -d "$DATABASE_URL" \
  ./backup-hearst-<date>.dump
```

> Ne jamais stocker `DATABASE_URL` ou le mot de passe DB dans ce fichier. Utiliser les variables d'environnement ou le gestionnaire de secrets.

---

## Restore d'urgence — tables critiques

En cas de corruption partielle (une ou quelques tables), il est possible de restaurer sélectivement sans écraser toute la base.

### Tables critiques prioritaires (selon les migrations)

| Priorité | Table | Impact si corrompue |
|---|---|---|
| P0 | `auth.users` *(gérée par Supabase Auth)* | Login total bloqué pour tous |
| P0 | `public.tenants` | Isolation multi-tenant cassée |
| P0 | `public.user_roles` | Permissions/accès cassés |
| P0 | `public.user_credits` | Facturation/credits inaccessibles |
| P1 | `public.agents` | Agents inaccessibles |
| P1 | `public.conversations` / `public.chat_messages` | Historique chat perdu |
| P1 | `public.runs` / `public.run_steps` / `public.run_logs` | Observabilité cassée |
| P1 | `public.credit_ledger` / `public.stripe_events` | Facturation incohérente |
| P2 | `public.missions` / `public.mission_runs` | Missions inaccessibles |
| P2 | `public.artifacts` / `public.artifact_versions` | Assets perdus |
| P2 | `public.skills` / `public.workflows` | Automatisations cassées |

### Restore sélectif d'une table depuis un dump

```bash
# 1. Extraire la table cible depuis le dump complet
pg_restore \
  --table=<nom_table> \
  -f ./table-<nom>-restore.sql \
  ./backup-hearst-<date>.dump

# 2. Appliquer sur la DB cible (avec précaution)
psql "$DATABASE_URL" -f ./table-<nom>-restore.sql
```

> Pour `auth.users` : la gestion appartient à Supabase Auth. Passer par le dashboard uniquement — ne pas manipuler `auth.*` directement via psql sans support Supabase.

---

## pg_dump de sécurité hebdo (optionnel)

Script à lancer manuellement avant toute migration risquée, ou à planifier via cron.

```bash
#!/usr/bin/env bash
# scripts/backup-db.sh
# Usage : DATABASE_URL=postgresql://... bash scripts/backup-db.sh
# Ne jamais commiter ce script avec des credentials en dur.

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
OUTPUT_FILE="${BACKUP_DIR}/hearst-db-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] Démarrage dump → ${OUTPUT_FILE}"

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --compress=9 \
  "$DATABASE_URL" \
  -f "$OUTPUT_FILE"

echo "[backup] Terminé : $(du -sh "$OUTPUT_FILE" | cut -f1)"
```

Variables requises (depuis `.env.local` ou gestionnaire de secrets) :
- `DATABASE_URL` — connection string PostgreSQL complet (récupérable dans Supabase Dashboard > Settings > Database > URI)

> Ne pas versionner les fichiers `.dump` dans git. Ajouter `*.dump` et `backups/` dans `.gitignore`.

---

## Vérification post-restore

Après tout restore (snapshot, PITR, ou sélectif), exécuter les vérifications suivantes :

### 1. Connectivité et schéma

```sql
-- Vérifier que les tables critiques existent et contiennent des données
SELECT schemaname, tablename, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC
LIMIT 20;
```

### 2. Intégrité auth

```sql
-- Nombre d'utilisateurs actifs
SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL;

-- Correspondance auth.users ↔ public.tenants
SELECT COUNT(*) FROM auth.users u
LEFT JOIN public.tenants t ON t.owner_id = u.id
WHERE t.id IS NULL;
-- Résultat attendu : 0 (ou proche de 0 pour les comptes sans tenant)
```

### 3. Crédits cohérents

```sql
-- Vérifier qu'aucun crédit n'est négatif anormalement
SELECT id, balance FROM public.user_credits WHERE balance < 0 LIMIT 10;
```

### 4. Test login applicatif

1. Ouvrir l'application en navigation privée
2. Tenter un login avec un compte de test connu
3. Vérifier l'accès au dashboard
4. Vérifier qu'un run de test se crée sans erreur

### 5. Vérifier les migrations appliquées

```sql
-- Supabase track les migrations via supabase_migrations.schema_migrations
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;
```

Si le restore a ramené la DB à un état antérieur aux dernières migrations, relancer :

```bash
supabase db push --project-ref <PROJECT_REF>
```

---

## Contact escalade

| Niveau | Contact | Quand |
|---|---|---|
| L1 | Adrien (adrien@hearstcorporation.io) | Tout incident DB |
| L2 | Support Supabase | Incident infra Supabase, restore impossible via dashboard |
| L2 | [status.supabase.com](https://status.supabase.com) | Vérifier si incident global Supabase en cours |

**Support Supabase** : [supabase.com/support](https://supabase.com/support) — inclure le project ref, l'heure de l'incident, et le message d'erreur exact.

---

## Références

- [Supabase Backups docs](https://supabase.com/docs/guides/platform/backups)
- [Supabase PITR docs](https://supabase.com/docs/guides/platform/backups#point-in-time-recovery)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-backup)
- Migrations Hearst OS : `supabase/migrations/` (0001 → 0089 au 2026-05-18)
