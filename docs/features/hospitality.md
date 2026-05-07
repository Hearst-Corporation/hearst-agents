# Hospitality — `hospitality`

## Métadonnées
| **id** | `hospitality` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 (review) |

## Description

Vertical hôtellerie haut de gamme : hub d'entrée `/hospitality`, 3 report specs dédiées (Daily Brief, RevPAR, Guest Satisfaction), 2 workflow templates clé en main (préparation arrivées VIP, dispatch service request), 1 persona builtin `hospitality-concierge`, et un système de détection d'industrie tenant (`getTenantIndustry`).

**Mode démo MVP** : aucun connecteur PMS natif. Toutes les données (arrivals, departures, KPIs, RevPAR 30j, satisfaction) sont servies par `lib/verticals/hospitality/mock-data.ts`. Les sources ReportSpec pointent vers des actions Composio (`PMS_LIST_ARRIVALS_TODAY`, `PMS_KPI_SNAPSHOT`, etc.) inexistantes pour l'instant — le runtime les résout via les fonctions `build*SampleData()` en mode sample. Intégrations PMS (Mews, Cloudbeds, Opera) planifiées Q3 2026.

Relation avec `features/reports.md` : les 3 report specs hospitality sont des entries du catalog reports standard. Elles utilisent les mêmes primitives `ReportSpec` / blocks / narration. Cette spec hospitality documente leur contenu métier et le cycle de vie démo → prod.

Relation avec `features/personas.md` : la persona `builtin:hospitality-concierge` est référencée via `href="/personas?builtin=hospitality-concierge"` depuis la page hub. Sa définition (vocabulaire, tone, systemPromptAddon) vit dans le catalog personas, pas ici.

Relation avec `features/workflows.md` : les 2 templates hospitality sont des `WorkflowGraph` standard. Ils utilisent les mêmes node kinds (`trigger`, `tool_call`, `transform`, `condition`, `approval`, `output`). Les outils référencés (`pms_list_arrivals_today`, `pms_update_request_status`) sont des stubs sans connecteur réel MVP.

## Surface publique

- `GET /hospitality` — page hub : 3 report cards, 2 workflow cards, 1 persona card, banner mode démo, état connecteurs
- `lib/verticals/hospitality/index.ts` — `getTenantIndustry`, `setTenantIndustry`, `isHospitalityTenant`, `HOSPITALITY_VOCABULARY`, `HOSPITALITY_KPIS`
- `lib/verticals/hospitality/mock-data.ts` — `getMockArrivals`, `getMockDepartures`, `getMockKpiSnapshot`, `getMockRevpar30d`, `getMockServiceRequests`, `getMockRevenueBySource`, `getMockSatisfaction`
- `lib/reports/catalog/hospitality-daily-brief.ts` — `buildHospitalityDailyBrief`, `buildHospitalityDailyBriefSampleData`, `HOSPITALITY_DAILY_BRIEF_ID`
- `lib/reports/catalog/hospitality-revpar.ts` — `buildHospitalityRevpar`, `buildHospitalityRevparSampleData`, `HOSPITALITY_REVPAR_ID`
- `lib/reports/catalog/hospitality-guest-satisfaction.ts` — `buildHospitalityGuestSatisfaction`, `buildHospitalityGuestSatisfactionSampleData`, `HOSPITALITY_GUEST_SATISFACTION_ID`
- `lib/workflows/templates/hospitality/guest-arrival-prep.ts` — `guestArrivalPrepTemplate()`
- `lib/workflows/templates/hospitality/service-request-dispatch.ts` — `serviceRequestDispatchTemplate()`

## Types clés

```ts
// lib/verticals/hospitality/index.ts

export type TenantIndustry =
  | "general" | "hospitality" | "saas"
  | "ecommerce" | "finance" | "healthcare";

export const HOSPITALITY_VOCABULARY: {
  preferred: readonly string[];  // guest, ADR, RevPAR, VIP, PMS, concierge…
  avoid: readonly string[];      // client, user, ticket, deal, lead, MRR
}

export const HOSPITALITY_KPIS: readonly string[];
// occupancy, adr, revpar, vip_count, service_requests_pending, guest_satisfaction_nps

// IDs stables des 3 report specs (UUID fixe, hardcodé)
HOSPITALITY_DAILY_BRIEF_ID      = "00000000-0000-4000-8000-700000000001"
HOSPITALITY_REVPAR_ID           = "00000000-0000-4000-8000-700000000002"
HOSPITALITY_GUEST_SATISFACTION_ID = "00000000-0000-4000-8000-700000000003"
```

## Invariants verrouillés

### I-1. mock-data.ts = démo uniquement, jamais référencé en chemin prod
`mock-data.ts` est consommé exclusivement par les fonctions `build*SampleData()` des report specs et par les tests. En production avec un vrai connecteur PMS, les sources `composio` du `ReportSpec` prennent le dessus. Aucun composant UI ne doit importer `mock-data.ts` directement.

### I-2. IDs des 3 report specs sont des UUID fixes et stables
`HOSPITALITY_DAILY_BRIEF_ID`, `HOSPITALITY_REVPAR_ID`, `HOSPITALITY_GUEST_SATISFACTION_ID` sont hardcodés comme `"00000000-0000-4000-8000-700000000001/002/003"`. La page hub référence ces IDs en dur. Ne pas les changer sans mettre à jour tous les call sites.

### I-3. Détection industrie tenant : fail-soft, défaut "general"
`getTenantIndustry(tenantId)` ne peut jamais crasher un tenant non-hospitality. Si Supabase est indisponible ou si le champ `industry` est absent/invalide → retour `"general"`. Cache mémoire 5min pour éviter un round-trip à chaque request.

### I-4. HOSPITALITY_VOCABULARY injecté uniquement pour les tenants hospitality
Les termes preferred/avoid (guest vs client, ADR vs MRR) sont utilisés dans le system prompt addon de la persona concierge et dans l'orchestrateur briefing enrichi. Ils ne doivent pas polluer le vocabulaire d'un tenant SaaS ou finance.

### I-5. Workflow templates = WorkflowGraph standard, pas de type custom
`guestArrivalPrepTemplate()` et `serviceRequestDispatchTemplate()` retournent un `WorkflowGraph` strictement typé. Ils peuvent être publiés au marketplace sans transformation. Les outils `pms_list_arrivals_today` et `pms_update_request_status` sont des stubs — le workflow crée un noeud `tool_call` valide mais l'exécution réelle dépend du connecteur PMS.

### I-6. Workflow guest-arrival-prep : approval gate obligatoire avant Slack
Le noeud `approval_send` ("Validation notes VIP") est positionné entre `draft_welcome_notes` et `send_slack`. Ne pas supprimer cette gate : les welcome notes sont envoyées au staff, une erreur est visible guests. Invariant de sécurité éditorial.

### I-7. Banner mode démo doit rester visible tant qu'aucun PMS n'est connecté
La page `/hospitality` affiche toujours le banner "Mode démo — données PMS mockées" tant que le tenant n'a pas de connecteur PMS actif dans `/apps`. Ce banner est un signal de confiance critique pour l'utilisateur professionnel.

### I-8. Sources ReportSpec hospitality = kind "composio", action PMS_*
Les 3 report specs hospitality utilisent des sources `kind: "composio"` avec des actions préfixées `PMS_`. En MVP sans connecteur, le runtime les résout via `build*SampleData()`. La structure des specs est valide Zod et ne doit pas être modifiée pour contourner l'absence de connecteur (ne pas passer en `kind: "mock"`).

## Notes

- Connecteurs PMS planifiés : Mews, Cloudbeds, Opera, Hotelogix. ETA Q3 2026.
- La page hub `/hospitality` n'a pas de backend propre : elle est statique (données hardcodées pour les cards workflow/report) et appelle les routes reports/missions standard via leurs IDs.
- `setTenantIndustry` persiste en Supabase si disponible, sinon en mémoire (utile pour seed/dev local sans migrations).
- Les KPIs (`HOSPITALITY_KPIS`) et le vocabulaire (`HOSPITALITY_VOCABULARY`) sont réutilisés par l'orchestrateur pour enrichir le briefing d'un tenant hospitality.

## Tests

Existants : aucun test e2e spécifique `/hospitality` identifié. `data-testid` non présents sur la page hub (pas de composant interactif hors liens).

Manquants :
- Test `getTenantIndustry` : Supabase indisponible → retour "general" sans exception
- Test cache 5min : 2e appel rapide ne fait pas de round-trip Supabase
- Test `validatePayload` sur `guestArrivalPrepTemplate()` → valide
- Test `buildHospitalityDailyBriefSampleData()` → shape correcte pour les blocks
- Test e2e page `/hospitality` : 3 report cards + 2 workflow cards rendus, banner mode démo visible
