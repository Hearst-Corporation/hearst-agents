# Personas — `personas`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `personas` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 — system prompt addon + builtins immutables |

## Description

Variantes de voix (tone, vocabulaire, style guide, system prompt addon) appliquées à l'orchestrator. Builtins immutables par surface (chat, inbox, simulation, voice, cockpit) + fallback hospitality. Custom personas user via Supabase. Une seule persona isDefault par (user, tenant).

## Surface publique

- `GET/POST /api/v2/personas` — list + create
- `GET/PATCH/DELETE /api/v2/personas/[id]` — CRUD (builtins read-only)
- `GET /api/v2/personas/ab-test` — résultats AB test

Composants : `PersonaSwitcher`, `PersonaABTestPanel`, `PersonaCard`

## Types clés

```ts
type PersonaTone = "formal" | "casual" | "analytical" | "creative" | "direct";

interface Persona {
  id, userId, tenantId, name: string;
  description?, tone?: PersonaTone | null;
  vocabulary?: { preferred?: string[]; avoid?: string[] } | null;
  styleGuide?, systemPromptAddon?: string | null;
  surface?: "chat" | "inbox" | "simulation" | "voice" | "cockpit" | null;
  isDefault: boolean;
  createdAt, updatedAt: string;
}
```

Table `personas` : UNIQUE (user_id, tenant_id, name), indexes (user_id, tenant_id), (surface).

## Builtins (6 immutables, IDs prefixed `builtin:`)

| ID | Surface | Tone |
|----|---------|------|
| `builtin:default` | null | direct |
| `builtin:formal` | inbox | formal |
| `builtin:analytical` | simulation | analytical |
| `builtin:casual` | voice | casual |
| `builtin:cockpit` | cockpit | direct |
| `builtin:hospitality-concierge` | null | formal (vertical) |

## Invariants verrouillés

### I-1. Builtins IDs préfixés `builtin:` — immutables, non supprimables, fallback si Supabase down

### I-2. Une seule `isDefault` par (user, tenant) — enforcement applicatif

### I-3. `systemPromptAddon` max 1500 chars — cap strict (budget cache Anthropic)

### I-4. Surface auto-apply order : DB match → builtin surface → vertical fallback → builtin:default

### I-5. Vertical hospitality fallback = `builtin:hospitality-concierge` si industrie = "hospitality"

### I-6. Addon format `<persona>...</persona>` — 5 sections max (nom, description, tone, vocab, style)

### I-7. `PersonaTone` enum closed — `formal|casual|analytical|creative|direct` + null

### I-8. `vocabulary.preferred` et `.avoid` max 12 items each

### I-9. Custom personas always override builtins — jamais l'inverse

### I-10. UNIQUE (user_id, tenant_id, name) — violation = 409 conflict

## Tests

Existants : `personas-crud.test.ts`, `personas-ab-test.test.ts`, `personas/store.test.ts`, `system-prompt-addon.test.ts`, `builtin-hospitality.test.ts`

Manquants : surface auto-apply order, isDefault constraint enforcement, systemPromptAddon 1500 chars, hospitality vertical fallback.
