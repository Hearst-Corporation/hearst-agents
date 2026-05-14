# Vercel Remote Cache — activation

## Pourquoi

Sans cache distant, chaque deploy Vercel recompile Next.js from scratch (~90s). Avec le Remote Cache activé, les artefacts de build sont partagés entre les machines Vercel et les runs CI — **build 90s → ~30s, cache hit estimé 80–90%** sur des PRs qui ne touchent pas les pages modifiées.

## Prérequis

Pas de modification de code requise. Le build Next.js 15 honore directement `TURBO_TOKEN` pour le cache Vercel sans Turborepo.

## Étapes d'activation

### 1. Générer un Vercel Access Token

- Aller sur <https://vercel.com/account/tokens>
- Créer un token de type **Full Account** (ou limité à l'équipe)
- Copier la valeur — elle ne sera plus visible après fermeture

### 2. Ajouter les variables d'environnement dans Vercel

Dans **Project Settings → Environment Variables**, ajouter pour toutes les environnements (Production, Preview, Development) :

| Variable | Valeur |
|---|---|
| `TURBO_TOKEN` | le token généré ci-dessus |
| `TURBO_TEAM` | le slug de l'équipe Vercel (ex : `mon-equipe`) ou l'ID utilisateur |

Le slug équipe se trouve dans **Team Settings → General → Team URL**.

### 3. Vérifier l'activation

Au prochain deploy, les logs Vercel afficheront :

```
Remote caching enabled
```

Et les builds suivants indiqueront les hits :

```
Remote cache hit: <hash>
```

## Notes

- Aucune modification de `next.config.ts`, `turbo.json` ou autre fichier nécessaire
- Le cache est automatiquement invalidé quand les fichiers sources changent
- Les secrets ne transitent jamais par le cache (seuls les artefacts compilés)
- En cas de problème : désactiver temporairement en supprimant `TURBO_TOKEN` de Vercel
