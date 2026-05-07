# Onboarding — `onboarding`

## Métadonnées
| **id** | `onboarding` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

L'onboarding comprend deux flux distincts et indépendants :

1. **OnboardingTour** — overlay 3 slides montré au premier login. Trigger : absence du flag localStorage `hearst.onboarded`. Présente la promesse produit en 30 secondes. Fermable via Esc, skip, ou "Démarrer".

2. **Sélection de vertical industriel** — page `/onboarding/vertical`. 6 industries disponibles. Submit → `POST /api/onboarding/set-industry` → persist dans `tenant_settings` (Supabase, migration 0053) → redirect `/`. Accessible directement par URL, pas de redirect automatique depuis le layout.

## Surface publique

- `app/(user)/onboarding/vertical/page.tsx` — page sélection vertical
- `app/(user)/components/OnboardingTour.tsx` — overlay tour 3 slides
- `app/api/onboarding/set-industry/route.ts` — endpoint persistance vertical

## Types clés
```ts
// page.tsx
type Industry =
  | "general"
  | "hospitality"
  | "saas"
  | "ecommerce"
  | "finance"
  | "healthcare";

// OnboardingTour
interface OnboardingTourProps {
  forceOpen?: boolean;  // override localStorage — pour les tests uniquement
  onClose?: () => void;
}

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  cta: string; // "Suivant" sur slides 1-2, "Démarrer" sur slide 3
}

// POST /api/onboarding/set-industry — body
interface SetIndustryBody {
  industry: "general" | "hospitality" | "saas" | "ecommerce" | "finance" | "healthcare";
}
```

## Industries supportées

| id | Nom | Persona intégrée | KPIs caractéristiques |
|---|---|---|---|
| `general` | Général | — | Cockpit polyvalent |
| `hospitality` | Hôtellerie | hospitality-concierge | Guests, ADR, RevPAR, occupancy |
| `saas` | SaaS | — | MRR, ARR, churn, expansion |
| `ecommerce` | E-commerce | — | GMV, AOV, conversion, stock |
| `finance` | Finance | — | P&L, cash flow, KPIs trésorerie |
| `healthcare` | Santé | — | Patients, RDV, compliance |

## Invariants verrouillés

### I-1. Trigger tour : localStorage uniquement (MVP)
L'`OnboardingTour` s'affiche si et seulement si `window.localStorage.getItem("hearst.onboarded")` est falsy après mount (via `queueMicrotask` pour éviter hydration mismatch). Pas de lecture du flag dans le state initial React.

### I-2. Persistance flag : localStorage côté client
Fermeture du tour (skip ou "Démarrer") → `localStorage.setItem("hearst.onboarded", "1")`. Phase 2 prévue : persister dans `users.onboarded_at` côté Supabase pour support cross-device. Tant que la Phase 2 n'est pas implémentée, ne pas remplacer localStorage par un appel API.

### I-3. Re-déclenchement possible
`_resetOnboarding()` est exportée pour les tests uniquement. Elle appelle `localStorage.removeItem("hearst.onboarded")`. En runtime user, aucun mécanisme de re-déclenchement n'est exposé (pas de bouton admin, pas de flag en DB actuellement).

### I-4. 3 slides exactement, ordre figé
Les 3 slides sont : "Bienvenue / Hearst voit ce que tu vois", "Connexions / Branche tes outils", "Démarrer / Lance ta première mission". L'ordre et le contenu sont fixes. Toute modification de slide nécessite une mise à jour de spec.

### I-5. Hotkeys tour
Pendant que le tour est ouvert : `Escape` → ferme (skip), `Enter` ou `ArrowRight` → avance (équivalent du bouton CTA). Ces handlers sont actifs uniquement si `open === true`.

### I-6. 6 industries exactement, enum fermé
L'endpoint `POST /api/onboarding/set-industry` valide avec `z.enum(["general", "hospitality", "saas", "ecommerce", "finance", "healthcare"])`. Toute nouvelle industrie nécessite mise à jour du schema Zod, de la page et de cette spec.

### I-7. Persistance Supabase via setTenantIndustry
L'endpoint appelle `setTenantIndustry(tenantId, industry)` de `lib/verticals/hospitality`. Le vertical est stocké dans `tenant_settings` (migration 0053). Le cache de `getTenantIndustry` (TTL 5 min) est invalidé immédiatement après le SET pour reflet immédiat.

### I-8. Authentification requise sur l'endpoint
`POST /api/onboarding/set-industry` utilise `requireScope`. Retourne 401 si l'utilisateur n'est pas authentifié. La page `/onboarding/vertical` ne bypass pas l'auth middleware.

### I-9. Redirect après submit → toujours `/`
Après un submit réussi, `router.push("/")` est appelé. Pas de redirect configurable, pas de redirect vers `/onboarding/next-step`.

### I-10. Hospitalité → persona concierge
Quand le vertical `hospitality` est sélectionné, le persona builtin `hospitality-concierge` est activé par la logique verticale. Ce couplage est géré côté serveur dans `lib/verticals/hospitality` — la page onboarding ne gère pas ce couplage directement.

## Tests
Existants :
- Aucun test dédié à OnboardingTour ou à la page vertical répertorié au 2026-05-08.

Manquants (P0) :
- `OnboardingTour` : test que le tour ne s'affiche pas si `hearst.onboarded` est défini dans localStorage
- `OnboardingTour` : test progression 3 slides → fermeture et persistance flag
- `OnboardingTour` : test hotkeys Escape (ferme) et Enter/ArrowRight (avance)
- `POST /api/onboarding/set-industry` : test 401 si non authentifié
- `POST /api/onboarding/set-industry` : test 400 si industry invalide
- `POST /api/onboarding/set-industry` : test 200 + appel setTenantIndustry avec bonne valeur
