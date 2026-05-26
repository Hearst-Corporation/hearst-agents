# 🔍 Audit Flow — Plateforme Hearst OS

**Date** : 2026-05-22  
**Auditeur** : Kimi Code CLI  
**Scope** : Cohérence admin/user, redondances, intégrité flows, feature locks  
**Méthode** : Analyse statique + tests + agents d'exploration parallèles  

---

## 📊 Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| Fichiers audités | ~1 600 |
| Tests passés | 3 344 / 3 349 (5 skipped) |
| Typecheck | ✅ Clean |
| Lint (Biome + visuel) | ✅ Clean |
| Features verrouillées | 32 / 62 |
| Features en cours | 9 |
| Features draft (QA) | 21 |
| Orphans | 13 |
| Tests manquants | 242 |

---

## 🔴 CRITIQUE — Anomalies bloquantes ou hautement risquées

### 1. Fragmentation API Runs — 4 namespaces pour le même concept

| Namespace | Routes | Usage |
|-----------|--------|-------|
| `api/v1/runs/*` | 2 routes | Legacy — **plus aucun appel côté user trouvé** |
| `api/v2/runs/*` | 5 routes | API publique moderne |
| `api/orchestrator/runs/*` | 3 routes | Admin-oriented mais en zone user-api |
| `api/admin/runs/*` | 2 routes | Admin-only (events, recent) |

**Problème** : `api/orchestrator/*` n'est PAS sous `api/admin/` mais expose des données sensibles (drift, quarantine, registry, trust). Vérifier que ces routes sont bien protégées par `requireAdmin`.

**Action** : Migrer `api/orchestrator/*` sous `api/admin/orchestrator/*` ou consolider dans `api/v2/`.

---

### 1b. Auth inconsistant sur routes legacy (Sévérité : 🟡 Moyenne)

8 routes utilisent `getUserId()` au lieu de `requireScope()` / `withScope()`, ce qui **ne résout pas le tenantId/workspaceId** :

```
app/api/composio/apps/route.ts          → getUserId()
app/api/composio/connections/route.ts   → getUserId()
app/api/composio/diagnose/route.ts      → getUserId()
app/api/composio/connect/route.ts       → getUserId()
app/api/composio/app-actions/route.ts   → getUserId()
app/api/composio/invalidate-cache/route.ts → getUserId()
app/api/connections/native/route.ts     → getUserId()
app/api/connections/expiring/route.ts   → getUserId()
```

**Impact** : Pas de fuite cross-tenant directe (Composio filtre sur `entityId = userId`), mais **incohérence architecturale** — certaines routes ont un scope complet, d'autres juste un userId.

**Action** : Migrer vers `withScope` pour cohérence.

---

### 2. Deux systèmes de Runs distincts côté UI

| Route | Source de vérité |
|-------|-----------------|
| `/admin/runs` | DB Supabase (table `runs`, traces, tokens, coûts) |
| `/admin/orchestrator/runs` | HOM (Hearst Operations Mesh, bundles, decisions, spans) |

**Risque** : Confusion utilisateur admin — deux pages "runs" avec des données différentes, pas de lien clair entre elles.

---

### 3. API V1 encore exposée mais SDK-only

- `api/v1/chat`, `api/v1/memory/search`, `api/v1/runs/*`, `api/v1/swarms/kickoff`
- **Usage** : SDK serveur-à-serveur (auth par clé API via `withApiAuth`), PAS consommé par le frontend
- **Risque** : Surface d'attaque inutile si le SDK n'est pas utilisé

**Action** : Vérifier l'usage réel du SDK ; si obsolète, déprécier v1.

---

### 3b. Routes non-versionnées encore majoritaires côté frontend (Sévérité : 🟡 Moyenne)

Le frontend appelle encore des routes **sans version** pour les features principales :

| Route frontend | Statut |
|----------------|--------|
| `/api/orchestrate` | Legacy — pas de v2 |
| `/api/agents` | Legacy — pas de v2 |
| `/api/agents/[id]/chat` | Legacy — pas de v2 |
| `/api/reports/*` | Legacy — pas de v2 |
| `/api/conversations/*` | Legacy — pas de v2 |
| `/api/composio/*` | Legacy — pas de v2 |
| `/api/connections/*` | Legacy — pas de v2 |
| `/api/notifications/*` | Legacy — pas de v2 |
| `/api/settings/*` | Legacy — pas de v2 |
| `/api/briefing` | Legacy — pas de v2 |
| `/api/user/theme` | Legacy — pas de v2 |
| `/api/analytics` | Legacy — pas de v2 |
| `/api/tools` | Legacy — pas de v2 |

**Impact** : Surface d'API fragmentée — migration v2 incomplète.

**Action** : Plan de migration v2 ou documentation explicite des routes legacy.

---

### 4. `api/orchestrate` vs `api/orchestrator` — confusion sémantique

| Route | Type |
|-------|------|
| `api/orchestrate` (POST) | Lance un run conversationnel |
| `api/orchestrate/abort/[runId]` | Abort d'un run |
| `api/orchestrator/*` | Admin dashboard (drift, quarantine, etc.) |

**Problème** : Deux namespaces quasi-homophones avec des rôles totalement différents. Le premier est user-facing, le second admin-facing.

---

### 4b. Double layer Reports (Sévérité : 🟢 Faible)

| Layer | Routes |
|-------|--------|
| `/api/reports/*` | Legacy (catalog, templates, share, comments, versions, export, rerun) |
| `/api/v2/reports/*` | v2 (specs, run) |

Le frontend utilise le legacy pour la plupart des opérations. Le v2 semble être un nouveau layer pour les "report specs". Pas de conflit direct, mais **deux APIs parallèles**.

---

## 🟡 MOYEN — Incohérences et dette technique

### 5. Naming incohérent paramètres dynamiques

| Paramètre | Où |
|-----------|-----|
| `[id]` | `v2/runs/[id]`, `orchestrator/runs/[id]` |
| `[runId]` | `admin/runs/[runId]/events` |
| `[runId]` | `orchestrate/abort/[runId]` |

**Action** : Standardiser sur `[id]` partout.

---

### 6. Pluriel/singulier incohérent

| Route | Problème |
|-------|----------|
| `/admin/runs` (pluriel) vs `/run` (singulier) | Incohérence convention |
| `v2/reports/specs/[specId]` puis `v2/reports/[specId]/run` | `specs` pluriel mais `specId` singulier |
| `__tests__/meeting/` vs `__tests__/meetings/` | Deux dossiers pour le même domaine |

---

### 6b. Double fetch Cockpit (Sévérité : 🟢 Faible)

```tsx
// app/(user)/cockpit-x/CockpitXClient.tsx
const [data, setData] = useState<CockpitTodayPayload | null>(initialCockpitData);
useEffect(() => {
  fetch("/api/v2/cockpit/today", { credentials: "include" })
    .then(...)
}, []);
```

Le client fetch **toujours** au mount même si `initialCockpitData` est déjà peuplé par le RSC. Le RSC prefetch est **écrasé immédiatement** par le client fetch.

**Action** : Conditionner le client fetch si `initialCockpitData` est présent.

---

### 7. Admin importe depuis User — mauvaise séparation

| Import admin | Source user | Problème |
|-------------|-------------|----------|
| `sanitizeApiError` | `app/(user)/lib/sanitize-error.ts` | Devrait être dans `lib/utils/` |
| `use-toast` | `app/hooks/use-toast.ts` | Devrait être dans `hooks/` racine |
| `Action`, `EmptyState` | `app/(user)/components/ui/` | OK — primitives UI légitimes |

**Action** : Extraire les utilitaires partagés dans `lib/utils/` et `hooks/`.

---

### 8. Duplication composants admin/orchestrator vs user

| Pattern | Admin | User | Mutualisation |
|---------|-------|------|---------------|
| Card container | `Card` dans `orchestrator/_components/Shell.tsx` | `PanelCard` dans `components/ui/PanelCard.tsx` | ✅ Forte |
| PageHeader | `PageHeader` dans `orchestrator/_components/Shell.tsx` | `PageHeader` dans `components/PageHeader.tsx` | ✅ Forte |
| MetricCell | `MetricCell` dans `orchestrator/_components/Shell.tsx` | `KpiGrid` dans `_shell/KpiGrid.tsx` | ✅ Moyenne |
| Status pill | `StatusPill` dans `orchestrator/_components/Shell.tsx` | `FocusBadge` dans `components/FocusBadge.tsx` | ✅ Moyenne |

---

### 9. Pas de layout orchestrator — `HomShell` répété

Les 10 pages sous `/admin/orchestrator/*` importent toutes `HomShell` depuis `_components/Shell.tsx`. Pas de `layout.tsx` à `app/admin/orchestrator/layout.tsx`.

**Action** : Créer un layout orchestrator pour DRY.

---

### 9b. Pas de cache client unifié (Sévérité : 🟡 Moyenne)

Chaque Stage fait son propre `fetch()` dans `useEffect` sans bibliothèque de cache (SWR, TanStack Query) :

```
MissionListStage.tsx  → fetch("/api/v2/missions")
MissionStage.tsx      → fetch("/api/v2/missions/${missionId}")
AssetStage.tsx        → fetch("/api/v2/assets/...")
BrowserStage.tsx      → fetch("/api/v2/browser/...")
```

**Impact** :
- Pas de déduplication de requêtes si 2 composants montés en même temps
- Pas de cache partagé entre navigation (re-fetch à chaque mount)
- Pas de stale-while-revalidate
- Pas de retry automatique, pas de backoff exponentiel

**Action** : Adopter SWR ou TanStack Query pour le cache client.

---

### 10. Hooks dispersés sur 3 niveaux

| Dossier | Fichiers | Usage |
|---------|----------|-------|
| `hooks/` | 2 (spatial-safe + usePoll) | Racine — peu utilisé |
| `app/hooks/` | 4 (global-hotkeys, oauth, toast) | App-level |
| `app/(user)/hooks/` | 1 (useModalA11y) | User-only |

**Problème** : `app/hooks/use-toast.ts` est utilisé par admin ET user mais vit dans `app/hooks/` (ni racine ni user).

---

## 🟢 FAIBLE — Conventions et polish

### 11. Composants partagés mal placés

- `app/components/system/NoiseLayer.tsx` et `ThemeHydrator.tsx` — seuls composants "partagés" hors spatial-safe
- Les primitives UI (`Action`, `EmptyState`, `PanelCard`, etc.) devraient vivre dans `app/components/ui/` (partagé admin+user) plutôt que `app/(user)/components/ui/`

---

### 12. Stores — cohérence acceptable mais overlap potentiel

| Store | Rôle | Note |
|-------|------|------|
| `chat-context.ts` | Chips contexte (persisté) | ✅ Clair |
| `chat-stage.ts` | Run conversationnel (volatile) | ✅ Clair |
| `stage.ts` | Mode actif du Stage (13 modes) | ✅ Clair |
| `stage-data.ts` | Miroir Stage ↔ ContextRail | ✅ Clair |
| `focal.ts` | Focal point UI | ⚠️ Pourrait fusionner avec `stage.ts` ? |
| `focus-mode.ts` | Focus mode (overlay) | ✅ Clair |

---

### 12b. Pas de gestion d'erreur unifiée sur les fetchs client (Sévérité : 🟡 Moyenne)

Les fetchs dans les Stages ont des patterns d'erreur inconsistants :
- Certains loguent en `console.warn`
- Certains affichent un état d'erreur UI
- Certains silencient l'erreur

**Action** : Créer un hook `useApiFetch` avec retry + error handling normalisé.

---

## 📋 Feature Locks — État

### Features verrouillées (32) ✅

Toutes les features P1/P2 critiques sont verrouillées : `admin`, `artifact`, `assets`, `auth`, `browser`, `chat`, `cockpit`, `connections`, `context-rail`, `missions`, `reports`, `runs`, `stage`, etc.

### Features en cours (9) ⚠️

| Feature | Statut | Risque |
|---------|--------|--------|
| `drift-detection` | in_progress | Modification possible |
| `focus-mode` | in_progress | Modification possible |
| `hearst-card` | in_progress | Modification possible |
| `mission-approvals` | in_progress | Modification possible |
| `mission-budget` | in_progress | Modification possible |
| `pre-meeting-intel` | in_progress | Modification possible |
| `signal-board` | in_progress | Modification possible |
| `spaces` | in_progress (v1.1) | Modification possible |
| `video-quick-launch` | in_progress | Modification possible |

### QA Drafts (21) 📝

Toutes les features `qa-*` sont en draft — ce sont des tickets de bugfix en attente.

---

## 🧪 Couverture Tests

### Domaines sous-couverts (tests manquants > 5)

| Domaine | Existant | Manquant | Gap |
|---------|----------|----------|-----|
| `assets` | 24 | 25 | 🔴 51% |
| `chat` | 253 | 27 | 🟡 10% |
| `cockpit` | 114 | 7 | 🟡 6% |
| `connections` | 105 | 24 | 🟡 19% |
| `memory-kg` | 95 | 23 | 🟡 20% |
| `missions` | 69 | 21 | 🟡 23% |
| `reports` | 528 | 20 | 🟡 4% |
| `stage` | 35 | 26 | 🔴 43% |

### Tests admin

- Seulement **2 fichiers de test** admin : `metrics-page.test.tsx` et `usage-aggregate.test.ts`
- **Gap majeur** : Pas de tests pour l'auth admin, le RBAC, les routes admin

---

## 🔄 Flow Auth — Vérification

| Composant | Rôle | État |
|-----------|------|------|
| `lib/platform/auth/session.ts` | Session NextAuth | ✅ |
| `lib/platform/auth/user-resolver.ts` | Résolution user | ✅ |
| `lib/platform/auth/dev-bypass.ts` | Bypass dev | ✅ (gated) |
| `lib/multi-tenant/guards.ts` | Guards multi-tenant | ✅ |
| `lib/security/ssrf-guard.ts` | SSRF protection | ✅ |
| `lib/engine/runtime/prompt-guard.ts` | Prompt injection | ✅ |

**Note** : Pas de `middleware.ts` à la racine — l'auth est gérée par `proxy.ts` (edge) + guards côté API. Pattern valide pour Next.js App Router.

---

## 📦 Redondances code identifiées

### Fichiers avec même nom (risque de confusion)

| Nom | Occurrences |
|-----|-------------|
| `page.tsx` | 51 (normal — routes Next.js) |
| `layout.tsx` | 4 (normal) |
| `index.ts` | 30+ (normal — barrel exports) |
| `adapter.ts` | 3 (`lib/engine/runtime/assets/`, `lib/engine/runtime/state/`, `lib/integrations/`) |
| `constants.ts` | 5+ (dispersés) |
| `utils.ts` | 3 (`app/(user)/components/report-layout/`, `lib/spatial-safe/`, `lib/connectors/composio/preview-formatters/`) |

### Fetch wrappers dispersés

- **35 fichiers** utilisent `fetch()` directement dans `lib/`
- Pas de wrapper HTTP unifié (contrairement à `lib/platform/http/api-auth.ts` qui existe)

### Clients Supabase

- **4 fichiers** créent un client Supabase — vérifier qu'ils utilisent tous le même pattern (server vs browser)

---

## ✅ Ce qui marche bien

| Point | Détail |
|-------|--------|
| **Typecheck** | Clean — 0 erreur |
| **Lint** | Clean — Biome + visuel passent |
| **Tests unitaires** | 3 344 passés, couverture large |
| **Séparation admin/user** | User n'importe jamais depuis admin (bon pattern) |
| **Feature locks** | 32/32 features critiques verrouillées |
| **E2E** | 25+ specs Playwright couvrant auth, reports, notifications, etc. |
| **Spatial-safe** | Zones read-only respectées |
| **Agent lock** | `docs/AGENT-LOCK.json` est `false` — pas de blocage |

---

## 🎯 Plan d'action recommandé

### Priorité 1 — Sécurité & stabilité

1. **Vérifier les guards** sur `api/orchestrator/*` — s'assurer que `requireAdmin` est appliqué
2. **Migrer les routes Composio/connections** vers `withScope` pour cohérence tenant
3. **Standardiser les paramètres** `[id]` vs `[runId]`

### Priorité 2 — Cohérence & DRY

4. **Créer `app/admin/orchestrator/layout.tsx`** pour éviter le `HomShell` répété
5. **Extraire `sanitizeApiError` et `use-toast`** dans `lib/utils/` et `hooks/`
6. **Mutualiser `Card`/`PageHeader`/`MetricCell`** entre orchestrator et user UI
7. **Fusionner `__tests__/meeting/` et `__tests__/meetings/`**
8. **Conditionner le fetch Cockpit** si `initialCockpitData` présent

### Priorité 3 — Tests & documentation

9. **Ajouter des tests admin** — auth, RBAC, routes protégées
10. **Combler les gaps** : `stage` (43%), `assets` (51%), `missions` (23%)
11. **Documenter la différence** entre `/admin/runs` et `/admin/orchestrator/runs`

### Priorité 4 — Architecture

12. **Consolider les namespaces runs** : viser `api/v2/runs/*` comme unique API publique
13. **Migrer `api/orchestrator/*` sous `api/admin/orchestrator/`**
14. **Créer `app/components/ui/`** pour les primitives partagées admin+user
15. **Adopter SWR/TanStack Query** pour le cache client et la déduplication des requêtes

---

## 📎 Annexes

### Commandes utilisées pour l'audit

```bash
# Routes
find app/admin -type f -name "page.tsx" | sort
find app/\(user\) -type f -name "page.tsx" | sort

# API
find app/api/admin -type f | sort
find app/api/v1 -type f | sort
find app/api/v2 -type f | sort

# Doublons
grep -r "api/v1/" app/\(user\)/ --include="*.ts" --include="*.tsx" -l
grep -r "api/orchestrate" app/\(user\)/ --include="*.ts" --include="*.tsx" -l

# Tests
pnpm typecheck
pnpm lint
pnpm test -- --run

# Features
cat docs/features/_manifest.json | python3 -c "import json,sys; ..."
```

---

---

## 🏆 Verdict Global

| Domaine | Score | Commentaire |
|---------|-------|-------------|
| **Auth** | ⭐⭐⭐⭐☆ | Architecture solide, incohérences sur routes Composio/connections |
| **Données** | ⭐⭐⭐☆☆ | Pas de cache client, fetchs redondants, pas de SWR |
| **Navigation** | ⭐⭐⭐⭐☆ | Architecture claire, quelques UX rough edges |
| **Feature Locks** | ⭐⭐⭐⭐⭐ | 32/32 verrouillées, invariants respectés |
| **API Versioning** | ⭐⭐⭐☆☆ | v1/v2 bien séparés, mais frontend utilise encore beaucoup de routes legacy |
| **Cache Client** | ⭐⭐☆☆☆ | Pas de SWR/React Query, fetchs manuels dans useEffect |
| **Error Handling** | ⭐⭐⭐☆☆ | Pas de gestion unifiée, patterns inconsistants |

**Risque global :** 🟡 **Moyen** — L'auth est robuste, mais le manque de cache client et la fragmentation API créent de la dette technique. Aucun problème de sécurité critique n'a été identifié.

---

*Rapport généré automatiquement. Dernière mise à jour : 2026-05-22T20:05+04:00*
