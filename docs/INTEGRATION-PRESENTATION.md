# Intégration `hearst-presentation` ↔ Helm

Statut au 2026-05-22. `hearst-presentation` reste une **surface produit autonome** (app Next.js
indépendante, son propre Supabase `bwfkvpncgzybglultpsx`, son propre projet Vercel). On NE fusionne
PAS les deux apps ni les deux Supabase. Deux niveaux d'intégration : **SURFACE** (fait) et
**PROVIDER** (spécifié, bloqué côté presentation).

---

## 1. Rapport d'audit — état réel de Helm

### 1.1 Comment Helm référence les autres produits
- Registre canonical : `HELM_PRODUCTS` dans **`app/(user)/layout.tsx`** (type `CockpitProduct` =
  `{ id, name, short, color, url? }` depuis `@hearst/cockpit-shell`). Contient hub/halo/hyper/hustle,
  chacun avec une `url` cross-domaine.
- Composant d'affichage prévu : `<ProductLauncherBar>` (du package `@hearst/cockpit-shell`) qui ouvre
  `product.url` au clic. **CONSTAT CLÉ : ce composant n'est monté NULLE PART dans l'UI réelle de Helm**
  (le layout utilise `<CockpitShell … headless>` qui ne pose que le Context + ThemeAccent). Donc
  `HELM_PRODUCTS` est aujourd'hui **inerte** : y ajouter une entrée n'affiche rien.
- Accent par produit : tokens `--ct-product-*` dans **`app/globals.css`** (bloc `[data-product="helm"]`).
- Nav réellement visible : le **LeftRail 3-colonnes** (`app/(user)/_shell/LeftRail.tsx`), via `RAIL_STAGES`
  (modes internes) et `RAIL_PAGES` (pages standalone, rendues en `<Link>` internes).

### 1.2 Orchestrateur — providers / tools / domaines
- Assemblage du toolset exposé au LLM : **`lib/engine/orchestrator/ai-pipeline.ts`** (objet `aiTools`,
  ~l.518-608 ; `streamText({ tools: aiTools })` ~l.898). Pas de registry de classes : les tools sont
  des `Record<string, Tool<Input, Output>>` mergés.
- Forme d'un tool : `{ description, inputSchema: jsonSchema<T>(), execute: async (args) => string }`
  (ex. `lib/tools/native/web-search.ts`).
- Providers HTTP serveur-à-serveur : fonctions async dans **`lib/capabilities/providers/*.ts`**, clé via
  `process.env.*`, `fetch` + header d'auth (ex. `exa.ts` → `x-api-key`, `apollo.ts` → `X-Api-Key`,
  `fal.ts` → `Authorization: Key …`). Base URL surchargeable par env.
- Domaines : **`lib/capabilities/taxonomy.ts`** (type `Domain` + `DOMAIN_TAXONOMY`) ; routage par mots-clés
  dans `lib/capabilities/router.ts`.

### 1.3 Auth inter-services
- Clé API `hsk_` : **`lib/platform/auth/api-key.ts`** — `generateApiKey()` (hex 32 bytes, hash SHA-256,
  table `api_keys`), `verifyApiKey(raw)` → `{ tenantId, userId, scopes }` (fail-soft, vérifie
  `revoked_at IS NULL`). Migration **`supabase/migrations/0091_api_keys.sql`**.
- HOF de protection des routes : **`lib/platform/http/api-auth.ts`** — `withApiAuth(context, handler)`,
  header `Authorization: Bearer hsk_…`, fallback session NextAuth, `hasApiScope(tenant, "write")`.
  Erreurs : `401 missing_api_key` / `401 invalid_api_key`.
- Endpoints existants : `app/api/v1/{chat, runs, runs/[id], memory/search, swarms/kickoff}`.
- SDK client : **`packages/helm-sdk`** (`@hearst/helm-sdk`) — `createHelmClient({ apiKey, baseUrl })`,
  porte `Authorization: Bearer ${apiKey}`.
- **Pas d'auth JWT fédérée façon Cortex** : l'inter-services est purement par clé API (Bearer). Le SSO
  utilisateur reste NextAuth local.

### 1.4 « presentation » déjà présent dans Helm ?
**NON.** Aucune entrée nav, provider, tool, env var, ni référence au ref Supabase `bwfkvpncgzybglultpsx`.
Les occurrences de « slides »/« presentation » sont sans rapport (assets créatifs, config VSCode, tags
marketplace). Helm ne connaissait pas l'app avant cette intégration.

---

## 2. Niveau SURFACE — IMPLÉMENTÉ ✅

Décision : le `ProductLauncherBar` n'étant pas monté, la surface visible passe par le **LeftRail**
(modèle 3-colonnes conservé). `hearst-presentation` = **lien cross-domaine** (autre app/domaine/Supabase),
pas un stage interne → ouverture en nouvel onglet.

Fichiers touchés (Helm uniquement) :
| Fichier | Changement |
|---|---|
| `app/(user)/_shell/LeftRail.tsx` | Entrée `presentation` dans `RAIL_PAGES` (`external: true`, `href` = URL env) ; rendu branché `<a target="_blank" rel="noopener noreferrer">` pour les entrées externes ; icône `PageIcon` "presentation". |
| `app/(user)/layout.tsx` | Const `PRESENTATION_URL` (env `NEXT_PUBLIC_PRESENTATION_URL` + fallback) ; entrée canonical dans `HELM_PRODUCTS` (prête pour le `ProductLauncherBar` s'il est monté un jour). |
| `app/globals.css` | Token d'accent `--ct-product-presentation: #a855f7` (violet, distinct des 4 produits). |
| `.env.example` | `NEXT_PUBLIC_PRESENTATION_URL` documenté (domaine public, pas un secret). |

Comportement : une icône "Presentation" apparaît dans le rail gauche (groupe pages) ; clic → ouvre
l'app `hearst-presentation` dans un nouvel onglet. Aucun couplage de données, aucun partage de session.

Validation : `npm run typecheck` ✓ · `npm run lint` (biome 1586 fichiers + lint-visual) ✓ ·
`npm run test` ✓ (326 fichiers, 3235 tests passés, 0 régression).

Config : poser `NEXT_PUBLIC_PRESENTATION_URL` à l'URL prod réelle de l'app une fois déployée (le défaut
`https://hearst-presentation.vercel.app` est une hypothèse — l'app n'est pas encore déployée en prod).

---

## 3. Niveau PROVIDER — SPÉCIFICATION (non implémenté)

Objectif : que l'agent Helm puisse appeler `hearst-presentation` en serveur-à-serveur pour
**lister / créer / éditer des présentations**.

### 3.1 Pré-requis BLOQUANTS côté `hearst-presentation` (autre repo)
L'app n'expose aujourd'hui qu'une API protégée par **session Supabase** (`/api/cockpit-chat`), et son
modèle de données ne contient **que** du chat (`cockpit_chats`, `cockpit_messages`, `users`, `sessions`).
Il manque donc DEUX choses, à construire dans le repo `hearst-presentation` :

**(A) Un modèle de données « présentations »** (n'existe pas encore). Migration Supabase suggérée :
```sql
-- presentations : objet métier exposé à l'écosystème
create table if not exists presentations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,                       -- user (auth.users) OU clé API (tenant)
  tenant_id uuid,                      -- scope M2M (voir 3.2)
  title text not null default 'Sans titre',
  status text not null default 'draft' check (status in ('draft','ready','archived')),
  slides jsonb not null default '[]',  -- ou table presentation_slides séparée
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table presentations enable row level security;
-- RLS user (session) : owner_id = auth.uid()
-- accès M2M : via service-role dans la route /api/v1 après withApiKey (pas via RLS anon)
```

**(B) Une API machine-to-machine par clé**, répliquant le modèle Helm DANS le repo presentation :
- `lib/auth/api-key.ts` ≡ `helm/lib/platform/auth/api-key.ts` : format `hsk_` + 32 bytes hex, hash
  SHA-256, table `api_keys` (cf. `helm/supabase/migrations/0091_api_keys.sql`), `verifyApiKey()`.
- `lib/http/api-auth.ts` ≡ `helm/lib/platform/http/api-auth.ts` : HOF `withApiKey(context, handler)`,
  header `Authorization: Bearer hsk_…`, `hasScope(tenant, "write")`, erreurs `401 missing_api_key` /
  `401 invalid_api_key`. (Le fallback session est optionnel côté presentation.)
- Clés/secrets via `process.env` (service-role Supabase pour écrire hors RLS), jamais en dur.

### 3.2 Contrat d'API attendu (à exposer par `hearst-presentation`)
Base : `https://<presentation>/api/v1`. Auth : `Authorization: Bearer hsk_…` sur **toutes** les routes.
Scope `write` requis pour create/update. Réponses JSON. Isolation par `tenant_id` (résolu depuis la clé).

| Méthode | Route | Scope | Body | Réponse |
|---|---|---|---|---|
| GET | `/api/v1/presentations?limit=&status=` | read | — | `{ presentations: Presentation[] }` |
| POST | `/api/v1/presentations` | write | `{ title, status?, slides? }` | `201 { presentation: Presentation }` |
| GET | `/api/v1/presentations/[id]` | read | — | `{ presentation: Presentation }` · `404` |
| PATCH | `/api/v1/presentations/[id]` | write | `{ title?, status?, slides? }` | `{ presentation: Presentation }` |

```ts
type Presentation = {
  id: string;
  title: string;
  status: "draft" | "ready" | "archived";
  slidesCount: number;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
};
```
Erreurs normalisées : `401 {error:"missing_api_key"|"invalid_api_key"}`, `403 {error:"forbidden"}`
(scope manquant), `404 {error:"not_found"}`, `422 {error:"invalid_input", details}`.

### 3.3 Côté Helm — ce qu'il faudra ajouter (une fois 3.1/3.2 livrés)
| Fichier | Rôle |
|---|---|
| `lib/capabilities/providers/presentation.ts` (nouveau) | Client HTTP serveur-à-serveur : `listPresentations()`, `createPresentation()`, `getPresentation()`, `updatePresentation()`. `fetch(`${process.env.PRESENTATION_API_URL}/api/v1/presentations`, { headers: { Authorization: \`Bearer ${process.env.PRESENTATION_API_KEY}\` }})`. Base URL + clé via env, jamais en dur. Erreurs typées (fail-soft, jamais throw vers le LLM). |
| `lib/tools/native/presentation.ts` (nouveau) | `buildPresentationTools()` → tools `list_presentations`, `create_presentation`, `update_presentation` (chaque tool = `{description, inputSchema: jsonSchema<…>(), execute}` qui appelle le provider). Pattern miroir de `web-search.ts`. |
| `lib/capabilities/taxonomy.ts` | Ajouter le domaine `"presentation"` (providers `["presentation"]`, tools ci-dessus, keywords fr/en : présentation, slides, deck, diapo…). |
| `lib/engine/orchestrator/ai-pipeline.ts` | Importer `buildPresentationTools()` et merger dans l'objet `aiTools` (~l.518-608). |
| `.env.example` | `PRESENTATION_API_URL=` et `PRESENTATION_API_KEY=` (clé `hsk_` générée côté presentation). |
| `__tests__/…/presentation.test.ts` | Routage domaine + provider mock (ne pas taper le réseau en test). |

> ⚠️ Important : le tool `presentation` côté Helm appelle l'**API de l'app presentation** (CRUD de
> présentations). Il ne s'agit PAS de générer des visuels via FAL/Runway — c'est une autre capacité.

### 3.4 Génération de la clé (handshake)
1. Côté `hearst-presentation` : générer une clé `hsk_…` (scope `read,write`) pour le tenant "Helm",
   l'afficher une seule fois.
2. Côté Helm : la stocker en `PRESENTATION_API_KEY` (env Vercel + `.env.local`), jamais committée.
3. Helm porte `Authorization: Bearer ${process.env.PRESENTATION_API_KEY}` à chaque appel.

---

## 4. Contraintes respectées
- Tokens Cockpit uniquement (`--ct-product-presentation` ajouté au bloc tokens ; rail réutilise
  `ct-rail-action`). Pas de secret en dur (URL via `process.env`, clé future via `process.env`).
- Modèle nav 3-colonnes conservé (entrée dans le LeftRail, pas de nouvelle chrome).
- Les deux Supabase restent séparés. Aucune fusion.
- Aucun test cassé (3235 pass).
