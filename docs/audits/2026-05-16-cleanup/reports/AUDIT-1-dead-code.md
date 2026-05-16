# Audit 1 — Dead code, exports orphelins, fichiers non utilisés

**Date** : 2026-05-16
**Mode** : READ-ONLY (aucun fichier modifié hors ce rapport)
**Outils** : `npx knip --reporter json` + greps de validation (3+ par finding)
**Scope** : `lib/`, `app/(user)/components/`, `app/(user)/_stages/`, `app/api/`,
`hooks/`, `app/hooks/`, `stores/`, `components/`, `providers/`, `styles/`,
`scripts/` — hors `spatial-safe/**`, `lab/cli-os/**`, `Apple-Vision-Pro-UI-Kit/**`,
`docs/spatial/_BACKUP_*`, `.next/`, `dist/`, `build/`, `node_modules/`.

---

## Stats globales

| Catégorie | Valeur |
|---|---|
| Fichiers TS/TSX en scope (hors tests) | **1 131** |
| **Fichiers orphelins (CONFIRMED-DEAD)** | **89** (≈ 10 600 LoC) |
| **Fichiers orphelins (LIKELY-DEAD)** | **4** (≈ 620 LoC) |
| **Exports orphelins (knip + greps)** | **214** dans 73 fichiers |
| **Types/interfaces orphelins (knip + greps)** | **383** dans 100 fichiers |
| **Routes API potentiellement orphelines** | **~12** (LIKELY-DEAD, validation manuelle) |
| **Composants UI top-level non utilisés** | **16** |
| **Hooks orphelins** | **3** (chaîne morte rails) |
| **Stores orphelins** | **2** (`builder`, `spatial-selection`) |

**Suppression potentielle totale (CONFIRMED) : ~10 600 LoC fichiers entiers +
exports orphelins** (et autant de code mort caché derrière `if false` / branches
chat ChatGPT-style à ne pas casser).

### Détonateur clé : démantèlement Kimi 2026-05-15

Le shell legacy `LeftPanelShell` / `RightPanel` / `TimelineRail` /
`ContextRail` (+ tous leurs sous-composants) a été désactivé pendant le cleanup
Kimi (cf. mémoire `project_kimi_cleanup_2026_05_15.md`). Le nouveau shell
visionOS (12 stages data-bound, `app/(user)/layout.tsx`) n'importe plus aucun de
ces composants. Ces fichiers représentent **≈ 5 150 LoC** à eux seuls (timeline-rail
+ context-rail + shell top-level).

---

## Méthode

1. **knip** (`knip.json` existant) → 247 fichiers signalés orphelins, filtrés à
   93 après exclusion `spatial-safe / lab / docs/spatial/_BACKUP_ /
   Apple-Vision-Pro-UI-Kit / nexbot_robot...`.
2. Pour chaque finding, **au moins 3 greps** : nom exact, import path complet
   (`@/lib/...`), import path relatif (`./xxx`), recherche en template literal.
3. Distinction systématique CONFIRMED-DEAD / LIKELY-DEAD / DEPRECATED.
4. Routes API : check via `fetch("/api/...")` / `fetch(\`/api/...\`)` /
   imports `@/lib/contracts/...` → résultats trop bruyants pour conclure
   CONFIRMED, marqués LIKELY-DEAD.

---

## Section 1 — CONFIRMED-DEAD (sûr à supprimer)

### 1.1 Fichiers entiers — Shell legacy (héritage Kimi cleanup)

Ces fichiers ne sont importés nulle part. Le shell actuel (cf.
`app/(user)/layout.tsx`) est `Commandeur` + `FocusBadge` + `MobileBottomNav` +
`VoicePulse` ; aucune trace des composants ci-dessous.

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-1 | `app/(user)/components/LeftPanelShell.tsx` | 95 | `grep -rn "import.*LeftPanelShell"` → 0 hit hors `lab/cli-os/src/lib/navigation-truth.ts` (référence en string) |
| DC-2 | `app/(user)/components/RightPanel.tsx` | 102 | `grep -rn "import.*RightPanel\b"` → 0 hit hors lab/docs |
| DC-3 | `app/(user)/components/TimelineRail.tsx` | 50 (shim) | `grep -rn "import.*TimelineRail"` → 1 hit, `LeftPanelShell` (lui-même orphelin) |
| DC-4 | `app/(user)/components/ContextRail.tsx` | 50 (shim) | `grep -rn "import.*ContextRail"` → 1 hit, `RightPanel` (lui-même orphelin) |
| DC-5 | `app/(user)/components/PulseBar.tsx` | 350 | `grep -rn "import.*PulseBar"` → 0 hit |
| DC-6 | `app/(user)/components/NotificationBell.tsx` | 220 | 1 importeur = `PulseBar` (DC-5) |
| DC-7 | `app/(user)/components/SpaceSelector.tsx` | 150 | 1 importeur = `PulseBar` (DC-5) |
| DC-8 | `app/(user)/components/HearstLogo.tsx` | 35 | 0 importeur |
| DC-9 | `app/(user)/components/RelativeTime.tsx` | 28 | 0 importeur |
| DC-10 | `app/(user)/components/StageFooter.tsx` | 80 | 0 importeur |
| DC-11 | `app/(user)/components/RunTimeline.tsx` | 280 | 0 importeur |
| DC-12 | `app/(user)/components/MissionEditor.tsx` | 460 | 0 importeur |
| DC-13 | `app/(user)/components/PersonaABTestPanel.tsx` | 340 | 0 importeur |
| DC-14 | `app/(user)/components/PdfViewer.tsx` | 70 | 0 importeur |
| DC-15 | `app/(user)/components/AssetPreview.tsx` | 122 | 0 importeur |
| DC-16 | `app/(user)/_shell/FloatingFooter.tsx` | 30 | 0 importeur |

**Sous-total : ≈ 2 400 LoC.**

### 1.2 Fichiers entiers — Sous-arborescence `timeline-rail/` (orpheline en bloc)

Tous les fichiers du dossier `app/(user)/components/timeline-rail/` sont
exclusivement consommés entre eux ; aucun point d'entrée actif hors-dossier
n'importe le dossier. La racine `TimelineRail.tsx` (DC-3) est elle-même morte.

| ID | File | LoC |
|----|------|-----|
| DC-17 | `app/(user)/components/timeline-rail/TimelineRail.tsx` | 535 |
| DC-18 | `app/(user)/components/timeline-rail/RailHeader.tsx` | 95 |
| DC-19 | `app/(user)/components/timeline-rail/RailFooter.tsx` | 120 |
| DC-20 | `app/(user)/components/timeline-rail/RailCollapsedBody.tsx` | 60 |
| DC-21 | `app/(user)/components/timeline-rail/RailExpandedBody.tsx` | 220 |
| DC-22 | `app/(user)/components/timeline-rail/CollapsedTile.tsx` | 80 |
| DC-23 | `app/(user)/components/timeline-rail/ThreadRow.tsx` | 150 |
| DC-24 | `app/(user)/components/timeline-rail/SectionHeader.tsx` | 55 |
| DC-25 | `app/(user)/components/timeline-rail/GhostFooterLink.tsx` | 40 |
| DC-26 | `app/(user)/components/timeline-rail/TopMenuItem.tsx` | 70 |
| DC-27 | `app/(user)/components/timeline-rail/icons.tsx` | 80 |
| DC-28 | `app/(user)/components/timeline-rail/shared.ts` | 40 |
| DC-29 | `app/(user)/components/timeline-rail/index.ts` | 5 |

**Sous-total : ≈ 1 550 LoC.**
**Evidence** : `grep -rn "from.*\"@/app/(user)/components/timeline-rail"` → 0 hit
en code de prod (seules les self-références internes au dossier).

### 1.3 Fichiers entiers — Sous-arborescence `context-rail/` (orpheline en bloc)

Idem timeline-rail : la racine `ContextRail.tsx` (DC-4) est morte, le dossier
entier est consommé exclusivement par lui-même.

| ID | File | LoC approx |
|----|------|-----|
| DC-30 | `app/(user)/components/context-rail/ContextRail.tsx` | 180 |
| DC-31 | `app/(user)/components/context-rail/ContextRailShell.tsx` | 140 |
| DC-32 | `app/(user)/components/context-rail/Section.tsx` | 95 |
| DC-33 | `app/(user)/components/context-rail/ContextRailForAdmin.tsx` | 70 |
| DC-34 | `app/(user)/components/context-rail/ContextRailForArtifact.tsx` | 80 |
| DC-35 | `app/(user)/components/context-rail/ContextRailForAsset.tsx` | 95 |
| DC-36 | `app/(user)/components/context-rail/ContextRailForAssetCompare.tsx` | 60 |
| DC-37 | `app/(user)/components/context-rail/ContextRailForBrowser.tsx` | 90 |
| DC-38 | `app/(user)/components/context-rail/ContextRailForCockpitChat.tsx` | 120 |
| DC-39 | `app/(user)/components/context-rail/ContextRailForKnowledge.tsx` | 110 |
| DC-40 | `app/(user)/components/context-rail/ContextRailForMeeting.tsx` | 80 |
| DC-41 | `app/(user)/components/context-rail/ContextRailForPreMeeting.tsx` | 130 |
| DC-42 | `app/(user)/components/context-rail/ContextRailForSimulation.tsx` | 80 |
| DC-43 | `app/(user)/components/context-rail/ContextRailForVoice.tsx` | 85 |
| DC-44 | `app/(user)/components/context-rail/hooks/usePreMeetingActive.ts` | 50 |

**Sous-total : ≈ 1 460 LoC.**
**Evidence** : `grep -rn "from.*\"@/app/(user)/components/context-rail"` → 0 hit
de production.

### 1.4 Builder visuel missions (mort)

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-45 | `app/(user)/components/missions/builder/WorkflowCanvas.tsx` | 590 | 0 importeur |
| DC-46 | `app/(user)/components/missions/builder/BuilderToolbar.tsx` | 150 | 0 importeur |
| DC-47 | `app/(user)/components/missions/builder/NodeConfigPanel.tsx` | 280 | 0 importeur |
| DC-48 | `app/(user)/components/missions/builder/NodePalette.tsx` | 250 | 0 importeur |
| DC-49 | `app/(user)/components/missions/MissionRow.tsx` | 120 | 0 importeur (importait `ghost-icons` qui est aussi orphelin) |
| DC-50 | `stores/builder.ts` | 70 | 1 importeur = `ContextRailForAdmin` (DC-33, lui-même mort) |

**Sous-total : ≈ 1 460 LoC.** Toute la chaîne builder est morte.

### 1.5 Reports — Studio editor (mort)

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-51 | `app/(user)/components/reports/studio/PreviewPane.tsx` | 280 | 0 importeur |
| DC-52 | `app/(user)/components/reports/studio/BlockConfigPanel.tsx` | 220 | 0 importeur |
| DC-53 | `app/(user)/components/reports/studio/StudioToolbar.tsx` | 110 | 0 importeur |
| DC-54 | `app/(user)/components/reports/ReportCard.tsx` | 75 | 0 importeur |

**Sous-total : ≈ 685 LoC.**

### 1.6 Right-panel orphelins (résidus du shell legacy)

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-55 | `app/(user)/components/right-panel/GeneralDashboard.tsx` | 380 | 0 importeur |
| DC-56 | `app/(user)/components/right-panel/use-dashboard-counts.ts` | 130 | 0 importeur |

### 1.7 Marketplace + library + personas (résidus)

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-57 | `app/(user)/components/library/LibraryTabs.tsx` | 120 | 0 importeur |
| DC-58 | `app/(user)/components/marketplace/PublishTemplateModal.tsx` | 280 | 0 importeur |
| DC-59 | `app/(user)/components/personas/PersonaCard.tsx` | 60 | 0 importeur |

### 1.8 Toast — chaîne morte complète

Le système `Toast` legacy est entièrement remplacé par `@/app/hooks/use-toast`
(qui exporte `toast`). Mais les fichiers UI Toast sont morts.

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-60 | `app/components/Toast.tsx` | 50 | importé seulement par `ToastContainer` (DC-61) et `use-toast.ts` (le type, qui peut être inliné) |
| DC-61 | `app/components/ToastContainer.tsx` | 60 | 0 importeur |

### 1.9 Spatial — modules orphelins (HORS `spatial-safe`)

Le dossier `components/spatial/` est en partie utilisé par `app/spatial/` et
`app/spatial-rnd/`, mais ces sous-modules sont totalement morts (barrels +
materials/motion/orbital/overlays jamais consommés ; uniquement les
imports directs par path le sont).

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-62 | `components/spatial/index.ts` | 8 | 0 importeur (barrel) |
| DC-63 | `components/spatial/core/index.ts` | 10 | 0 importeur (les composants core sont importés par path direct) |
| DC-64 | `components/spatial/materials/index.ts` | 4 | 0 importeur |
| DC-65 | `components/spatial/materials/GlassMaterial.tsx` | 65 | 0 importeur |
| DC-66 | `components/spatial/motion/index.ts` | 4 | 0 importeur |
| DC-67 | `components/spatial/motion/SpatialTransition.tsx` | 60 | 0 importeur |
| DC-68 | `components/spatial/motion/variants.ts` | 40 | 0 importeur |
| DC-69 | `components/spatial/orbital/index.ts` | 5 | 0 importeur |
| DC-70 | `components/spatial/orbital/ActionRing.tsx` | 130 | 0 importeur |
| DC-71 | `components/spatial/orbital/OrbitalItem.tsx` | 90 | 0 importeur |
| DC-72 | `components/spatial/orbital/OrbitalRing.tsx` | 110 | 0 importeur |
| DC-73 | `components/spatial/overlays/index.ts` | 5 | 0 importeur |
| DC-74 | `components/spatial/overlays/CopperPowerRing.tsx` | 80 | 0 importeur |
| DC-75 | `components/spatial/overlays/ExpertModeAffordance.tsx` | 60 | 0 importeur |
| DC-76 | `components/spatial/overlays/MissionStatus.tsx` | 90 | 0 importeur |
| DC-77 | `components/spatial/overlays/OrbAffordance.tsx` | 70 | 0 importeur |
| DC-78 | `components/spatial/overlays/SpatialHUD.tsx` | 75 | 0 importeur |
| DC-79 | `components/spatial/rnd/CockpitPanel3D.tsx` | 75 | 0 importeur (seul consumer de `stores/spatial-selection`) |
| DC-80 | `hooks/spatial/index.ts` | 3 | 0 importeur |
| DC-81 | `hooks/spatial/useSpatialMouse.ts` | 50 | 0 importeur |
| DC-82 | `hooks/spatial/useSpatialR3F.ts` | 90 | 0 importeur |
| DC-83 | `lib/spatial/index.ts` | 5 | 0 importeur (barrel) |
| DC-84 | `providers/spatial/index.ts` | 5 | 0 importeur |
| DC-85 | `styles/spatial/index.ts` | 3 | 0 importeur |
| DC-86 | `stores/spatial-selection.ts` | 95 | 1 importeur = `CockpitPanel3D` (DC-79, mort) |

**Sous-total : ≈ 1 240 LoC.**

### 1.10 lib/ orphelins divers

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-87 | `lib/multi-tenant/active-space.ts` | 70 | `getActiveSpaceIdFromRequest` jamais importé hors self-doc |
| DC-88 | `lib/platform/fetch-timeout.ts` | 50 | 0 importeur |
| DC-89 | `lib/connectors/composio/brand-colors.ts` | 90 | 1 importeur = `NodePalette` (DC-48, mort) |

### 1.11 Root + tri-trash (déchets)

| ID | File | LoC | Evidence |
|----|------|-----|----------|
| DC-90 | `update.js` | n/a | Stub root, 0 importeur |
| DC-91 | `.tri-trash/2026-05-15-1900/scripts/check-missions-scope.mjs` | 60 | Déjà déclassé par /tri (benne) |
| DC-92 | `.tri-trash/2026-05-15-1900/scripts/migrate-missions-to-personal-tenant.mjs` | 80 | Idem |
| DC-93 | `.tri-trash/2026-05-15-1900/scripts/setup-personal-scope.mjs` | 70 | Idem |

---

## Section 2 — Exports orphelins CONFIRMED-DEAD (export à retirer, le reste du fichier reste)

Pour des fichiers qui ont **un usage actif** mais où **certains exports** ne
sont pas consommés. Ces exports peuvent être déclassés en `export` → fonction
privée OU supprimés.

| ID | File:Line | Export orphelin | Type | Evidence |
|----|-----------|-----------------|------|----------|
| EX-1 | `lib/cockpit/monthly-card-token.ts:21` | `TTL_MAX_HOURS` | const | Re-export depuis `lib/reports/sharing/signed-url.ts` consommé partout ; copie locale jamais importée |
| EX-2 | `lib/cockpit/monthly-card-token.ts:22` | `TTL_MIN_HOURS` | const | idem |
| EX-3 | `lib/cockpit/monthly-card-token.ts:23` | `SECRET_MIN_LENGTH` | const | idem (collision avec celui de `lib/reports/sharing/signed-url.ts:25`) |
| EX-4 | `lib/reports/sharing/signed-url.ts:25` | `SECRET_MIN_LENGTH` | const | duplicate du EX-3 — 1 source de vérité à garder |
| EX-5 | `lib/llm/index.ts` (barrel) | 15 exports (`defaultCircuitBreaker`, `CircuitOpenError`, `defaultMetrics`, `getMetrics`, `defaultRateLimiter`, `chatWithProfile`, `loadFallbackChain`, `resetLlmProviderCache`, `resolveModelProfile`, `smartChat`, `streamChatWithProfile`, etc.) | const/fn | Tous les consumers importent depuis `@/lib/llm/circuit-breaker`, `@/lib/llm/metrics`, `@/lib/llm/router`, etc. — le barrel n'est jamais touché |
| EX-6 | `lib/llm/index.ts` | 13 types ré-exportés | type | idem EX-5 |
| EX-7 | `lib/core/types/index.ts` | 53 types ré-exportés en barrel | type | Re-exports `lib/core/types/{agents,assets,common,focal,runtime}.ts` ; consumers importent les sous-modules directement |
| EX-8 | `lib/contracts/reports.ts:57-226` | 13 types `*Payload` / `*Query` inferés de Zod | type | Seuls les schemas Zod sont consommés, les types inférés ne sont jamais importés |
| EX-9 | `lib/connectors/composio/index.ts:3,27` | `resetAppsCache`, `toAiTools` | fn | Re-export du barrel ; consumers utilisent `lib/connectors/composio/apps.ts:71` directement |
| EX-10 | `lib/platform/auth/index.ts:8-37` | 16 exports + 5 types ré-exportés | const/fn/type | Barrel ; les modules sont importés par path direct |
| EX-11 | `lib/platform/settings/index.ts:23-42` | 11 exports + 2 types ré-exportés | const/fn/type | Barrel jamais touché |
| EX-12 | `lib/reports/catalog/index.ts:366-426` | 19 const `*_ID` / `*_REQUIRED_APPS` | const | Les catalogues passent par d'autres chemins |
| EX-13 | `lib/reports/spec/schema.ts:62-769` | 18 schemas Zod (`waterfallDatumSchema`, `cohortRowSchema`, `sankeyNodeSchema`, etc.) | const | Schémas spec inutilisés (probablement résidu d'une feature reports avancée) |
| EX-14 | `lib/reports/sources/index.ts:139-144` | 6 fns (`fetchAsset`, `fetchComposio`, `applyMapping`, `extractTabular`, `fetchGoogle`, `fetchHttp`) | fn | Barrel jamais consommé |
| EX-15 | `lib/themes/index.ts:17-29` | `listThemes`, `getTheme`, `THEME_CHANGE_EVENT` | fn/const | 0 importeur |
| EX-16 | `lib/events/types.ts` | 52 types `*Event` (RunCreatedEvent, RunStartedEvent, ToolCallStartedEvent, etc.) | type | Énumérés un par un mais seuls les types union sont consommés |
| EX-17 | `lib/domain/types.ts` | 30 types ré-exportés depuis schemas Zod | type | Barrel ; consumers importent depuis `lib/domain/schemas.ts` |
| EX-18 | `app/(user)/components/ui/index.ts:11-14` | `RailSection`, `ScreenShell`, `SectionHeader`, `CardSkeleton`, `RowSkeleton` | comp | Re-exports ; consumers utilisent les fichiers directement |
| EX-19 | `app/(user)/components/ui/RailSection.tsx:31` | `RailSection` | comp | 0 importeur direct (seuls les ContextRail* morts l'utilisaient) |
| EX-20 | `app/(user)/components/ui/ScreenShell.tsx:72` | `ScreenShell` | comp | 0 importeur direct |
| EX-21 | `app/hooks/use-toast.ts:76` | `useToast` (hook) | fn | Seul `toast` (l'objet API) est utilisé ; le hook `useToast()` ne l'est pas |
| EX-22 | `app/hooks/use-oauth-expiry.ts:86` | `useOAuthExpiry` (hook) | fn | 1 importeur = `TimelineRail.tsx` (DC-17, mort) |
| EX-23 | `app/components/Toast.tsx:45` | `Toast` | comp | importé uniquement par `ToastContainer` (DC-61, mort) |
| EX-24 | `app/(user)/components/ghost-icons.tsx` | 10 icons (`GhostIconChevronRight`, `GhostIconPlay`, `GhostIconPencil`, `GhostIconTrash`, `GhostIconMenu`, `GhostIconCamera`, `GhostIconTarget`, `GhostIconWave`, `GhostIconCard`, `ServiceIdGlyph`) | comp | Consumers (`PulseBar`, `RightPanel`, `MissionRow`) tous morts ; restent `app/components/Toast.tsx` (mort aussi) → l'ensemble du fichier peut tomber sauf `GhostIconX`, `GhostIconAlert`, `GhostIconCheck` si réutilisés |
| EX-25 | `lib/agents/dual-apps.ts:19` | `DUAL_APP_GROUPS` | const | Seul `__tests__/agents/dual-apps.test.ts` l'utilise → tests morts à supprimer si la const part |
| EX-26 | `lib/analytics/metrics.ts:45` | `computeToolMetrics` | fn | 0 importeur |
| EX-27 | `lib/browser/stagehand-executor.ts:545` | `getBrowserExecutor` | fn | 0 importeur |
| EX-28 | `lib/marketplace/types.ts:18-77` | 4 schemas Zod (`tagSchema`, `workflowGraphSchema`, `creativePromptPayloadSchema`, `personaPayloadSchema`) | const | 0 importeur |
| EX-29 | `lib/missions/approvals.ts:33` | `SECRET_MIN_LENGTH` | const | Triplicate ! (avec EX-3, EX-4) |
| EX-30 | `lib/monitoring/web-vitals-store.ts:132` | `recordVital` | fn | 0 importeur (web vitals collecté ailleurs) |
| EX-31 | `lib/multi-tenant/types.ts:27,56` | `DEFAULT_SPACE_ID`, `resolveSpaceId` | const/fn | 0 importeur |
| EX-32 | `lib/personas/types.ts:62` | `PERSONA_TONES` | const | 0 importeur |
| EX-33 | `lib/engine/runtime/prompt-guard.ts:28,69` | `validatePromptArtifact`, `loadPromptContent` | fn | 0 importeur |
| EX-34 | `lib/reports/engine/cost-meter.ts:66` | `REPORT_BUDGET_WARN_RATIO` | const | 0 importeur |
| EX-35 | `lib/reports/templates/schema.ts:11,72` | `templateSchema`, `templateSummarySchema` | const | 0 importeur |
| EX-36 | `lib/voice/tool-defs.ts:101` | `VOICE_TOOL_LABELS` | const | 0 importeur |
| EX-37 | `lib/workflows/executor.ts:368,400` | `evaluateCondition`, `evaluateValue` | fn | 0 importeur (executor exporté lui-même est utilisé) |
| EX-38 | `lib/workflows/types.ts:127` | `createEmptyGraph` | fn | 0 importeur |
| EX-39 | `lib/workflows/templates/weekly-slack-digest.ts:24` | `WEEKLY_DIGEST_CRON` | const | 0 importeur |
| EX-40 | `lib/connections/oauth-refresh.ts:31` | `ExpiringConnectionSchema` (re-export) | const | Consumers importent depuis `lib/connections/oauth-constants.ts` |
| EX-41 | `lib/connectors/composio/cache.ts:43` | `DISCOVERY_CACHE_TTL_MS` | const | 0 importeur |
| EX-42 | `lib/editorial/charter.ts:20-41` | `PREFERRED_VOCABULARY`, `BANNED_FORMULAS`, `BANNED_FILLERS` | const | 0 importeur |
| EX-43 | `lib/capabilities/providers/elevenlabs.ts:25` | `ELEVEN_DEFAULT_MODEL_ID` | const | 0 importeur |
| EX-44 | `lib/engine/planner/index.ts:244-298` | `updatePlanFromClarification`, `markPlanAwaitingApproval`, `resolveNextExecutableSteps` | fn | 0 importeur |
| EX-45 | `lib/engine/planner/mission-engine.ts:53` | `getActiveMissions`, `getDueMissions` | fn | 0 importeur |
| EX-46 | `lib/engine/planner/pipeline.ts:75` | `executeIntent` | fn | 0 importeur |
| EX-47 | `lib/reports/comments/store.ts:32-49` | 3 schemas Zod input | const | 0 importeur (schémas wrappés par les routes API qui inlinent leur validation) |
| EX-48 | `lib/reports/versions/store.ts:20-45` | 4 schemas Zod input | const | idem EX-47 |
| EX-49 | `lib/reports/versions/restore.ts:22` | `restoreVersionInputSchema` | const | 0 importeur |
| EX-50 | `lib/reports/sharing/store.ts:101` | `revokeShare` | fn | 0 importeur |
| EX-51 | `lib/themes/index.ts:17-29` | `listThemes`, `getTheme`, `THEME_CHANGE_EVENT` | fn/const | 0 importeur |
| EX-52 | `lib/engine/runtime/index.ts:12` | `RuntimeError`, `withRetry`, `withTimeout` | fn | 0 importeur (barrel jamais touché) |
| EX-53 | `lib/spatial/constants.ts:30-61` | `SCENE_CONFIG`, `MOTION_PRESETS`, `ORB_RADIUS`, `ORBITAL_DEFAULTS` | const | 0 importeur production (spatial-safe les a en interne) |
| EX-54 | `lib/spatial/utils.ts:7-40` | `polarToCartesian`, `distributeOnEllipse`, `lerpColor`, `clamp` | fn | 0 importeur production |
| EX-55 | `providers/spatial/SpatialMotionProvider.tsx:14` | `useSpatialMotion` | fn | 0 importeur production |
| EX-56 | `providers/spatial/SpatialStageProvider.tsx:57` | `useSpatialStage` | fn | 0 importeur production |
| EX-57 | `providers/spatial/SpatialThemeProvider.tsx:18` | `useSpatialTheme` | fn | 0 importeur production |
| EX-58 | `lib/jobs/inngest/functions/pre-meeting-intel.ts:216` | `__clearPreMeetingIntelMemo` | fn | 0 importeur (helper test laissé exporté) |
| EX-59 | `lib/verticals/hospitality/mock-data.ts:180` | `getMockServiceRequests` | fn | 0 importeur |
| EX-60 | `lib/cockpit/weekly-digest.ts:107` | `buildWeeklyWindow` | fn | 0 importeur |
| EX-61 | `lib/memory/conversation-summary.ts:18` | `SummarySchema` | const | 0 importeur |
| EX-62 | `lib/notifications/channels.ts:14` | `CHANNEL_HTTP_TIMEOUT_MS` | const | 0 importeur |
| EX-63 | `lib/engine/runtime/missions/types.ts:35,44` | `approvalModeSchema`, `approvalConfigSchema` | const | 0 importeur |
| EX-64 | `lib/marketplace/creative-packs/index.ts:19` | `BUILTIN_CREATIVE_PACK_ID_PREFIX` | const | 0 importeur |
| EX-65 | `lib/providers/registry.ts:16` | `PROVIDER_IDS` | const | 0 importeur |
| EX-66 | `lib/reports/engine/narrate.ts:33` | `NARRATION_PRESETS` | const | 0 importeur |
| EX-67 | `lib/providers/types.ts:63` | `isProviderId` | fn | 0 importeur |
| EX-68 | `lib/oauth/popup.ts:46` | `setPopupDriver` | fn | 0 importeur |
| EX-69 | `lib/domain/schemas.ts:32-93` | `createSkillSchema`, `createWorkflowSchema`, `createModelProfileSchema` | const | 0 importeur |
| EX-70 | `lib/engine/runtime/jobs/check-oauth-tokens.ts:28` | `checkOAuthTokensPayloadSchema` | const | 0 importeur |
| EX-71 | `lib/engine/runtime/assets/storage/index.ts:16-17` | `LocalStorageProvider`, `R2StorageProvider` (re-exports) | type | Consumers utilisent les sous-modules |
| EX-72 | `lib/contracts/reports.ts:229` | `REPORT_TEMPLATE_LIST_LIMIT_MAX` | const | 0 importeur |
| EX-73 | `lib/platform/auth/tokens.ts:383,404` | `revokeToken`, `clearTokens` | fn | 0 importeur direct (le barrel `lib/platform/auth/index.ts` les ré-exporte aussi → mort en cascade) |
| EX-74 | `lib/platform/auth/session.ts:57` | `requireAuth` | fn | 0 importeur (duplicate avec `lib/platform/auth/index.ts:23`) |
| EX-75 | `lib/connectors/composio/apps.ts:71` | `resetAppsCache` | fn | utilisé seulement en tests |
| EX-76 | `lib/platform/settings/system.ts:38-76` | `getThreshold`, `setThreshold`, `getLimit`, `seedDefaults` | fn | 0 importeur direct (utilisé via barrel mort) |
| EX-77 | `lib/platform/settings/tenant.ts:36-74` | `getAllTenantSettings`, `getTenantFeatureFlag`, `setTenantFeatureFlag`, `getTenantLimit`, `resetTenantSettings` | fn | idem EX-76 |
| EX-78 | `lib/reports/sharing/signed-url.ts:78,103` | `getSharingSecret`, `getSharingSecretsForVerify` | fn | 0 importeur |
| EX-79 | `app/(user)/_stages/registry.ts:208` | `getStageLabel` | fn | 0 importeur |
| EX-80 | `stores/spatial-panels.ts:181` | `panelCategory` | fn | 0 importeur |
| EX-81 | `components/spatial/panels/index.ts:3-7` | `BentoCard`, `FloatingPanel`, `KPIBento`, `MiniChart` (re-exports) | comp | 0 importeur |

---

## Section 3 — Types/interfaces orphelins (échantillon, top 30)

| ID | File:Line | Type | Evidence |
|----|-----------|------|----------|
| TY-1 | `lib/llm/index.ts:1-36` | 13 types (`CircuitState`, `MetricsSnapshot`, `ProviderMetrics`, `ChatRequest`, `ChatResponse`, `LLMProvider`, etc.) ré-exportés | Barrel mort EX-5 |
| TY-2 | `lib/core/types/index.ts:10-93` | 53 types ré-exportés | Barrel mort EX-7 |
| TY-3 | `lib/events/types.ts:104-542` | 52 types `*Event` (RunCreatedEvent, ToolCallStartedEvent, ToolCallCompletedEvent, ToolCallFailedEvent, RunCostEvent, ApprovalRequestedEvent, etc.) | Seul `RuntimeEvent` union est consommé |
| TY-4 | `lib/domain/types.ts:5-72` | 30 types ré-exportés | Barrel mort EX-17 |
| TY-5 | `lib/contracts/reports.ts:57-226` | 13 types Zod inferés | Cf. EX-8 |
| TY-6 | `lib/platform/auth/index.ts:14-36` | 5 types (`CanonicalScope`, `HearstSession`, `KeyProvider`, `StoredTokens`, `TokenMeta`) ré-exportés | Barrel mort EX-10 |
| TY-7 | `lib/connectors/composio/index.ts:2-26` | 4 types (`ComposioApp`, `ConnectedAccount`, `DiscoveredTool`, `AiToolMap`) | Re-exports jamais consommés |
| TY-8 | `lib/contracts/missions.ts:68-125` | 6 types (`CreateMissionPayload`, `ToggleMissionPayload`, `UpdateMissionPayload`, `RunMissionPayload`, `PauseMissionPayload`, `ResumeMissionPayload`) | Zod inferés non importés |
| TY-9 | `lib/contracts/personas.ts:59-97` | 3 types (`CreatePersonaPayload`, `UpdatePersonaPayload`, `AbTestPersonaPayload`) | idem |
| TY-10 | `lib/contracts/jobs.ts:27-72` | 4 types (`ImageGenPayload`, `AudioGenPayload`, `CodeExecPayload`, `DocumentParsePayload`) | idem |
| TY-11 | `lib/architecture-map/types.ts:8-53` | 7 types (`NodeStatus`, `EdgeType`, `UISurfaceEntry`, etc.) | 0 importeur |
| TY-12 | `lib/ui/right-panel/types.ts:8-82` | 7 types (`RightPanelCurrentRun`, `RightPanelRun`, `RightPanelAsset`, `RightPanelMission`, etc.) | Consumers du RightPanel sont morts |
| TY-13 | `lib/inbox/inbox-brief.ts:55-65` | 5 types (`InboxItemKind`, `InboxItemPriority`, `InboxActionKind`, `SuggestedAction`, `InboxItem`) | 0 importeur |
| TY-14 | `lib/artifacts/types.ts:7-54` | 5 types (`ArtifactStatus`, `ArtifactFormat`, `ArtifactSection`, `ArtifactSourceRef`, `ArtifactMetadata`) | 0 importeur |
| TY-15 | `lib/core/types/assets.ts:10-30` | 17 types ré-exportés via le barrel mort | Barrel mort |
| TY-16 | `lib/core/types/runtime.ts:8-21` | 10 types ré-exportés via le barrel mort | Barrel mort |
| TY-17 | `lib/core/types/common.ts:7-25` | 5 types ré-exportés | Barrel mort |
| TY-18 | `lib/core/types/agents.ts:10-13` | 3 types ré-exportés | Barrel mort |
| TY-19 | `lib/engine/runtime/delegate/types.ts:5-77` | 7 types (`CapabilityAgent`, `ExpectedOutput`, `DelegateSuccess`, `DelegateEnqueued`, `DelegateNeedsApproval`, `DelegateNeedsClarification`, `DelegateError`) | 0 importeur |
| TY-20 | `lib/cockpit/weekly-digest.ts:31-54` | 4 types (`WeeklyDigestMissionRow`, `WeeklyDigestAnomalyRow`, `WeeklyDigestAssetRow`, `WeeklyDigestWindow`) | 0 importeur |
| TY-21 | `lib/cockpit/monthly-card.ts:55-77` | 4 types (`MonthlyCardMissionRow`, `MonthlyCardReportRow`, `MonthlyCardKpi`, `MonthlyCardBestMoment`) | 0 importeur (probablement consommés par le shell legacy mort) |
| TY-22 | `lib/admin/health.ts:263-281` | 3 types (`ServiceStatus`, `ServiceCategory`, `ServiceCheck`) | 0 importeur |
| TY-23 | `lib/memory/kg.ts:20-55` | 3 types (`KgNodeType`, `ExtractedEntity`, `ExtractedRelation`) | 0 importeur |
| TY-24 | `lib/engine/planner/types.ts:42-98` | 3 types (`PlanStepStatus`, `MissionMode`, `MissionStatus`) | 0 importeur |
| TY-25 | `lib/engine/planner/executor.ts:38-54` | 3 types (`CapabilityResolver`, `ToolExecutorFn`, `ApprovalRequestFn`) | 0 importeur |
| TY-26 | `app/(user)/components/ui/Action.tsx:26-28` | `ActionVariant`, `ActionTone`, `ActionSize` (re-exports du barrel mort EX-18) | 0 importeur direct |
| TY-27 | `app/(user)/components/chat-input/index.ts:2` | `ChatInputProps` | 0 importeur |
| TY-28 | `app/(user)/components/report-layout/index.ts:8` | `ReportLayoutProps` | 0 importeur |
| TY-29 | `app/(user)/_stages/types.ts:22` | `FooterConfig` | 0 importeur |
| TY-30 | `stores/chat-stage.ts:16-38` | `ToolCallState`, `RunState`, `TokenEstimate` | 0 importeur |

Soixante-dix autres types orphelins listés en sortie knip — détail dans
`/tmp/types-summary.txt` (sortie brute, regroupée par fichier).

---

## Section 4 — LIKELY-DEAD (à valider manuellement)

### 4.1 Routes API potentiellement orphelines

Validation par script `grep -rE "fetch\([^)]*['\"\\\`].*<route>"` puis grep
texte large. Les routes ci-dessous semblent ne PAS être appelées en frontend
production ni en webhook documenté ; à confirmer cas par cas avant suppression.

| ID | Route | Possible explication |
|----|-------|----------------------|
| LD-1 | `app/api/debug/session/route.ts` | Probablement endpoint dev-only |
| LD-2 | `app/api/v2/scheduler/status/route.ts` | Documenté README mais 0 fetch dans le code |
| LD-3 | `app/api/v2/architecture/route.ts` | Schéma `architecture-map` |
| LD-4 | `app/api/v2/catalog/route.ts` | Peut être consommé via `lib/reports/catalog/*` |
| LD-5 | `app/api/orchestrator/agents/route.ts` | Page admin orchestrator (ignorée knip) |
| LD-6 | `app/api/orchestrator/release/route.ts` | idem |
| LD-7 | `app/api/orchestrator/drift/route.ts` | idem |
| LD-8 | `app/api/orchestrator/registry/route.ts` | idem |
| LD-9 | `app/api/orchestrator/trust/route.ts` | idem |
| LD-10 | `app/api/orchestrator/telemetry/route.ts` | idem |
| LD-11 | `app/api/orchestrator/overview/route.ts` | idem |
| LD-12 | `app/api/v2/missions/ops/route.ts` | 0 fetch trouvé |

**Recommandation** : ouvrir chaque route, vérifier la doc/comments inline qui
mentionne souvent quel composant ou webhook l'appelle. Pour les `orchestrator/*`,
les composants admin sont dans le scope ignoré de knip (`app/admin/orchestrator/**`)
mais inspection visuelle nécessaire.

### 4.2 Fichiers LIKELY-DEAD (besoin de doublecheck)

| ID | File | Raison |
|----|------|--------|
| LD-13 | `lib/llm/anthropic.ts` (marqué `@deprecated`) | 1 caller restant : `__tests__/llm/anthropic-cache-control.test.ts`. Test à mourir aussi si on supprime. |
| LD-14 | `app/(user)/components/ghost-icons.tsx` (10 exports morts) | Voir EX-24. 3 icons (`GhostIconX`, `GhostIconAlert`, `GhostIconCheck`) restent peut-être consommées ; à inspecter avant de supprimer le fichier complet. |

---

## Section 5 — DEPRECATED avec callers résiduels

| ID | File | Statut |
|----|------|--------|
| DP-1 | `lib/llm/anthropic.ts:2` | JSDoc `@deprecated`. 1 caller test (`__tests__/llm/anthropic-cache-control.test.ts`). À supprimer une fois le test retiré. |
| DP-2 | `lib/connectors/composio/apps.ts:71` `resetAppsCache` | Utilisé seulement en tests, OK à garder marqué `@internal` |

---

## Section 6 — Composants UI non utilisés (récap)

Voir Section 1 (DC-5 à DC-16, DC-17 à DC-44, DC-45 à DC-49, DC-51 à DC-54,
DC-55 à DC-59, DC-60 à DC-61). Total : **44 composants UI orphelins**.

---

## Section 7 — Hooks orphelins

| ID | Hook | Statut |
|----|------|--------|
| H-1 | `app/hooks/use-toast.ts` exporte `useToast()` orphelin | Le composant est partiel-mort, l'objet `toast` reste utilisé. À découper. |
| H-2 | `app/hooks/use-oauth-expiry.ts` exporte `useOAuthExpiry()` orphelin | 1 caller dans `TimelineRail` (mort). `invalidateOAuthExpiryCache` reste utilisé. |
| H-3 | `app/(user)/components/context-rail/hooks/usePreMeetingActive.ts` | Hook orphelin (chaîne morte rails) → DC-44 |
| H-4 | `hooks/spatial/useSpatialMouse.ts`, `hooks/spatial/useSpatialR3F.ts` | DC-81, DC-82 |

---

## Section 8 — Stores orphelins

| ID | Store | Statut |
|----|-------|--------|
| S-1 | `stores/builder.ts` | 1 caller mort (`ContextRailForAdmin`). → DC-50 |
| S-2 | `stores/spatial-selection.ts` | 1 caller mort (`CockpitPanel3D`). → DC-86 |

---

## Recommandation par catégorie de fix

| Catégorie | LoC | Action recommandée | Agent fixer suggéré |
|-----------|-----|---------------------|---------------------|
| **Fichiers shell legacy (timeline-rail + context-rail + LeftPanelShell/RightPanel/PulseBar/etc.)** | ~5 150 | `rm -rf` les fichiers/dossiers entiers + un commit "chore(cleanup): remove dead shell components (post-Kimi)" | `cleanup-fixer` (Sonnet 4.6) — purement déclaratif, faible risque |
| **Builder visuel missions** | ~1 460 | `rm` + commit + s'assurer que `MissionStage` actuel ne tente pas d'importer le builder | `cleanup-fixer` (Sonnet 4.6) |
| **Reports studio editor** | ~685 | `rm` + commit | `cleanup-fixer` (Sonnet 4.6) |
| **Spatial barrels + sous-modules orphelins** | ~1 240 | `rm` les barrels (`index.ts`) + composants morts ; **NE PAS TOUCHER** `spatial-safe` ni les composants spatial réellement utilisés | `cleanup-fixer` (Sonnet 4.6) — vigilance double-check `app/spatial/` et `app/spatial-rnd/` ne casse pas |
| **Toast (mort)** | ~170 | Supprimer `app/components/Toast.tsx`, `app/components/ToastContainer.tsx` ; inliner le type `ToastType` dans `app/hooks/use-toast.ts` | `cleanup-fixer` (Sonnet 4.6) |
| **Exports orphelins de barrels (lib/llm, lib/core/types, lib/platform/auth, lib/platform/settings, lib/domain, lib/contracts/reports, etc.)** | n/a | Supprimer les `index.ts` ré-exporteurs morts OU réduire au minimum ; tous les consumers importent par path direct déjà | `cleanup-fixer` (Sonnet 4.6) — attention aux test snapshots |
| **Constants/fns/types orphelins isolés (EX-25 à EX-80)** | n/a | Batch de suppression de 50+ exports, **un par un avec greps de validation** ; supprimer les tests associés si la fonction publique disparait | `cleanup-fixer` (Sonnet 4.6) **avec re-audit obligatoire** (`battle-reaudit` Opus) |
| **Routes API LIKELY-DEAD** | n/a | **Validation manuelle requise** — Adrien décide route par route ; pas de suppression automatique | **manual review** par Adrien |
| **`lib/llm/anthropic.ts` (deprecated)** | n/a | Supprimer + supprimer son test associé | `cleanup-fixer` |
| **`update.js` + `.tri-trash/`** | n/a | `rm -rf .tri-trash/` ; `rm update.js` (stub root) | `cleanup-fixer` |

**Plan d'attaque recommandé** :

1. **Batch 1 — Shell legacy** (5 150 LoC, risque très faible) : supprimer
   `timeline-rail/`, `context-rail/`, `LeftPanelShell`, `RightPanel`,
   `TimelineRail.tsx`, `ContextRail.tsx`, `PulseBar`, `NotificationBell`,
   `SpaceSelector`, `HearstLogo`, `RelativeTime`, `StageFooter`, `RunTimeline`,
   `MissionEditor`, `PersonaABTestPanel`, `PdfViewer`, `AssetPreview`,
   `FloatingFooter`, `right-panel/`, `MissionRow`, `PersonaCard`, `LibraryTabs`,
   `PublishTemplateModal`, `reports/studio/`, `ReportCard`. → ~7 800 LoC.
2. **Batch 2 — Builder + stores morts** (1 530 LoC) : `missions/builder/*`,
   `stores/builder.ts`, `brand-colors.ts`.
3. **Batch 3 — Spatial barrels + composants morts hors `spatial-safe`** (1 240 LoC).
4. **Batch 4 — Toast système** (170 LoC).
5. **Batch 5 — Exports orphelins (EX-1 à EX-80)** : batch automatisable mais
   exige re-audit (couverture tests).
6. **Batch 6 — Types orphelins (TY-1 à TY-100)** : majoritairement des
   re-exports de barrels morts qui tombent gratuitement en suppression Batch 1.
7. **Batch 7 — Manual review routes API LIKELY-DEAD** (Adrien).

---

## Annexes

- Sortie brute knip JSON : `/tmp/knip-report.json`
- Fichiers orphelins (93 entrées) : `/tmp/knip-orphan-files-clean.txt`
- Exports orphelins (par fichier) : `/tmp/exports-summary.txt`
- Types orphelins (par fichier) : `/tmp/types-summary.txt`

**Tous ces fichiers tmp ont été générés en read-only — aucune modification du
codebase hors ce rapport `docs/audits/2026-05-16-cleanup/reports/AUDIT-1-dead-code.md`.**
