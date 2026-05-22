# MÉGA-PROMPT ORCHESTRATEUR — Moteur de génération `hearst-presentation`

> À coller dans Opus, **dans le workspace `hearst-presentation`** (pas dans Helm).
> Copie tout ce qui est entre les lignes `=== DÉBUT PROMPT ===` et `=== FIN PROMPT ===`.

---

=== DÉBUT PROMPT ===

# RÔLE

Tu es l'orchestrateur d'ingénierie de `hearst-presentation`. Ta mission : implémenter de A à Z le **moteur de génération de présentations par IA**, parfaitement architecturé, branché sur les bons SDK, communiquant exactement comme spécifié ci-dessous. Tu travailles en mode batch autonome : tu décides, tu codes, tu testes, tu commits, tu enchaînes. Tu ne t'arrêtes que si une décision est destructive/irréversible ou si une spec t'oblige à un choix UX opposé sans réponse évidente.

# CONTEXTE — l'app existante (NE PAS CASSER)

Stack actuelle de `hearst-presentation` :
- **Next.js 16** (App Router) + **React 19** + **Tailwind v4** + **TypeScript strict**
- Shell **Cockpit** (UI bordeaux verre dépoli) : `src/components/cockpit/` (CockpitShell, RailLeft, RailRight, CenterPanel, BottomBar, ChatKimi, useChat, primitives)
- Chat IA **Kimi K2.6** via Hypercli (OpenAI-compatible), API route `src/app/api/cockpit-chat/route.ts` (streaming SSE, parsing buffer robuste, persistance Supabase)
- **Supabase** (SSR, RLS par utilisateur, OAuth Google) — client navigateur `src/lib/supabase/client.ts`, serveur `src/lib/supabase/server.ts`, migrations `supabase/migrations/`
- **Electron** desktop (auto-update) — `electron/main.js`, `electron/preload.js`
- LLM client existant : `src/lib/llm/kimi.ts`

Contraintes dures :
- Aucune clé API exposée côté client. Tout secret via `process.env.*`, jamais hardcodé.
- RLS sur toutes les nouvelles tables. Un user ne voit que SES decks.
- Ne casse pas le chat existant ni le shell Cockpit. Tu ajoutes, tu ne refactores pas l'existant sauf nécessité.
- Tokens UI uniquement via les variables CSS Cockpit (`--ct-*`). Pas de hex hardcodé.
- Français pour tout : commits, commentaires, microcopy.

Variables d'environnement à utiliser (déclare-les dans `.env.example`, jamais de valeur réelle commitée) :
`ANTHROPIC_API_KEY`, `HYPERCLI_API_KEY`, `HYPERCLI_BASE_URL`, `FAL_KEY`, `ELEVENLABS_API_KEY`, `COMPOSIO_API_KEY`, `INNGEST_SIGNING_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

# PRINCIPE DIRECTEUR — spec-driven

**Le `DeckSpec` (JSON validé Zod) est la source de vérité unique.** Tout (LLM, images, voix, données live, export, rendu) lit et écrit ce spec. Rien ne se parle "en direct" : tout transite par le spec. Les assets et données sont référencés par **id indirect** (`assetId`, `dataRef`) — régénérer un asset ou rafraîchir une donnée ne casse jamais la structure du deck.

# ARCHITECTURE CIBLE

## 1. Le contrat central — `DeckSpec` (Zod)

Crée `src/lib/presentation/spec/schema.ts` :

```ts
const ChartSpec = z.object({
  kind: z.enum(["bar","bar-stacked","line","area","sparkline","waterfall",
                "donut","pie","treemap","funnel","radar","scatter","bubble","heatmap","gauge"]),
  options: z.record(z.unknown()).optional(),
});

const DataBlock = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
  source: z.enum(["manual","composio","upload"]).default("manual"),
});

const AssetRef = z.object({
  kind: z.enum(["image","audio","video","logo"]),
  storagePath: z.string(),                 // chemin Supabase storage (rapatrié)
  provenance: z.object({ provider: z.string(), model: z.string().optional(), prompt: z.string().optional() }),
});

const SlideBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), title: z.string(), subtitle: z.string().optional() }),
  z.object({ type: z.literal("bullets"), items: z.array(z.string()) }),
  z.object({ type: z.literal("image"), assetId: z.string(), fit: z.enum(["cover","contain"]).default("cover") }),
  z.object({ type: z.literal("chart"), chart: ChartSpec, dataRef: z.string() }),
  z.object({ type: z.literal("kpi"), value: z.string(), label: z.string(), delta: z.number().optional() }),
  z.object({ type: z.literal("table"), columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  z.object({ type: z.literal("quote"), text: z.string(), author: z.string().optional() }),
  z.object({ type: z.literal("timeline"), steps: z.array(z.object({ label: z.string(), date: z.string().optional(), desc: z.string().optional() })) }),
  z.object({ type: z.literal("matrix"), axes: z.tuple([z.string(), z.string()]), items: z.array(z.object({ label: z.string(), x: z.number(), y: z.number() })) }),
  z.object({ type: z.literal("funnel"), stages: z.array(z.object({ label: z.string(), value: z.number() })) }),
  z.object({ type: z.literal("comparison"), left: z.unknown(), right: z.unknown() }),
  z.object({ type: z.literal("team"), members: z.array(z.object({ name: z.string(), role: z.string(), assetId: z.string().optional() })) }),
  z.object({ type: z.literal("logos"), assetIds: z.array(z.string()) }),
  z.object({ type: z.literal("cta"), title: z.string(), action: z.string().optional() }),
]);

const BackgroundSpec = z.union([
  z.object({ kind: z.literal("image"), assetId: z.string() }),
  z.object({ kind: z.literal("gradient"), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal("mesh") }),
  z.object({ kind: z.literal("solid"), token: z.string() }),
]);

const Slide = z.object({
  id: z.string(),
  layout: z.enum(["hero","split-5050","split-3367","grid","full-bleed","data","blank","agenda"]),
  blocks: z.array(SlideBlock),
  background: BackgroundSpec.optional(),
  speakerNotes: z.string().optional(),
  narration: z.object({ audioAssetId: z.string(), durationMs: z.number() }).optional(),
  transition: z.enum(["none","fade","slide"]).default("fade"),
});

const ThemeSpec = z.object({
  product: z.enum(["hive","halo","hyper","hustle","default"]).default("default"),
  palette: z.record(z.string()).optional(),  // surcharge tokens --ct-*
  font: z.string().optional(),
});

export const DeckSpec = z.object({
  version: z.literal(1),
  meta: z.object({
    title: z.string(),
    audience: z.string().optional(),
    tone: z.enum(["exec","commercial","pedagogique","pitch-vc","keynote"]).default("exec"),
    locale: z.string().default("fr"),
    template: z.string(),
  }),
  theme: ThemeSpec,
  slides: z.array(Slide),
  dataBlocks: z.record(DataBlock),
  assets: z.record(AssetRef),
});
export type DeckSpec = z.infer<typeof DeckSpec>;
```

## 2. Interfaces providers (abstraction swappable)

Crée `src/lib/presentation/providers/` avec 3 interfaces et leurs implémentations :

```ts
// image.ts
export interface ImageProvider {
  generate(prompt: string, opts?: { aspect?: string; style?: string }): Promise<{ url: string; model: string }>;
}
// → impl FalImageProvider (@fal-ai/client, modèle flux-pro), résultat rapatrié dans Supabase storage.

// tts.ts
export interface TTSProvider {
  synthesize(text: string, opts?: { voiceId?: string }): Promise<{ audio: ReadableStream; durationMs: number }>;
}
// → impl ElevenLabsProvider.

// data.ts
export interface DataProvider {
  fetch(connectionId: string, query: string): Promise<DataBlock>;
}
// → impl ComposioDataProvider (write-guard preview/confirm si écriture).
```

Règle : tout asset généré (image/audio) est **rapatrié dans Supabase storage** ; on stocke `storagePath` + `provenance`, jamais l'URL provider durable.

## 3. Pipeline du moteur (déterministe, 7 étapes)

Crée `src/lib/presentation/engine/` :

```
brief utilisateur
1. PLAN     generateObject(Claude, OutlineSchema)        → outline (titres + intent/slide)
2. DRAFT    par slide: generateObject(LLM, Slide)         → blocks + layout    [parallélisé]
3. ENRICH   tools en // : generate_image(fal), fetch_data(composio), web_research(exa)
4. DESIGN   auto-layout : équilibrage blocks/slide, style-lock images, theme tokens
5. NARRATE  (option) speaker_notes + ElevenLabs           → narration/slide
6. VALIDATE DeckSpec.parse()                              → garantit rendu sûr
7. RENDER   front React (live) | Playwright→PDF | pptxgenjs→PPTX | ffmpeg→MP4
```

Étapes 1-2 **streamées** vers le front. Étapes 5 et 7-vidéo = **jobs Inngest** (longs), statut via Supabase Realtime.

Utilise le **Vercel AI SDK** (`ai`) comme backbone : `streamObject`/`generateObject` (DeckSpec typé via Zod, jamais de parsing texte fragile) et `streamText` pour les tools. Providers LLM : `@ai-sdk/anthropic` (Claude, plan + qualité) et `@ai-sdk/openai` pointé sur Hypercli (`createOpenAI({ baseURL: process.env.HYPERCLI_BASE_URL, apiKey: process.env.HYPERCLI_API_KEY })`) pour Kimi.

## 4. Tools exposés au LLM

Forme : `{ description, parameters: zodSchema, execute: async (args) => result }`.
`generate_outline`, `generate_slide`, `rewrite_tone`, `generate_speaker_notes`, `generate_image`, `generate_chart_from_data`, `fetch_live_data`, `web_research`, `narrate_slide`, `summarize_doc_to_deck`, `translate_deck`.

## 5. Contrats API (Next App Router)

**Génération — SSE** (même pattern que `/api/cockpit-chat`) :
```
POST /api/presentation/generate   { brief, template, locale, tone }
→ text/event-stream :
   event: outline  data: {slides:[{id,title}]}
   event: slide     data: {<Slide>}          // une par slide, au fil de l'eau
   event: asset     data: {assetId, url}      // image/audio prête
   event: done       data: {deckId}
```

**Export — job** :
```
POST /api/presentation/export   { deckId, format: "pdf"|"pptx"|"png"|"video" }
→ { jobId }    puis notif Supabase Realtime "export_ready" { storagePath }
```

**CRUD** : `GET/POST /api/presentation/decks`, `GET/PATCH/DELETE /api/presentation/decks/[id]`.

Toutes les routes : auth Supabase obligatoire (401 sinon), RLS appliquée.

## 6. Persistance Supabase (nouvelle migration)

```sql
create table decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  spec jsonb not null,
  status text not null default 'draft',  -- draft|generating|ready|error
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table deck_assets (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  kind text not null,                      -- image|audio|video|logo
  storage_path text not null,
  provenance jsonb not null
);
create table deck_data_sources (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  connection_id text not null,
  query text not null,
  last_synced timestamptz
);
create table deck_exports (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  format text not null,
  storage_path text,
  job_id text,
  created_at timestamptz default now()
);
-- RLS : owner_id = auth.uid() sur decks ; héritage via deck_id sur les tables filles.
```

## 7. Rendu (un seul renderer, plusieurs sorties)

`src/components/presentation/SlideRenderer.tsx` = **fonction pure de `Slide`** (React). Le même composant sert :
- l'aperçu live in-app (+ mode présentateur : notes + timer),
- l'export PDF (Playwright `page.pdf()` sur le renderer → fidélité 1:1),
- l'export PNG par slide (Playwright screenshot),
- l'export vidéo (PNG + audio narration → ffmpeg MP4).
Export PPTX : `pptxgenjs` mappe `DeckSpec` → .pptx (chemin séparé, pas via React).
Charts in-app : Recharts, lisant `DataBlock`, stylé tokens Cockpit.

# PLAN DE BATCHES (enchaîne sans t'arrêter entre chaque ; validation à la fin de chaque batch)

**Batch 1 — Fondation spec + persistance**
- `DeckSpec` Zod complet + types + tests Vitest de validation (specs valides/invalides).
- Migration SQL (4 tables + RLS) + régénération `src/lib/supabase/types.ts`.
- Helpers CRUD decks (server). Tests.

**Batch 2 — Providers**
- Interfaces + impl Fal (image), ElevenLabs (tts), Composio (data).
- Rapatriement storage + provenance. Tests avec mocks (pas d'appel réseau réel en CI).

**Batch 3 — Pipeline génération + SSE**
- Étapes PLAN → DRAFT → ENRICH → DESIGN → VALIDATE via AI SDK (`generateObject`).
- Route `POST /api/presentation/generate` en SSE (events outline/slide/asset/done).
- Tools `generate_outline`, `generate_slide`, `generate_image`, `generate_chart_from_data`.
- Langfuse trace sur chaque étape. Tests pipeline (LLM mocké).

**Batch 4 — Rendu live + UI dashboard**
- `SlideRenderer` (tous les layouts + tous les SlideBlock) + charts Recharts.
- Page dashboard présentation dans le shell Cockpit existant : liste decks, bouton "Générer", aperçu live streamé, mode présentateur.
- Brancher le chat Kimi existant sur "modifie la slide N" (édition incrémentale du spec).

**Batch 5 — Export (jobs Inngest)**
- PDF (Playwright), PPTX (pptxgenjs), PNG. Route export + statut Realtime.
- Setup Inngest (client + functions + route `/api/inngest`).

**Batch 6 — Données live + narration + vidéo**
- `fetch_live_data` (Composio) → slide qui se rafraîchit. `deck_data_sources` câblé.
- `narrate_slide` (ElevenLabs) + export vidéo ffmpeg (job Inngest).
- Tools restants (rewrite_tone, translate_deck, summarize_doc_to_deck, web_research).

**Batch 7 — Templates + finitions**
- Templates de départ (pitch VC, QBR, sales deck, product launch, roadmap, rapport financier…).
- Lien public partageable (token HMAC), embed iframe.
- Doc `docs/DECK-ENGINE.md` récap archi + `.env.example` à jour.

# RÈGLES D'EXÉCUTION

- **pnpm** pour tout. Ajoute les deps au fil des batches (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@fal-ai/client`, `@elevenlabs/elevenlabs-js`, `@composio/core`, `pptxgenjs`, `playwright`, `fluent-ffmpeg`, `inngest`, `langfuse`, `recharts`, `zod`).
- Validation à la fin de chaque batch : `pnpm tsc --noEmit && pnpm lint && pnpm test`. Ne passe au batch suivant que si vert.
- Commits Conventional Commits en français, un par batch (`feat(engine): …`, `feat(api): …`, etc.).
- Tests : Vitest unit pour spec/providers/pipeline (réseau mocké), Playwright e2e pour génération→rendu si dispo.
- Tu ne commits aucun secret. `.env.example` avec placeholders uniquement.
- Si une lib n'existe pas / version incompatible, choisis l'alternative la plus proche et documente le choix dans le commit.

# DÉMARRAGE

1. Lis l'arborescence réelle (`src/`, `supabase/migrations/`, `package.json`) pour t'aligner sur l'existant.
2. Confirme en 5 lignes le plan de batches adapté à ce que tu trouves.
3. Lance le Batch 1. Enchaîne. Rapport synthétique en fin de chaque batch (ce qui est fait, tests verts, prochaine étape).

=== FIN PROMPT ===
