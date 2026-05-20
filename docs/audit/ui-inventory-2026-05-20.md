# UI Inventory — Helm 2026-05-20

> Audit read-only exhaustif du front Helm pour préparer un grand cleanup.
> Repo : `/Users/adrienbeyondcrypto/Dev/Hearst Corporation/helm — hearst-os/`
> Package consommé : `@hearst/cockpit-shell@0.3.2` (file:.tgz) — source `~/Dev/Hearst Corporation/hub — Hearst-Hub/packages/cockpit-shell/`.
> Légende verdicts : 🟢 KEEP · 🟡 REFACTOR / CONSOLIDATE / REVIEW · 🔴 KILL

---

## 0. Périmètre & méthode

- **Scan**  : `find app/(user)/components app/(user)/_stages app/(user)/_shell app/admin/_components app/admin/_canvas app/admin/_shell app/components -type f -name "*.tsx"` → 160 fichiers.
- **Imports** : agrégation de tous les `^import` du repo hors `node_modules / .next / __tests__ / e2e / .git / dist / graphify-out` (3 851 lignes), puis match par nom de fichier.
- **Duplicates package** : comparaison avec `node_modules/@hearst/cockpit-shell/dist/index.d.ts` (exports actifs : `CockpitShell`, `RailLeft`, `RailRight`, `CenterPanel`, `HubBottomBar`, `ThemeAccent`, `HearstMark`, `OrbitalHub`, `ChatKimi`, `ChatSettings`, `ChatHistory`, `useChat`, `useCockpit`, `Card`, `KpiCard`, `KpiGrid`, `Eyebrow`, `Title`, `Sub`, helpers `setActiveProduct`, stores `subscribeLauncher`/`subscribeRailRight`, etc.).
- **Cross-ref** : croisé avec `docs/audit/code-2026-05-20.html` (4 P0 orphan-export) et `docs/audit/qa-2026-05-20.html` (1 P0 QA) — les findings dupliqués sont marqués mais pas re-démontrés.
- **Note honnêteté** : un import est compté quand un autre fichier référence le `basename` du composant dans une instruction `import`. Cette heuristique sur-estime parfois (collisions de noms communs comme `Card`, `EmptyState`, `Block`) et sous-estime quand un fichier est rendu via barrel (`./index.ts`). Toutes les valeurs `1 import` sont marquées REVIEW pour confirmation manuelle.

---

## 1. Statistiques globales

### Composants UI inventoriés

| Métrique | Valeur |
|---|---:|
| Fichiers `.tsx` audités | **160** |
| Total LOC composants | **27 332** |
| Moyenne LOC / fichier | 171 |
| Fichiers > 400 LOC (à refactor) | **15** |
| Fichiers ≤ 50 LOC | 24 |

### Verdicts agrégés

| Verdict | # fichiers | % | Estimation cleanup |
|---|---:|---:|---|
| 🟢 KEEP | **125** | 78 % | n/a |
| 🟡 REFACTOR (>400 LOC, à découper) | **15** | 9 % | ~30 h (2 h / fichier en moyenne) |
| 🔴 KILL (0 import ou shim mort) | **4** | 2,5 % | ~1 h (suppression + grep retest) |
| 🟡 CONSOLIDATE (duplique package ou autre Helm) | **1** | 0,6 % | ~2 h |
| 🟡 REVIEW (1 import unique à vérifier) | **15** | 9,4 % | ~3 h (audit manuel) |

**Effort total cleanup estimé** : ~36 h dont 30 h sur les 15 stages/composants volumineux (REFACTOR = travail de fond, pas un blocker).
**Quick wins immédiats** (PR-A) : 4 KILL + 1 CONSOLIDATE = **~3 h** pour supprimer ~313 LOC et clarifier les chemins d'import.

### Top 10 fichiers les plus volumineux (LOC desc)

| Rang | Fichier | LOC | Verdict |
|---:|---|---:|---|
| 1 | `app/(user)/_stages/KGStage.tsx` | **747** | 🟡 REFACTOR |
| 2 | `app/(user)/_stages/ArtifactStage.tsx` | **706** | 🟡 REFACTOR |
| 3 | `app/(user)/components/ChatDock.tsx` | **691** | 🟡 REFACTOR |
| 4 | `app/(user)/_stages/MeetingStage.tsx` | **628** | 🟡 REFACTOR |
| 5 | `app/(user)/_stages/MissionStage.tsx` | **606** | 🟡 REFACTOR |
| 6 | `app/(user)/_stages/SimulationStage.tsx` | **598** | 🟡 REFACTOR |
| 7 | `app/(user)/_stages/BrowserStage.tsx` | **583** | 🟡 REFACTOR |
| 8 | `app/(user)/_stages/SignalStage.tsx` | **529** | 🟡 REFACTOR |
| 9 | `app/(user)/components/ReportActions.tsx` | **525** | 🟡 REFACTOR |
| 10 | `app/(user)/_stages/AssetCompareStage.tsx` | **504** | 🟡 REFACTOR |

### Top 10 fichiers les plus dupliqués / redondants

1. `app/(user)/components/settings/AlertingSettings.tsx` (6 LOC) — 🔴 shim de re-export pur de `./alerting/AlertingSettings.tsx`.
2. `app/(user)/components/ChatInput.tsx` (8 LOC) — 🔴 shim de re-export pur de `./chat-input/ChatInput.tsx`. Le seul consommateur réel direct est `ChatDock.tsx`.
3. `app/(user)/components/cockpit/orbital/OrbeCentral.tsx` (76 LOC) — 🔴 zéro consommateur, export `OrbeCentral` jamais importé (vérifié via `grep -r OrbeCentral`).
4. `app/(user)/components/connections/ConnectionsList.tsx` (121 LOC) — 🔴 barrel de re-exports utilisé via `./connections/ConnectionsList` dans `ConnectionsHub.tsx`. Le barrel ne sert qu'à un seul consommateur → inline puis suppression.
5. `app/admin/_components/EmptyState.tsx` (108 LOC) — 🟡 duplique partiellement `app/(user)/components/ui/EmptyState.tsx` (88 LOC). À consolider sous `app/(user)/components/ui/`.
6. `app/admin/orchestrator/_components/Shell.tsx` (hors scope inventaire principal) — duplique `Card` + `PageHeader` du package + UI Helm. À migrer vers `Card` du package (`@hearst/cockpit-shell`).
7. `app/(user)/components/AlertingSettings.tsx` (déjà listé #1, doublon shim).
8. `app/components/system/NoiseLayer.tsx` — 1 seul import, à vérifier vs `AmbientLayers.tsx` du shell visionOS (potentielle redondance d'effet ambiance).
9. `hooks/spatial-safe/useSpatialMouse.ts` (29 LOC, 0 import dans le repo) — branche spatial-safe orpheline si /spatial-safe page n'est pas linkée.
10. `stores/active-space.ts` (145 LOC, 0 import) — store mort. Concept couvert par `lib/multi-tenant/active-space.ts` (lib serveur).

---

## 2. Inventaire détaillé par catégorie

> Tables triées par LOC décroissant à l'intérieur de chaque catégorie.

### A. `app/(user)/_shell/` — visionOS shell (CŒUR À CONSERVER)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/_shell/LeftRail.tsx` | 244 | 8 | 🟢 KEEP | Rail 88 px visionOS, navigation Stages — pièce maîtresse. |
| `app/(user)/_shell/stage-icons.tsx` | 170 | 3 | 🟢 KEEP | Mapping Stage → icône SVG inline ; spécifique Helm. |
| `app/(user)/_shell/Shell.tsx` | 89 | 24 | 🟢 KEEP | Layout 3D root (perspective 1200 px). LOCKED selon doc-bloc. |
| `app/(user)/_shell/RightRail.tsx` | 79 | 5 | 🟢 KEEP | Rail droit visionOS, indépendant du `RailRight` du package. |
| `app/(user)/_shell/AmbientLayers.tsx` | 44 | 2 | 🟢 KEEP | Halo + dots — signature visuelle visionOS. |

**Note** : aucun de ces 5 fichiers n'a d'équivalent dans le package — le package expose `RailLeft/RailRight/CenterPanel/HubBottomBar` (bordeaux Cockpit canonical), Helm utilise son shell custom via le mode `headless: true` du `CockpitShell`. Statu quo OK.

### B. `app/(user)/_stages/` — 12 Stages métier

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/_stages/KGStage.tsx` | 747 | 11 | 🟡 REFACTOR | Stage Knowledge Graph — découper en `KGCanvas` / `KGSidebar` / `KGControls`. |
| `app/(user)/_stages/ArtifactStage.tsx` | 706 | 7 | 🟡 REFACTOR | Code editor embarqué + diff + run. Découper en `ArtifactEditor` / `ArtifactPreview` / `ArtifactRunPanel`. |
| `app/(user)/_stages/MeetingStage.tsx` | 628 | 7 | 🟡 REFACTOR | Capture audio + transcript + résumé. À décomposer. |
| `app/(user)/_stages/MissionStage.tsx` | 606 | 10 | 🟡 REFACTOR | Détail mission + steps + receipts. |
| `app/(user)/_stages/SimulationStage.tsx` | 598 | 9 | 🟡 REFACTOR | Sim engine + result viewer. |
| `app/(user)/_stages/BrowserStage.tsx` | 583 | 10 | 🟡 REFACTOR | Sessions + extract schema modal embarqué. |
| `app/(user)/_stages/SignalStage.tsx` | 529 | 8 | 🟡 REFACTOR | Liste signaux + détail. |
| `app/(user)/_stages/AssetCompareStage.tsx` | 504 | 7 | 🟡 REFACTOR | Compare 2 variants côte à côte. |
| `app/(user)/_stages/AssetStage.tsx` | 483 | 10 | 🟡 REFACTOR | Détail asset + variantes + actions. |
| `app/(user)/_stages/MissionListStage.tsx` | 474 | 9 | 🟡 REFACTOR | Liste paginée + filtres + create. |
| `app/(user)/_stages/ChatStage.tsx` | 463 | 10 | 🟡 REFACTOR | Chat principal — déjà partiellement modularisé via `components/chat/*`. |
| `app/(user)/_stages/VoiceStage.tsx` | 87 | 8 | 🟢 KEEP | Compact, déjà bien découpé. |

**Constat** : 11 Stages sur 12 dépassent 400 LOC. Ils embarquent leur header + leurs panels + leurs hooks. Refactor recommandé : pour chaque Stage, extraire `<StageHeader>` / `<StagePanel>` / `<StageActions>` dans un sous-dossier `_stages/<key>/_parts/`. Effort ≈ 2 h × 11 = 22 h.

### C0. `app/(user)/components/` (racine — 38 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/ChatDock.tsx` | 691 | 18 | 🟡 REFACTOR | Le dock du chat embarque streaming + receipts + assets + mentions. Le plus gros. À découper en `ChatDockShell` / `ChatStreamRenderer` / `ChatReceiptsList`. |
| `app/(user)/components/ReportActions.tsx` | 525 | 6 | 🟡 REFACTOR | Toolbar actions report — découpable par groupe d'actions. |
| `app/(user)/components/VariantCarousel.tsx` | 458 | 5 | 🟡 REFACTOR | Carousel + previewer + selector. |
| `app/(user)/components/AssetLineage.tsx` | 347 | 2 | 🟢 KEEP | Vue lineage spécifique. |
| `app/(user)/components/ChatAssetCard.tsx` | 346 | 6 | 🟢 KEEP | Card asset dans chat. |
| `app/(user)/components/FocalStage.tsx` | 334 | 11 | 🟢 KEEP | Overlay focal mode. |
| `app/(user)/components/DocumentParseModal.tsx` | 307 | 7 | 🟢 KEEP | Modal parse PDF. Audit code-2026-05-20 mentionne `DocumentParseModal` dans orphan-export — à recouper. |
| `app/(user)/components/Commandeur.tsx` | 277 | 14 | 🟢 KEEP | ⌘K palette — central. |
| `app/(user)/components/ApprovalInline.tsx` | 255 | 6 | 🟢 KEEP | Encart d'approbation inline. |
| `app/(user)/components/CockpitHero.tsx` | 219 | 3 | 🟢 KEEP | Hero header Cockpit. |
| `app/(user)/components/OnboardingTour.tsx` | 209 | 1 | 🟡 REVIEW | 1 seul import — vérifier mount dans layout. |
| `app/(user)/components/MissionStepGraph.tsx` | 204 | 4 | 🟢 KEEP | Graph SVG mission steps. |
| `app/(user)/components/VideoPlayer.tsx` | 195 | 3 | 🟢 KEEP | Player vidéo custom. |
| `app/(user)/components/StepCard.tsx` | 187 | 5 | 🟢 KEEP | Card step mission. |
| `app/(user)/components/FocalRetryButton.tsx` | 179 | 5 | 🟢 KEEP | Bouton retry overlay focal. |
| `app/(user)/components/ChatConnectInline.tsx` | 178 | 4 | 🟢 KEEP | Pop-in connect provider inline chat. |
| `app/(user)/components/AssetCompareModal.tsx` | 177 | 4 | 🟢 KEEP | Modal compare assets. |
| `app/(user)/components/SourceCitation.tsx` | 168 | 4 | 🟢 KEEP | Citation source chat. |
| `app/(user)/components/ActionLog.tsx` | 167 | 2 | 🟢 KEEP | Log d'actions. |
| `app/(user)/components/ConnectionsHub.tsx` | 166 | 3 | 🟢 KEEP | Hub connexions agrégateur. |
| `app/(user)/components/ChatMissionRunInline.tsx` | 161 | 5 | 🟢 KEEP | Receipts run mission inline chat. |
| `app/(user)/components/ProviderChip.tsx` | 161 | 4 | 🟢 KEEP | Chip provider (Slack/Gmail/…) avec icône. |
| `app/(user)/components/ConfirmModal.tsx` | 157 | 8 | 🟢 KEEP | Modal confirmation générique. |
| `app/(user)/components/CodeRunner.tsx` | 154 | 3 | 🟢 KEEP | Runner code embed. |
| `app/(user)/components/MobileBottomNav.tsx` | 133 | 2 | 🟢 KEEP | Bottom nav mobile breakpoint. |
| `app/(user)/components/WelcomePanel.tsx` | 109 | 3 | 🟢 KEEP | Welcome onboarding panel. |
| `app/(user)/components/ChatRunReceipt.tsx` | 104 | 3 | 🟢 KEEP | Receipt run dans chat. |
| `app/(user)/components/CommandeurResultRow.tsx` | 100 | 3 | 🟢 KEEP | Row résultat dans ⌘K. |
| `app/(user)/components/RowActions.tsx` | 100 | 1 | 🟡 REVIEW | 1 seul import. |
| `app/(user)/components/PageHeader.tsx` | 95 | 15 | 🟢 KEEP | Header générique (15 consommateurs). À considérer comme primitive DS. |
| `app/(user)/components/AudioPlayer.tsx` | 73 | 2 | 🟢 KEEP | Audio player custom. |
| `app/(user)/components/ChatToolStream.tsx` | 66 | 5 | 🟢 KEEP | Stream tool calls. |
| `app/(user)/components/FocusBadge.tsx` | 66 | 2 | 🟢 KEEP | Badge focus mode. |
| `app/(user)/components/ImageViewer.tsx` | 62 | 2 | 🟢 KEEP | Image viewer. |
| `app/(user)/components/Breadcrumb.tsx` | 53 | 3 | 🟢 KEEP | Breadcrumb (lui aussi candidat à monter dans `ui/`). |
| `app/(user)/components/ChatActionReceipts.tsx` | 44 | 4 | 🟢 KEEP | Receipts actions chat. |
| `app/(user)/components/ThinkingDisclosure.tsx` | 42 | 1 | 🟡 REVIEW | 1 import. |
| `app/(user)/components/AssetVariantTabs.tsx` | 12 | 10 | 🟢 KEEP | Shim de re-export OK (10 consommateurs). |
| `app/(user)/components/VideoQuickLaunch.tsx` | 12 | 1 | 🟡 REVIEW | Shim — vérifier si le seul consommateur est layout. |
| `app/(user)/components/ReportLayout.tsx` | 9 | 13 | 🟢 KEEP | Shim re-export `./report-layout/ReportLayout`. 13 consommateurs justifient le shim. |
| `app/(user)/components/ChatInput.tsx` | 8 | 18 | 🔴 KILL | Shim de re-export historique. Le seul import direct par le repo est `./ChatInput` depuis `ChatDock.tsx`. À inliner et supprimer. |

### C1. `app/(user)/components/ui/` — primitives Design System (8 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/ui/ToastHost.tsx` | 228 | 4 | 🟢 KEEP | Toast host custom Helm. |
| `app/(user)/components/ui/Action.tsx` | 219 | 22 | 🟢 KEEP | Bouton primitive — très utilisé. |
| `app/(user)/components/ui/ScreenShell.tsx` | 145 | 5 | 🟢 KEEP | Wrapper page. |
| `app/(user)/components/ui/EmptyState.tsx` | 88 | 13 | 🟢 KEEP | Empty state user. La copie admin (`app/admin/_components/EmptyState.tsx`) à consolider sur celui-ci. |
| `app/(user)/components/ui/Skeleton.tsx` | 86 | 1 | 🟢 KEEP | Exporté via `ui/index.ts` (barrel) — l'import direct est 1, total via barrel beaucoup plus. |
| `app/(user)/components/ui/SectionHeader.tsx` | 54 | 2 | 🟢 KEEP | Header section. |
| `app/(user)/components/ui/RailSection.tsx` | 53 | 2 | 🟢 KEEP | Section rail. Audit code-2026-05-20 le flagge orphan-export (à vérifier). |
| `app/(user)/components/ui/ValidatedForm.tsx` | 41 | 6 | 🟢 KEEP | Form helper. |

### C2. `app/(user)/components/chat-input/` (8 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/chat-input/ComposerActions.tsx` | 244 | 3 | 🟢 KEEP | Actions du composer (mic, voice, send). |
| `app/(user)/components/chat-input/ChatInput.tsx` | 233 | 18 | 🟢 KEEP | Implémentation réelle (shim racine pointe vers ici). |
| `app/(user)/components/chat-input/QuickMentionRow.tsx` | 92 | 2 | 🟢 KEEP | |
| `app/(user)/components/chat-input/StatusMessages.tsx` | 66 | 2 | 🟢 KEEP | |
| `app/(user)/components/chat-input/AttachedAssetChips.tsx` | 65 | 2 | 🟢 KEEP | |
| `app/(user)/components/chat-input/MentionTypeahead.tsx` | 64 | 3 | 🟢 KEEP | |
| `app/(user)/components/chat-input/AutoPill.tsx` | 40 | 2 | 🟢 KEEP | |
| `app/(user)/components/chat-input/PdfAttachmentRow.tsx` | 32 | 2 | 🟢 KEEP | |

### C3. `app/(user)/components/chat/` (6 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/chat/Block.tsx` | 305 | 4 | 🟢 KEEP | |
| `app/(user)/components/chat/BlockActions.tsx` | 237 | 3 | 🟢 KEEP | |
| `app/(user)/components/chat/ConversationHeader.tsx` | 224 | 3 | 🟢 KEEP | |
| `app/(user)/components/chat/WorkingDocument.tsx` | 160 | 2 | 🟢 KEEP | |
| `app/(user)/components/chat/ContextChips.tsx` | 108 | 4 | 🟢 KEEP | |
| `app/(user)/components/chat/BlockEditor.tsx` | 107 | 2 | 🟢 KEEP | |

### C4. `app/(user)/components/cockpit/orbital/` (5 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/cockpit/orbital/OrbitalNodes.tsx` | 206 | 3 | 🟢 KEEP | |
| `app/(user)/components/cockpit/orbital/OrbeCentral.tsx` | 76 | **0** | 🔴 KILL | Confirmé 0 import (grep `OrbeCentral` ne retourne que les définitions du fichier). |
| `app/(user)/components/cockpit/orbital/OrbitalQuickActions.tsx` | 74 | 3 | 🟢 KEEP | |
| `app/(user)/components/cockpit/orbital/OrbitalNode.tsx` | 65 | 2 | 🟢 KEEP | |
| `app/(user)/components/cockpit/orbital/OrbitalGreeting.tsx` | 20 | 1 | 🟡 REVIEW | |

### C5. `app/(user)/components/connections/` (8 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/connections/AppDrawer.tsx` | 288 | 5 | 🟢 KEEP | |
| `app/(user)/components/connections/_parts/CatalogSection.tsx` | 224 | 2 | 🟢 KEEP | |
| `app/(user)/components/connections/ConnectionsList.tsx` | 121 | **0** | 🔴 KILL | Barrel re-export non utilisé par symbole. `ConnectionsHub.tsx` importe via `./connections/ConnectionsList` mais les composants viennent de `_parts/*`. À inliner les exports dans `_parts/` et supprimer. |
| `app/(user)/components/connections/_parts/ConnectedStage.tsx` | 99 | 2 | 🟢 KEEP | |
| `app/(user)/components/connections/_parts/SuggestionsSection.tsx` | 65 | 2 | 🟢 KEEP | |
| `app/(user)/components/connections/_parts/OnboardingSection.tsx` | 64 | 2 | 🟢 KEEP | |
| `app/(user)/components/connections/_parts/SearchResults.tsx` | 64 | 2 | 🟢 KEEP | |
| `app/(user)/components/connections/AppLogo.tsx` | 55 | 7 | 🟢 KEEP | |

### C6. `app/(user)/components/asset-variant-tabs/` (7 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/asset-variant-tabs/AssetVariantTabs.tsx` | 387 | 10 | 🟢 KEEP | |
| `app/(user)/components/asset-variant-tabs/EnrichmentPreviewModal.tsx` | 183 | 3 | 🟢 KEEP | |
| `app/(user)/components/asset-variant-tabs/VariantEmptyState.tsx` | 134 | 4 | 🟢 KEEP | |
| `app/(user)/components/asset-variant-tabs/ForkPanel.tsx` | 124 | 2 | 🟢 KEEP | |
| `app/(user)/components/asset-variant-tabs/VariantActions.tsx` | 64 | 2 | 🟢 KEEP | |
| `app/(user)/components/asset-variant-tabs/VariantPreview.tsx` | 58 | 7 | 🟢 KEEP | |
| `app/(user)/components/asset-variant-tabs/VariantTab.tsx` | 58 | 2 | 🟢 KEEP | |

### C7. `app/(user)/components/report-layout/` (7 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/report-layout/VersionHistoryPanel.tsx` | 359 | 6 | 🟢 KEEP | |
| `app/(user)/components/report-layout/BlockRenderer.tsx` | 217 | 16 | 🟢 KEEP | |
| `app/(user)/components/report-layout/ReportLayout.tsx` | 127 | 13 | 🟢 KEEP | |
| `app/(user)/components/report-layout/ReportHeader.tsx` | 81 | 3 | 🟢 KEEP | |
| `app/(user)/components/report-layout/ReportGrid.tsx` | 64 | 5 | 🟢 KEEP | |
| `app/(user)/components/report-layout/RealtimeToast.tsx` | 31 | 2 | 🟢 KEEP | |
| `app/(user)/components/report-layout/ReportMetaFooter.tsx` | 28 | 4 | 🟢 KEEP | |

### C8. `app/(user)/components/reports/` (8 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/reports/ReportEditor.tsx` | 400 | 10 | 🟢 KEEP | Pile sur 400 — à découper si croit. |
| `app/(user)/components/reports/ReportSpecEditor.tsx` | 242 | 5 | 🟢 KEEP | |
| `app/(user)/components/reports/ResearchReportArticle.tsx` | 182 | 2 | 🟢 KEEP | |
| `app/(user)/components/reports/_parts/EditorToolbar.tsx` | 127 | 1 | 🟡 REVIEW | |
| `app/(user)/components/reports/_parts/SaveTemplateForm.tsx` | 107 | 2 | 🟢 KEEP | |
| `app/(user)/components/reports/_parts/BlockEditorRow.tsx` | 97 | 2 | 🟢 KEEP | |
| `app/(user)/components/reports/_parts/LoadTemplateList.tsx` | 76 | 2 | 🟢 KEEP | |
| `app/(user)/components/reports/_parts/EditorHeader.tsx` | 44 | 1 | 🟡 REVIEW | |

### C9. `app/(user)/components/settings/` (8 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/settings/alerting/primitives.tsx` | 240 | 8 | 🟢 KEEP | Primitives internes ; potentiel candidat à monter dans `ui/` si réutilisé hors alerting. |
| `app/(user)/components/settings/alerting/WebhooksSection.tsx` | 182 | 8 | 🟢 KEEP | |
| `app/(user)/components/settings/alerting/EmailSection.tsx` | 154 | 7 | 🟢 KEEP | |
| `app/(user)/components/settings/alerting/SlackSection.tsx` | 89 | 6 | 🟢 KEEP | |
| `app/(user)/components/settings/alerting/AlertingSettings.tsx` | 53 | 6 | 🟢 KEEP | |
| `app/(user)/components/settings/alerting/SaveHeader.tsx` | 53 | 3 | 🟢 KEEP | |
| `app/(user)/components/settings/alerting/SignalTypesSection.tsx` | 44 | 4 | 🟢 KEEP | |
| `app/(user)/components/settings/AlertingSettings.tsx` | 6 | 6 | 🔴 KILL | Shim de re-export pur — basculer les 6 consommateurs vers `./alerting/AlertingSettings` puis supprimer le shim. |

### CA. `app/(user)/components/video-quick-launch/` (9 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/video-quick-launch/VideoQuickLaunchPanel.tsx` | 295 | 13 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/VideoBatchGrid.tsx` | 201 | 3 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/VideoBatchForm.tsx` | 172 | 4 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/segments.tsx` | 157 | 2 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/VideoSimpleForm.tsx` | 133 | 4 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/_parts/FooterActions.tsx` | 117 | 3 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/_parts/PanelBody.tsx` | 107 | 5 | 🟢 KEEP | |
| `app/(user)/components/video-quick-launch/_parts/ModeToggle.tsx` | 71 | 1 | 🟡 REVIEW | |
| `app/(user)/components/video-quick-launch/_parts/PanelHeader.tsx` | 40 | 2 | 🟢 KEEP | |

### CB. `app/(user)/components/voice/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/voice/VoicePulse.tsx` | 423 | 4 | 🟡 REFACTOR | Overlay voix — découper `VoicePulseCanvas` / `VoicePulseStatus` / `VoicePulseTranscript`. |

### CC. `app/(user)/components/browser/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/browser/ExtractSchemaModal.tsx` | 155 | 4 | 🟢 KEEP | |

### CD. `app/(user)/components/marketplace/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/marketplace/MarketplaceTemplateCard.tsx` | 134 | 1 | 🟡 REVIEW | |

### CE. `app/(user)/components/artifact/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/artifact/CodeEditor.tsx` | 129 | 1 | 🟡 REVIEW | Vérifier consommateur unique (ArtifactStage). |

### CF. `app/(user)/components/kg/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/kg/KgNodeDetail.tsx` | 194 | 2 | 🟢 KEEP | |

### CG. `app/(user)/components/_shell/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/components/_shell/StageFooter.tsx` | 159 | 3 | 🟢 KEEP | Floating footer pill (Dashboard/Chat/Demandes). |

### D. `app/admin/_canvas/` (7 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/admin/_canvas/CanvasShell.tsx` | 212 | 12 | 🟢 KEEP | |
| `app/admin/_canvas/RunWaterfall.tsx` | 179 | 1 | 🟡 REVIEW | |
| `app/admin/_canvas/NodeDetailPanel.tsx` | 134 | 3 | 🟢 KEEP | |
| `app/admin/_canvas/RunRail.tsx` | 123 | 3 | 🟢 KEEP | |
| `app/admin/_canvas/FlowCanvas.tsx` | 122 | 5 | 🟢 KEEP | |
| `app/admin/_canvas/FlowEdge.tsx` | 106 | 4 | 🟢 KEEP | |
| `app/admin/_canvas/FlowLegend.tsx` | 39 | 1 | 🟡 REVIEW | |

### E. `app/admin/_components/` (9 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/admin/_components/ChatWindow.tsx` | 165 | 3 | 🟢 KEEP | |
| `app/admin/_components/UsageTimeSeriesChart.tsx` | 146 | 1 | 🟡 REVIEW | |
| `app/admin/_components/ThemePicker.tsx` | 125 | 5 | 🟢 KEEP | |
| `app/admin/_components/EmptyState.tsx` | 108 | 13 | 🟡 CONSOLIDATE | Duplique `app/(user)/components/ui/EmptyState.tsx`. Migrer vers le user puis supprimer la copie admin (ou inversement, mutualiser dans un futur `packages/ui` interne). |
| `app/admin/_components/TenantsTable.tsx` | 107 | 2 | 🟢 KEEP | |
| `app/admin/_components/BackLink.tsx` | 43 | 5 | 🟢 KEEP | |
| `app/admin/_components/AnalyticsKpiCard.tsx` | 39 | 3 | 🟢 KEEP | Duplique potentiellement `KpiCard` du package — à comparer visuellement. |
| `app/admin/_components/AgentCard.tsx` | 32 | 2 | 🟢 KEEP | |
| `app/admin/_components/ModelBadge.tsx` | 14 | 1 | 🟡 REVIEW | |

### F. `app/admin/_shell/` (4 fichiers)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/admin/_shell/AdminSidebar.tsx` | 175 | 5 | 🟢 KEEP | |
| `app/admin/_shell/AdminTopbarKpis.tsx` | 106 | 2 | 🟢 KEEP | |
| `app/admin/_shell/AdminShell.tsx` | 90 | 4 | 🟢 KEEP | |
| `app/admin/_shell/AdminTopbar.tsx` | 55 | 4 | 🟢 KEEP | |

### G. `app/components/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/components/system/ThemeHydrator.tsx` | 41 | 3 | 🟢 KEEP | Hydrate `data-theme` au boot. |
| `app/components/system/NoiseLayer.tsx` | 17 | 1 | 🟡 REVIEW | Vérifier vs `AmbientLayers.tsx` (potentielle redondance ambiance). |

### Hors inventaire principal — duplicates identifiés ailleurs

- `app/admin/orchestrator/_components/Shell.tsx` — définit `HomShell`, `PageHeader`, `Card`. Le `Card` interne (~20 LOC) duplique `Card` du package `@hearst/cockpit-shell`. **Verdict : CONSOLIDATE** → migrer `Card` vers le package, garder `HomShell` + `PageHeader` localement (specifics admin).

---

## 3. Pages / Routes

Helm est **mono-route Cockpit** : la home `/` mount `<CockpitXClient>` qui pilote l'état Stage via store Zustand. Les autres routes sont :

- des **entrées prefetchées** (RSC) qui passent `initialMode="…"` à CockpitXClient (`/copilote`, `/run`, …),
- des **placeholders** pour absorber des liens hardcodés du package (`/catalog` → redirect `/`),
- des **pages "vraies"** côté admin et settings.

Le LeftRail visionOS ne navigue pas via Next.js : il push dans `useStageStore`. Donc l'audit "accessible depuis la nav" se fait via grep `href=` / `router.push`.

### Routes utilisateur

| Route | Fichier | Référencée ? | Verdict | Note |
|---|---|:-:|---|---|
| `/` | `app/(user)/page.tsx` | ✅ | 🟢 KEEP | Entrée principale. |
| `/(user)/layout.tsx` | `app/(user)/layout.tsx` | ✅ | 🟢 KEEP | Mount CockpitShell headless + Commandeur. |
| `/apps` | `app/(user)/apps/page.tsx` | router.push | 🟢 KEEP | |
| `/archive` | `app/(user)/archive/page.tsx` | router.push | 🟢 KEEP | |
| `/browser` | `app/(user)/browser/page.tsx` | non (utilisé via Stage) | 🟡 REVIEW | Vérifier si raccourci /browser intentionnel. |
| `/catalog` | `app/(user)/catalog/page.tsx` | redirect | 🟢 KEEP | 18 LOC — placeholder utile (HubBottomBar du package linke `/catalog`). |
| `/cockpit-x` | `app/(user)/cockpit-x/page.tsx` | non | 🟡 REVIEW | Page de test P4. À conserver si lab actif, sinon archiver. |
| `/connections` | `app/(user)/connections/page.tsx` | router.push | 🟢 KEEP | |
| `/copilote` | `app/(user)/copilote/page.tsx` | non | 🟢 KEEP | Raccourci prefetch (= `/` + initialMode chat). |
| `/hospitality` | `app/(user)/hospitality/page.tsx` | non | 🟡 REVIEW | Page workflows hôtellerie — vérifier si toujours dans la roadmap produit. |
| `/marketplace` | `app/(user)/marketplace/page.tsx` | router.push | 🟢 KEEP | |
| `/missions` | `app/(user)/missions/page.tsx` | href + router | 🟢 KEEP | |
| `/missions/builder` | `app/(user)/missions/builder/page.tsx` | href via OrbitalQuickActions | 🟢 KEEP | |
| `/notifications` | `app/(user)/notifications/page.tsx` | router.push | 🟢 KEEP | |
| `/reports` | `app/(user)/reports/page.tsx` | href + router | 🟢 KEEP | |
| `/reports/studio` | `app/(user)/reports/studio/page.tsx` | href + router | 🟢 KEEP | |
| `/run` | `app/(user)/run/page.tsx` | non | 🟢 KEEP | Raccourci prefetch. |
| `/runs` | `app/(user)/runs/page.tsx` | router.push | 🟢 KEEP | |
| `/settings` | `app/(user)/settings/page.tsx` | href + router | 🟢 KEEP | |
| `/settings/alerting` | `app/(user)/settings/alerting/page.tsx` | router.push | 🟢 KEEP | |

### Routes admin

Toutes accessibles via `AdminSidebar.tsx` (175 LOC, 5 imports). Pas d'orpheline détectée.

### Routes top-level non-(user)

| Route | Fichier | Verdict | Note |
|---|---|---|---|
| `/` (root layout) | `app/layout.tsx` | 🟢 KEEP | |
| `/login` | `app/login/page.tsx` | 🟢 KEEP | |
| `/spatial-safe` | `app/spatial-safe/page.tsx` | 🟡 REVIEW | Branche Spline / R3F isolée. Vérifier si toujours en cours (hooks `hooks/spatial-safe/*` à 0 import). Si abandon → KILL toute la branche `spatial-safe/`. |
| `/hearst-card/[userId]/[yearMonth]` | `app/hearst-card/[userId]/[yearMonth]/page.tsx` | 🟢 KEEP | |
| `/public/approvals/[token]` | … | 🟢 KEEP | |
| `/public/hearst-card/[token]` | … | 🟢 KEEP | |
| `/public/reports/[token]` | … | 🟢 KEEP | |

---

## 4. CSS / Tokens

### `app/globals.css` — 3 640 lignes

| Métrique | Valeur | Note |
|---|---:|---|
| Tokens custom Helm (`--bg, --surface-*, --text-*, …`) | **341** uniques | Très large surface. |
| Tokens `--ct-*` importés/override depuis le package | **17** | 17 tokens redéfinis dans `:root` + `[data-product="helm"]` (cascade override en bas du fichier). |
| Blocs `[data-product="…"]` | 3 | `helm`, `.ct-hub-bar`, etc. |
| Magic numbers Tailwind (`px-[…], rounded-[…]`) dans CSS | **0** | OK ✅ |
| Hex `#xxxxxx` dans le CSS | **50** | Concentrés dans le bloc theme robotflow importé + scale `--mat-*`. |
| Hex `#xxxxxx` dans `.tsx` (hors commentaires) | **0** | OK ✅ (1 occurrence trouvée = un commentaire dans `layout.tsx`). |

### Tokens `--ct-*` exposés et utilisés

```
--ct-accent, --ct-bg-deep, --ct-border, --ct-border-accent, --ct-border-soft,
--ct-border-strong, --ct-rail-left, --ct-rail-right-eff, --ct-shadow-depth,
--ct-surface-0..3, --ct-text-body, --ct-text-muted, --ct-text-primary,
--ct-text-strong
```

### Imports CSS

```css
@import "tailwindcss";
@import "../themes/robotflowtemplate-webflow-io/tokens.css";
@import "@hearst/cockpit-shell/tokens.css";
```

Cascade : Tailwind base → tokens thème robotflow → tokens package → override `:root` Helm + `[data-product="helm"]`. **Cascade explicite et documentée dans les commentaires.** OK.

### Magic numbers Tailwind dans `.tsx`

18 fichiers contiennent au moins une classe `px-[…], py-[…], rounded-[…], w-[…], h-[…]`. Concentration principalement dans :

- `app/(user)/_shell/RightRail.tsx`, `LeftRail.tsx` — légitime (largeurs 88 px et 320 px imposées par layout shell visionOS).
- `app/(user)/_stages/VoiceStage.tsx`, `AssetCompareStage.tsx`, `KGStage.tsx`, `ArtifactStage.tsx`, `MissionListStage.tsx`.
- `app/(user)/cockpit-x/CockpitXClient.tsx`.
- `app/admin/_components/ChatWindow.tsx`, `ThemePicker.tsx`, `app/admin/agent-driven-dev/[id]/page.tsx`, `app/admin/runs/page.tsx`, `app/admin/orchestrator/telemetry/page.tsx`, `app/admin/settings/page.tsx`.

→ Pas un blocker, mais à passer en revue : si une largeur est utilisée dans plusieurs Stages, créer un token `--ct-stage-width` ou un utility class.

### Conflits / duplicates de tokens

- `--accent-teal` (helm) vs `--ct-accent` (package). Documenté : `[data-product="helm"]` réécrit `--ct-accent: var(--accent-teal)` à la fin du fichier — cascade volontaire. ✅
- `--bg` vs `--ct-bg-deep` — coexistent ; pas de conflit (sémantique différente : `--bg` est le fond global, `--ct-bg-deep` le fond chrome Cockpit).

### Verdict global tokens

🟢 **Cohérent et bien architecturé**. La cascade est documentée, l'override produit isolé, zéro hex hardcodé dans le TSX. Le seul effort résiduel : remonter ~341 tokens Helm dans une source DTCG comme le catalog Cockpit recommande (tokens.core.json), mais ce n'est pas urgent et casserait l'autonomie de Helm.

---

## 5. Stores / state global (`stores/`)

| Fichier | LOC | Consommateurs | Verdict | Note |
|---|---:|---:|---|---|
| `stores/stage.ts` | 201 | **65** | 🟢 KEEP | Store central (mode Stage actuel + payload). |
| `stores/runtime.ts` | 440 | 31 | 🟢 KEEP | Runtime global (commands, voice, focus). À surveiller la taille. |
| `stores/navigation.ts` | 235 | 16 | 🟢 KEEP | |
| `stores/focal.ts` | 221 | 16 | 🟢 KEEP | |
| `stores/voice.ts` | 100 | 15 | 🟢 KEEP | |
| `stores/stage-data.ts` | 107 | 15 | 🟢 KEEP | |
| `stores/chat-stage.ts` | 183 | 3 | 🟢 KEEP | |
| `stores/focus-mode.ts` | 54 | 3 | 🟢 KEEP | |
| `stores/chat-context.ts` | 51 | 3 | 🟢 KEEP | |
| `stores/working-document.ts` | 89 | 2 | 🟢 KEEP | |
| `stores/oauth.ts` | 64 | 2 | 🟢 KEEP | |
| `stores/selection.ts` | 41 | 2 | 🟢 KEEP | |
| `stores/services.ts` | 31 | 2 | 🟢 KEEP | |
| `stores/video-quick-launch.ts` | 29 | 2 | 🟢 KEEP | |
| `stores/notifications.ts` | 241 | 2 | 🟢 KEEP | |
| `stores/reports.ts` | 179 | 1 | 🟡 REVIEW | 1 seul import (`report-layout/use-realtime-payload.ts`). À conserver si payload chargé, mais auditer le consommateur. |
| `stores/active-space.ts` | 145 | **0** | 🔴 KILL | Concept couvert par `lib/multi-tenant/active-space.ts` côté serveur. Zéro import client. |

### Vis-à-vis des stores du package

Le package expose des stores externes `subscribeLauncher / subscribeRailRight / getActiveProduct / setActiveProduct / subscribeActiveProduct`. Helm ne duplique aucun de ces stores — il consomme `setActiveProduct` dans `layout.tsx` au mount. ✅

### Stores duplicates internes ?

- `chat-context` vs `chat-stage` : sémantique différente (contexte = chips actifs, stage = mode chat actuel). Pas de duplicate.
- `stage` vs `stage-data` : couplés (stage = mode courant, stage-data = données chargées). À surveiller pour fusion future.

---

## 6. Hooks custom

### `hooks/` racine

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `hooks/use-conversation-history.ts` | 84 | 1 | 🟡 REVIEW | |

### `hooks/spatial-safe/` (8 fichiers — branche Spline isolée)

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `hooks/spatial-safe/useSpatialMouse.ts` | 29 | **0** | 🔴 KILL | |
| `hooks/spatial-safe/useSplineVoiceBridge.ts` | 55 | 2 | 🟡 REVIEW | |
| `hooks/spatial-safe/useSplineIdleAmbient.ts` | 61 | 2 | 🟡 REVIEW | |
| `hooks/spatial-safe/useSplineStateBridge.ts` | 67 | 2 | 🟡 REVIEW | |
| `hooks/spatial-safe/useSpatialR3F.ts` | 68 | 2 | 🟡 REVIEW | |
| `hooks/spatial-safe/useSplineToolBridge.ts` | 68 | 2 | 🟡 REVIEW | |
| `hooks/spatial-safe/useSplineApp.ts` | 89 | 10 | 🟡 REVIEW | |
| `hooks/spatial-safe/index.ts` | 7 | 3 | 🟡 REVIEW | Barrel. |

**Décision globale spatial-safe** : si `/spatial-safe` n'est pas dans la roadmap → KILL tout le sous-dossier (hooks, providers, components, styles, lib). Sinon REVIEW une seule fois et marquer comme expérimental.

### `app/hooks/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/hooks/use-toast.ts` | 102 | 18 | 🟢 KEEP | |
| `app/hooks/use-global-hotkeys.ts` | 179 | 1 | 🟢 KEEP | 1 seul import = `layout.tsx`, c'est attendu. |
| `app/hooks/use-oauth-completion-poll.ts` | 109 | 1 | 🟡 REVIEW | |
| `app/hooks/use-oauth-expiry.ts` | 116 | 1 | 🟡 REVIEW | |
| `app/hooks/use-variant-ready-notification.ts` | 107 | 1 | 🟡 REVIEW | |

### `app/(user)/hooks/`

| Fichier | LOC | Imports | Verdict | Note |
|---|---:|---:|---|---|
| `app/(user)/hooks/useModalA11y.ts` | 184 | 7 | 🟢 KEEP | A11y trap focus pour modales. |

### Patterns SSE / polling dupliqués ?

À auditer : les 3 hooks oauth/variant utilisent vraisemblablement un pattern de polling commun. Pas de hook unifié `usePoll` détecté à l'œil nu. **Candidat à mutualiser** (effort ~2 h) — voir PR-D ci-dessous.

---

## 7. Assets statiques (`public/`)

| Sous-dossier | Taille | Fichiers | Verdict | Note |
|---|---:|---:|---|---|
| `public/themes/robotflowtemplate-webflow-io/` | **22 Mo** | 355 | 🟡 REVIEW | Theme externe Webflow scrapé. Lourd ; vérifier si le thème robotflow est encore proposé en runtime (`themes/_registry.ts` le déclare). Si oui → KEEP, si non → KILL ~22 Mo. |
| `public/themes/default/` | < 4 Ko | 2 | 🟢 KEEP | Preview SVG du thème par défaut. |
| `public/icons/services/` | 52 Ko | 15 | 🟢 KEEP | Icônes service connectors (Slack, Gmail, …) — utilisées via `lib/integrations/service-map.ts`. |
| `public/hearst-h.svg` | 2 Ko | 1 | 🟢 KEEP | Logo Hearst — utilisé par `LeftRail.tsx`. |
| `public/hearst-dot-h.svg` | 2 Ko | 1 | 🔴 KILL | **0 référence** dans le code. Orphelin. |
| `public/.DS_Store` | 12 Ko | 1 | 🔴 KILL | Pollution macOS — `.gitignore` à durcir. |

**Total** : ~22 Mo dont ~22 Mo dans le theme robotflow. **Plus gros gain potentiel** si le thème robotflow est confirmé inutile.

---

## 8. Plan d'exécution recommandé

Chaque PR doit être **chirurgicale**, mergeable indépendamment, et précédée d'un `npm run lint && npm run typecheck && npm test`.

### PR-A — Kill dead code (effort ~3 h, risque ⭐️ très faible)

**Scope** : suppression de fichiers à 0 import vérifié + shims morts + asset orphelin.

| Fichier | Action |
|---|---|
| `app/(user)/components/cockpit/orbital/OrbeCentral.tsx` | `git rm` |
| `app/(user)/components/connections/ConnectionsList.tsx` | Inliner les 5 re-exports dans `ConnectionsHub.tsx`, puis `git rm` |
| `app/(user)/components/settings/AlertingSettings.tsx` | Mass-replace les 6 imports vers `./alerting/AlertingSettings`, puis `git rm` |
| `app/(user)/components/ChatInput.tsx` | Remplacer l'import unique dans `ChatDock.tsx` par `./chat-input/ChatInput`, puis `git rm` |
| `stores/active-space.ts` | `git rm` |
| `hooks/spatial-safe/useSpatialMouse.ts` | `git rm` (cf. décision globale spatial-safe) |
| `public/hearst-dot-h.svg` | `git rm` |
| `public/.DS_Store` | `git rm` + ajout `.DS_Store` global dans `.gitignore` (vérifier) |

**Risque visuel** : nul (rien n'est rendu).
**Gain** : -~480 LOC + -22 Mo (si on tranche aussi le bloc spatial-safe complet, +0 à ce stade).

### PR-B — Consolidate duplicate primitives (effort ~4 h, risque ⭐️⭐️ faible)

**Scope** : factoriser les primitives dupliquées vers une source unique.

| Action | Fichiers touchés |
|---|---|
| Migrer `Card` de `app/admin/orchestrator/_components/Shell.tsx` vers `import { Card } from "@hearst/cockpit-shell"` | 1 fichier shell + 10 pages orchestrator |
| Supprimer `app/admin/_components/EmptyState.tsx` (108 LOC) et remplacer les 13 imports admin par `import { EmptyState } from "@/app/(user)/components/ui"` | ~14 fichiers |
| Comparer visuellement `AnalyticsKpiCard.tsx` admin vs `KpiCard` du package — si proche, basculer | 1 fichier + N consommateurs |
| Évaluer `PageHeader` Helm vs admin orchestrator `Shell.tsx::PageHeader` — fusionner sous `app/(user)/components/ui/PageHeader.tsx` | 2 fichiers + N |

**Risque visuel** : faible mais réel — relire diff visuel admin avant merge.
**Gain** : -~150 LOC + cohérence DS admin/user.

### PR-C — Refactor stages > 400 LOC (effort ~22 h, risque ⭐️⭐️⭐️ moyen)

**Scope** : découper les 11 Stages monstres en sous-modules `_parts/`.

Stratégie par Stage :
1. Extraire `<StageHeader>` (title + breadcrumb + actions) dans `_stages/<key>/_parts/Header.tsx`.
2. Extraire les panels (left/right) si présents.
3. Extraire les hooks dans un fichier `useStage.ts` voisin.
4. Garder le fichier `KGStage.tsx` (ex.) en orchestrateur, pas en monolithe.

Faire **une PR par Stage** (11 PRs ou 1 grosse par thème : "knowledge stages", "creation stages", "mission stages"). Tests visuels Playwright requis par Stage (les screenshots existants dans `.qa-snapshots/` servent de baseline).

**Risque visuel** : moyen — chaque Stage a sa logique d'état. Découper sans changer le rendu.
**Gain** : lisibilité, testabilité, parallélisation future des refactos.

### PR-D — Mutualiser hooks polling/SSE (effort ~3 h, risque ⭐️ faible)

**Scope** : créer `hooks/use-poll.ts` générique et basculer les 3 hooks oauth/variant qui dupliquent le pattern.

Pattern attendu :
```ts
function usePoll<T>(fn: () => Promise<T>, opts: { interval: number; until?: (v: T) => boolean })
```

**Gain** : -~150 LOC, 1 source de bug à corriger en cas de race.

### PR-E — Décision branche spatial-safe (effort 1 h si KILL, 4 h si KEEP+stabilise)

**Scope** : si confirmé abandon par Adrien → suppression complète du dossier `spatial-safe` partout (`app/spatial-safe`, `hooks/spatial-safe`, `providers/spatial-safe`, `styles/spatial-safe`, `lib/spatial-safe`, `components/spatial-safe`).

**Risque visuel** : nul si page jamais linkée.
**Gain** : ~10-15 fichiers + dépendances `@react-three/*` (~MB de node_modules), conformité knip.

### PR-F — Audit & confirmation des REVIEW (effort ~3 h, risque ⭐️ faible)

**Scope** : 15 fichiers marqués REVIEW (1 seul import détecté) — vérifier manuellement le consommateur unique. Soit reclasser KEEP (consommateur légitime), soit KILL (consommateur lui-même mort).

Liste à passer :
- `OnboardingTour.tsx`, `RowActions.tsx`, `ThinkingDisclosure.tsx`, `VideoQuickLaunch.tsx` (shim), `OrbitalGreeting.tsx`, `EditorToolbar.tsx`, `EditorHeader.tsx`, `ModeToggle.tsx`, `MarketplaceTemplateCard.tsx`, `CodeEditor.tsx`, `RunWaterfall.tsx`, `FlowLegend.tsx`, `UsageTimeSeriesChart.tsx`, `ModelBadge.tsx`, `NoiseLayer.tsx`.

### PR-G — Nettoyage assets (effort ~1 h, risque ⭐️ faible)

**Scope** :
- Décision sur `public/themes/robotflowtemplate-webflow-io/` (22 Mo) : si thème abandonné → suppression dossier complet + retrait du registry. Si conservé → laisser tel quel.
- Suppression `.DS_Store` partout.

**Gain** : potentiellement -22 Mo de repo.

### Synthèse séquence recommandée

| Ordre | PR | Scope | Effort | Risque | Mergeable seul ? |
|---:|---|---|---:|---|:-:|
| 1 | PR-A | Kill dead code | 3 h | ⭐️ | ✅ |
| 2 | PR-F | Confirmation REVIEW | 3 h | ⭐️ | ✅ |
| 3 | PR-B | Consolidate primitives | 4 h | ⭐️⭐️ | ✅ |
| 4 | PR-D | Mutualiser polling | 3 h | ⭐️ | ✅ |
| 5 | PR-G | Nettoyage assets | 1 h | ⭐️ | ✅ |
| 6 | PR-E | Spatial-safe (KILL ou KEEP) | 1-4 h | ⭐️ | ✅ |
| 7 | PR-C | Refactor 11 stages | 22 h | ⭐️⭐️⭐️ | ❌ (1 sub-PR / Stage) |

**Total cleanup chirurgical** : ~37 h (≈ 1 semaine focus).

---

## 9. Cross-références audits existants

Findings déjà documentés ailleurs et **non re-démontrés ici** (pour ne pas dupliquer le travail) :

- `docs/audit/code-2026-05-20.html` : 4 P0 orphan-export + dead code TS. Recouvre partiellement nos KILL/REVIEW (`OrbeCentral`, `ConnectionsList`, `DocumentParseModal` flagué — à confirmer, `RailSection` flagué — à confirmer).
- `docs/audit/qa-2026-05-20.html` : 1 P0 QA — pas d'incidence directe sur l'inventaire UI mais à lire pour le scope global.
- `docs/audit/interface-2026-05-18.html` : audit pixel-perfect précédent — magic numbers déjà réduits à 0 sur le CSS, 18 fichiers TSX restants identifiés ici.
- `docs/audit/nettoyage-2026-05-18.html` : pré-existant — recouper pour éviter double cleanup.

---

## 10. Annexe — Commandes utilisées (reproductibilité)

```bash
# 1. Liste des UI files
find "app/(user)/_shell" "app/(user)/_stages" "app/(user)/components" \
     "app/admin/_shell" "app/admin/_components" "app/admin/_canvas" \
     "app/components" -type f -name "*.tsx" | sort > /tmp/helm_ui_files.txt

# 2. Tous les imports du repo (hors node_modules / .next / tests / e2e / dist)
grep -rE "^import" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=__tests__ --exclude-dir=e2e \
  --exclude-dir=.tri-trash --exclude-dir=graphify-out . > /tmp/all_imports.txt

# 3. Stats LOC + #imports par fichier (Python, basename match)
#    cf. script inline dans la commande Bash de l'audit

# 4. Exports du package
cat node_modules/@hearst/cockpit-shell/dist/index.d.ts | grep "^export"

# 5. Cherche duplicates primitives
grep -rE "export\s+(function|const)\s+(Card|EmptyState|PageHeader|KpiCard|KpiGrid|Eyebrow|Title|Sub|HearstMark)" \
  --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next

# 6. Tokens
grep -oE "^\s*--[a-z][a-zA-Z0-9_-]*" app/globals.css | sort -u | wc -l   # 341
grep -oE "^\s*--ct-[a-zA-Z0-9_-]*" app/globals.css | sort -u | wc -l    # 17

# 7. Magic numbers tailwind
grep -rE "(px-\[|py-\[|rounded-\[|w-\[|h-\[)" \
  --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next \
  --exclude-dir=__tests__ -l "app/(user)" "app/admin" "app/components"

# 8. Hex hardcodés dans TSX
grep -rE "#[0-9a-fA-F]{3,8}" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=__tests__ \
  "app/(user)" "app/admin" "app/components"

# 9. Routes référencées
grep -rE "(href=\"|router\.(push|replace)\(\")" --include="*.tsx" --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=__tests__ "app/"
```

---

_Fin du rapport — généré le 2026-05-20 par audit UI Helm read-only._
