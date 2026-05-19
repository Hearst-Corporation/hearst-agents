# Migrations Archive — Scripts Manuels

Ce répertoire contient les scripts SQL **manuels** qui ne doivent **jamais** entrer dans le répertoire `supabase/migrations/` (qui est versé par Supabase CLI en production).

## Scripts contenus

### 1. `0070_per_user_tenant_DRYRUN.sql`
- **Type** : Validation/audit SELECT
- **Créé** : 2026-05-11
- **Raison du retrait** : Ce script est une **validation de lecture**, pas une migration d'état. Il a un numéro de séquence (0070) qui entre en conflit avec les migrations Supabase auto-versionnées.
- **Contexte** : Utilisé pour valider que les tenants par utilisateur sont correctement appliqués avant de déployer la vraie migration.
- **Exécution manuelle** : Pour exécuter cette requête de validation :
  ```bash
  supabase db pull  # ou directement sur l'instance Supabase
  psql $SUPABASE_URL < 0070_per_user_tenant_DRYRUN.sql
  ```

### 2. `ROLLBACK_0088_tenants_owner_restrict.sql`
- **Type** : Rollback manuel
- **Créé** : 2026-05-17
- **Raison du retrait** : C'est un script de **rollback sur demande**, pas une migration forward. Stocké en archive pour référence au cas où la migration 0088 (`tenants_owner_restrict`) aurait besoin d'être annulée.
- **Exécution manuelle** : Seulement si un rollback de 0088 est nécessaire (très rare, coordonner avec Adrien) :
  ```bash
  supabase db execute < ROLLBACK_0088_tenants_owner_restrict.sql
  ```

## Invariants

- ✅ `supabase/migrations/` **ne contient que des migrations forward** versionnées et auto-gérées par Supabase CLI
- ✅ Scripts d'audit/validation et rollbacks restent en archive pour l'historique
- ✅ Avant d'exécuter un script archive en production, **toujours coordonner avec Adrien**
- ✅ Pas de numérotation de séquence dans l'archive (noms explicites : `ROLLBACK_*`, `DRYRUN_*`)

## Structure migrations/ attendue

```
supabase/migrations/
├── 0001_initial_schema.sql
├── 0002_add_features.sql
├── ...
├── 0088_tenants_owner_restrict.sql  ← SEULE migration 0088
└── (autres migrations forward seulement)
```

Aucun fichier `.rollback.sql` ou `_DRYRUN.sql` ne doit résider ici.
