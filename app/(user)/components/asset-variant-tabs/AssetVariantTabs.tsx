"use client";

/**
 * AssetVariantTabs — Onglets multi-format dans la FocalStage.
 *
 * Pivot 2026-04-29 : un asset (rapport texte) peut avoir des variants
 * audio / vidéo / slides / site générés à la demande. Cet onglet montre
 * les variants existants et propose la génération via bouton CTA.
 *
 * Phase B.1 : audio uniquement (ElevenLabs TTS). Phase B suivante : video
 * (HeyGen + Runway), slides, site.
 *
 * Polling : tant qu'un variant est `pending` ou `generating`, on poll
 * /api/v2/assets/[id]/variants toutes les 4s. Phase B suivante : remplacer
 * par SSE /api/v2/jobs/[id]/progress.
 *
 * [WF5] Timeout watchdog : si un variant reste en `generating` > 10 min,
 * on le marque localement comme failed sans attendre le backend.
 *
 * [S2-B] Enrichissement prompt : avant la génération vidéo Runway, l'user
 * peut activer un toggle "Enrichir automatiquement". Au clic Générer, on
 * appelle /api/v2/assets/enrich-video-prompt et on affiche un mini-modal
 * avec diff inline (original vs enrichi). 3 actions : utiliser l'enrichi /
 * garder l'original / modifier manuellement.
 *
 * [S2-C] Variant fork : sur un variant `ready`, un bouton "Modifier" ouvre
 * un mini-panel pré-rempli avec le prompt original. L'user fait un delta,
 * le système crée un nouveau variant via `derivedFrom` (lineage B4) sans
 * toucher l'original.
 *
 * [S2-D] Notifications desktop : quand un variant passe à `ready` (fin de
 * génération), une `Notification` Web est déclenchée pour informer l'user
 * même s'il a switché d'app. Au clic → focus + setStageMode asset.
 *
 * Refonte 2026-05-10 : composant éclaté en sous-modules
 * (VariantTab, VariantPreview, VariantActions, VariantEmptyState,
 * EnrichmentPreviewModal, ForkPanel, useVariantPolling).
 */

import { useCallback, useState } from "react";
import type { AssetVariant, AssetVariantKind } from "@/lib/assets/variants";
import { EnrichmentPreviewModal } from "./EnrichmentPreviewModal";
import { ForkPanel } from "./ForkPanel";
import { useVariantPolling } from "./hooks/useVariantPolling";
import { type ForkPanelState, TAB_META, TABS, type VideoRatio } from "./shared";
import { VariantEmptyState } from "./VariantEmptyState";
import { VariantPreview } from "./VariantPreview";
import { VariantTab } from "./VariantTab";

interface AssetVariantTabsProps {
  assetId: string;
  /** Texte source à synthétiser (par défaut : asset content). */
  sourceText?: string;
  /** Tab à activer au mount. Permet à un caller (ex: stage_request avec
   * variantKind="image") de sélectionner directement le bon tab plutôt
   * que le default audio. */
  defaultKind?: AssetVariantKind;
}

// Pas d'onglet "Texte" : le contenu de l'asset EST le variant texte par
// essence (rendu directement par AssetStage / FocalStage). Les onglets
// listent uniquement les formats alternatifs générables à la demande.

export function AssetVariantTabs({ assetId, sourceText, defaultKind }: AssetVariantTabsProps) {
  const [activeTab, setActiveTab] = useState<AssetVariantKind>(defaultKind ?? "audio");
  const [generating, setGenerating] = useState<AssetVariantKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<"runway" | "heygen">("runway");
  // [S2-F] Ratio Runway
  const [videoRatio, setVideoRatio] = useState<VideoRatio>("1280:720");

  // [S2-B] Enrichissement automatique prompt vidéo
  const [enrichEnabled, setEnrichEnabled] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichmentPreview, setEnrichmentPreview] = useState<{
    original: string;
    enriched: string;
    diff: string[];
  } | null>(null);
  const [manualPrompt, setManualPrompt] = useState<string>("");
  const [editingManually, setEditingManually] = useState(false);

  // [S2-C] Variant fork (modifier un variant ready)
  const [forkPanel, setForkPanel] = useState<ForkPanelState | null>(null);

  // Polling + watchdog timeout + notifs desktop + sync stage-data.
  const {
    variants,
    timedOutKinds,
    refetch: fetchVariants,
    markGenerationStart,
    clearTimeout: clearKindTimeout,
  } = useVariantPolling(assetId);

  const variantFor = useCallback(
    (kind: AssetVariantKind) => variants.find((v) => v.kind === kind),
    [variants],
  );

  /** [S2-B] Appelle l'API d'enrichissement et retourne le résultat. */
  const fetchEnrichment = useCallback(
    async (rawPrompt: string): Promise<{ enriched: string; diff: string[] } | null> => {
      try {
        const res = await fetch("/api/v2/assets/enrich-video-prompt", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: rawPrompt }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data.enriched !== "string") return null;
        return {
          enriched: data.enriched,
          diff: Array.isArray(data.diff) ? (data.diff as string[]) : [],
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const requestVariant = useCallback(
    async (
      kind: AssetVariantKind,
      overrides?: {
        prompt?: string;
        derivedFrom?: string[];
        ratio?: VideoRatio;
        duration?: number;
      },
    ) => {
      setGenerating(kind);
      setError(null);
      // [WF5] Enregistrer le début local dès le POST
      markGenerationStart(kind);
      // [WF5] Réinitialiser un éventuel timeout précédent
      clearKindTimeout(kind);
      try {
        const requestBody: Record<string, unknown> = { kind };
        if (kind === "video") {
          const promptToUse = overrides?.prompt ?? sourceText;
          requestBody.provider = videoProvider;
          requestBody.scriptText = promptToUse;
          requestBody.prompt = promptToUse;
          // [S2-F] Ratio Runway
          if (videoProvider === "runway") {
            requestBody.ratio = overrides?.ratio ?? videoRatio;
          }
          if (overrides?.duration) requestBody.duration = overrides.duration;
        } else {
          requestBody.text = overrides?.prompt ?? sourceText;
        }
        // [S2-C] Lineage fork
        if (overrides?.derivedFrom && overrides.derivedFrom.length > 0) {
          requestBody.derivedFrom = overrides.derivedFrom;
        }
        const res = await fetch(`/api/v2/assets/${encodeURIComponent(assetId)}/variants`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || data.error || "Échec de la génération");
          return;
        }
        await fetchVariants();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur réseau");
      } finally {
        setGenerating(null);
      }
    },
    [
      assetId,
      sourceText,
      fetchVariants,
      videoProvider,
      videoRatio,
      markGenerationStart,
      clearKindTimeout,
    ],
  );

  /** [WF3] Relancer la génération d'un variant failed. */
  const retryVariant = useCallback(
    (kind: AssetVariantKind) => {
      void requestVariant(kind);
    },
    [requestVariant],
  );

  /** [S2-B] Pipeline génération vidéo Runway avec enrichissement optionnel. */
  const handleVideoGenerate = useCallback(async () => {
    setError(null);
    // Pas d'enrichissement → flow direct.
    if (!enrichEnabled || videoProvider !== "runway") {
      void requestVariant("video");
      return;
    }
    const raw = (sourceText ?? "").trim();
    if (raw.length === 0) {
      void requestVariant("video");
      return;
    }
    setEnrichLoading(true);
    const result = await fetchEnrichment(raw);
    setEnrichLoading(false);
    if (!result) {
      // Enrichissement KO → on continue avec le prompt brut, on ne bloque pas.
      void requestVariant("video");
      return;
    }
    setEnrichmentPreview({
      original: raw,
      enriched: result.enriched,
      diff: result.diff,
    });
  }, [enrichEnabled, videoProvider, sourceText, fetchEnrichment, requestVariant]);

  /** [S2-C] Ouvrir le panel Modifier sur un variant ready. */
  const openForkPanel = useCallback(
    (variant: AssetVariant) => {
      const meta = (variant.metadata ?? {}) as {
        prompt?: unknown;
        ratio?: unknown;
        duration?: unknown;
      };
      const prevPrompt = typeof meta.prompt === "string" ? meta.prompt : (sourceText ?? "");
      const prevRatio: VideoRatio = meta.ratio === "720:1280" ? "720:1280" : "1280:720";
      const prevDuration = typeof meta.duration === "number" ? meta.duration : 5;
      setForkPanel({
        parentId: variant.id,
        parentKind: variant.kind,
        prompt: prevPrompt,
        duration: prevDuration,
        ratio: prevRatio,
      });
    },
    [sourceText],
  );

  /** [S2-C] Régénérer un variant via fork. */
  const submitFork = useCallback(async () => {
    if (!forkPanel) return;
    const overrides: {
      prompt: string;
      derivedFrom: string[];
      ratio?: VideoRatio;
      duration?: number;
    } = {
      prompt: forkPanel.prompt,
      derivedFrom: [forkPanel.parentId],
    };
    if (forkPanel.parentKind === "video") {
      overrides.ratio = forkPanel.ratio;
      overrides.duration = forkPanel.duration;
    }
    setForkPanel(null);
    void requestVariant(forkPanel.parentKind, overrides);
  }, [forkPanel, requestVariant]);

  // ── Rendu ──────────────────────────────────────────────────────

  const variant = variantFor(activeTab);
  const isTimedOut = timedOutKinds.has(activeTab);
  // [WF5] Variant en timeout → afficher comme failed.
  const effectiveVariant: AssetVariant | undefined =
    isTimedOut && variant
      ? {
          ...variant,
          status: "failed" as const,
          error: "Timeout : génération dépassant 10 minutes",
        }
      : variant;

  const meta = TAB_META[activeTab];

  return (
    <div className="border-t border-(--surface-2) pt-8">
      <header className="flex items-baseline justify-between mb-6">
        <span className="t-13 font-medium text-(--text-l1)">Formats alternatifs</span>
        <div className="flex items-center gap-2">
          {TABS.map((tab) => (
            <VariantTab
              key={tab.kind}
              kind={tab.kind}
              label={tab.label}
              isActive={activeTab === tab.kind}
              variant={variants.find((v) => v.kind === tab.kind)}
              isTimedOut={timedOutKinds.has(tab.kind)}
              onSelect={setActiveTab}
            />
          ))}
        </div>
      </header>

      {effectiveVariant ? (
        <>
          <div>
            <VariantPreview
              variant={effectiveVariant}
              kind={activeTab}
              generating={generating === activeTab}
              onRetry={retryVariant}
              onModify={openForkPanel}
            />
          </div>
          {forkPanel && forkPanel.parentKind === activeTab && (
            <ForkPanel
              state={forkPanel}
              setState={setForkPanel}
              onSubmit={submitFork}
              generating={generating === activeTab}
            />
          )}
        </>
      ) : meta ? (
        <>
          <VariantEmptyState
            kind={activeTab}
            meta={meta}
            generating={generating === activeTab}
            enrichLoading={enrichLoading}
            error={error}
            videoProvider={videoProvider}
            setVideoProvider={setVideoProvider}
            videoRatio={videoRatio}
            setVideoRatio={setVideoRatio}
            enrichEnabled={enrichEnabled}
            setEnrichEnabled={setEnrichEnabled}
            onGenerate={
              activeTab === "video"
                ? () => void handleVideoGenerate()
                : () => void requestVariant(activeTab)
            }
          />
          {/* [S2-B] Modal enrichment preview */}
          {enrichmentPreview && (
            <EnrichmentPreviewModal
              preview={enrichmentPreview}
              editingManually={editingManually}
              manualPrompt={manualPrompt}
              setManualPrompt={setManualPrompt}
              setEditingManually={setEditingManually}
              onUseEnriched={() => {
                const enriched = enrichmentPreview.enriched;
                setEnrichmentPreview(null);
                setEditingManually(false);
                void requestVariant("video", { prompt: enriched });
              }}
              onKeepOriginal={() => {
                const original = enrichmentPreview.original;
                setEnrichmentPreview(null);
                setEditingManually(false);
                void requestVariant("video", { prompt: original });
              }}
              onUseManual={() => {
                const final = manualPrompt.trim();
                if (final.length === 0) return;
                setEnrichmentPreview(null);
                setEditingManually(false);
                void requestVariant("video", { prompt: final });
              }}
              onCancel={() => {
                setEnrichmentPreview(null);
                setEditingManually(false);
              }}
            />
          )}
          {/* [S2-C] Fork panel sur empty state (rare — mais possible si variant supprimé entre temps) */}
          {forkPanel && forkPanel.parentKind === activeTab && (
            <ForkPanel
              state={forkPanel}
              setState={setForkPanel}
              onSubmit={submitFork}
              generating={generating === activeTab}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
