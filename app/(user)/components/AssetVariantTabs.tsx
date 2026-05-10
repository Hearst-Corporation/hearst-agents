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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "./AudioPlayer";
import { ImageViewer } from "./ImageViewer";
import { VideoPlayer } from "./VideoPlayer";
import { CodeRunner } from "./CodeRunner";
import { useStageData } from "@/stores/stage-data";
import { useStageStore } from "@/stores/stage";
import { useVariantReadyNotification } from "@/app/hooks/use-variant-ready-notification";
import { Action } from "./ui";
import type { AssetVariant, AssetVariantKind } from "@/lib/assets/variants";

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
//
// Refonte 2026-04-30 (Phase 4 — Lot 2) : on ne liste plus les onglets non
// implémentés (slides, site). Si non disponible, ne pas exposer dans l'UI.
const TABS: ReadonlyArray<{ kind: AssetVariantKind; label: string }> = [
  { kind: "audio",  label: "Audio"  },
  { kind: "video",  label: "Vidéo"  },
  { kind: "image",  label: "Image"  },
  { kind: "code",   label: "Code"   },
];

const POLL_INTERVAL_MS = 4_000;
/** [WF5] Au-delà de 10 minutes en generating → timeout local. */
const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

type VideoRatio = "1280:720" | "720:1280";

const VARIANT_LABELS: Record<AssetVariantKind, string> = {
  audio: "Audio",
  video: "Vidéo",
  image: "Image",
  code: "Code",
  text: "Texte",
  slides: "Slides",
  site: "Site",
};

export function AssetVariantTabs({ assetId, sourceText, defaultKind }: AssetVariantTabsProps) {
  const [activeTab, setActiveTab] = useState<AssetVariantKind>(defaultKind ?? "audio");
  const [variants, setVariants] = useState<AssetVariant[]>([]);
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
  const [forkPanel, setForkPanel] = useState<{
    parentId: string;
    parentKind: AssetVariantKind;
    prompt: string;
    duration: number;
    ratio: VideoRatio;
  } | null>(null);

  // [WF5] Timestamp de début de génération par kind
  const generationStartedAt = useRef<Partial<Record<AssetVariantKind, number>>>({});
  // [WF5] Variants en timeout local (failed côté UI uniquement)
  const [timedOutKinds, setTimedOutKinds] = useState<Set<AssetVariantKind>>(new Set());

  // [S2-D] Notifications desktop sur variant ready
  const { notify } = useVariantReadyNotification();
  const setStageMode = useStageStore((s) => s.setMode);
  // Map kind → status précédent. Permet de détecter la transition
  // pending|generating → ready et déclencher la notification une seule fois.
  const previousStatusByKind = useRef<Map<AssetVariantKind, AssetVariant["status"]>>(new Map());

  // Sync vers stage-data pour ContextRailForAsset (variants list).
  // currentAsset est lu via getState() pour ne pas re-déclencher l'effect
  // sur chaque changement d'autres champs (assetId/title) — sinon boucle.
  const setAssetSlice = useStageData((s) => s.setAsset);
  useEffect(() => {
    const currentAsset = useStageData.getState().asset;
    setAssetSlice({ ...currentAsset, variants });
  }, [variants, setAssetSlice]);

  const variantFor = (kind: AssetVariantKind) => variants.find((v) => v.kind === kind);

  const fetchVariants = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/assets/${encodeURIComponent(assetId)}/variants`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.variants)) setVariants(data.variants as AssetVariant[]);
    } catch {
      // Non-fatal — on retry au prochain poll.
    }
  }, [assetId]);

  // Initial fetch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchVariants est async : setVariants ne s'appelle qu'après await, pas synchrone
    void fetchVariants();
  }, [fetchVariants]);

  // Polling tant qu'un variant est en cours + [WF5] watchdog timeout
  useEffect(() => {
    const hasInProgress = variants.some(
      (v) => v.status === "pending" || v.status === "generating",
    );
    if (!hasInProgress) return;

    const timer = setInterval(() => {
      void fetchVariants();

      // [WF5] Vérifier les timeouts
      const now = Date.now();
      variants.forEach((v) => {
        if (v.status !== "generating" && v.status !== "pending") return;
        const startedAt = generationStartedAt.current[v.kind];
        if (!startedAt) return;
        if (now - startedAt > GENERATION_TIMEOUT_MS) {
          setTimedOutKinds((prev) => {
            if (prev.has(v.kind)) return prev;
            const next = new Set(prev);
            next.add(v.kind);
            return next;
          });
        }
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [variants, fetchVariants]);

  // [WF5] Enregistrer le timestamp de début quand un variant passe en generating
  useEffect(() => {
    variants.forEach((v) => {
      if (v.status === "generating" || v.status === "pending") {
        if (!generationStartedAt.current[v.kind]) {
          // Utiliser createdAt du variant si disponible, sinon maintenant
          generationStartedAt.current[v.kind] = v.createdAt ?? Date.now();
        }
      } else {
        // Variant sorti du generating → nettoyer le timestamp et le timeout
        if (generationStartedAt.current[v.kind]) {
          delete generationStartedAt.current[v.kind];
        }
        if (timedOutKinds.has(v.kind)) {
          setTimedOutKinds((prev) => {
            const next = new Set(prev);
            next.delete(v.kind);
            return next;
          });
        }
      }
    });
  }, [variants, timedOutKinds]);

  // [S2-D] Détection transition pending|generating → ready et trigger notif desktop.
  useEffect(() => {
    variants.forEach((v) => {
      const prev = previousStatusByKind.current.get(v.kind);
      const wasInProgress = prev === "pending" || prev === "generating";
      if (wasInProgress && v.status === "ready") {
        const label = VARIANT_LABELS[v.kind] ?? v.kind;
        notify({
          title: `${label} prêt${v.kind === "video" || v.kind === "image" ? "e" : ""}`,
          body: "Votre génération est disponible — cliquez pour ouvrir.",
          icon: "/hearst-logo.svg",
          tag: `variant-${v.id}`,
          onClick: () => {
            setStageMode({ mode: "asset", assetId, variantKind: v.kind });
          },
        });
      }
      previousStatusByKind.current.set(v.kind, v.status);
    });
  }, [variants, notify, assetId, setStageMode]);

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
      overrides?: { prompt?: string; derivedFrom?: string[]; ratio?: VideoRatio; duration?: number },
    ) => {
      setGenerating(kind);
      setError(null);
      // [WF5] Enregistrer le début local dès le POST
      generationStartedAt.current[kind] = Date.now();
      // [WF5] Réinitialiser un éventuel timeout précédent
      setTimedOutKinds((prev) => {
        if (!prev.has(kind)) return prev;
        const next = new Set(prev);
        next.delete(kind);
        return next;
      });
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
    [assetId, sourceText, fetchVariants, videoProvider, videoRatio],
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
    setEnrichmentPreview({ original: raw, enriched: result.enriched, diff: result.diff });
  }, [enrichEnabled, videoProvider, sourceText, fetchEnrichment, requestVariant]);

  /** [S2-C] Ouvrir le panel Modifier sur un variant ready. */
  const openForkPanel = useCallback((variant: AssetVariant) => {
    const meta = (variant.metadata ?? {}) as { prompt?: unknown; ratio?: unknown; duration?: unknown };
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
  }, [sourceText]);

  /** [S2-C] Régénérer un variant via fork. */
  const submitFork = useCallback(async () => {
    if (!forkPanel) return;
    const overrides: { prompt: string; derivedFrom: string[]; ratio?: VideoRatio; duration?: number } = {
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

  return (
    <div className="border-t border-[var(--surface-2)] pt-8">
      <header className="flex items-baseline justify-between mb-6">
        <span className="t-13 font-medium text-(--text-l1)">Formats alternatifs</span>
        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.kind;
            const variant = variants.find((v) => v.kind === tab.kind);
            const isTimedOut = timedOutKinds.has(tab.kind);
            const effectiveStatus = isTimedOut ? "failed" : variant?.status;
            const dotColor =
              effectiveStatus === "ready"
                ? "bg-(--accent-teal)"
                : effectiveStatus === "pending" || effectiveStatus === "generating"
                ? "bg-(--warn) animate-pulse"
                : effectiveStatus === "failed"
                ? "bg-(--danger)"
                : "bg-[var(--text-ghost)]";
            return (
              <button
                key={tab.kind}
                type="button"
                onClick={() => setActiveTab(tab.kind)}
                className={`px-3 py-1.5 t-11 font-light border transition-colors duration-base ${
                  isActive
                    ? "border-(--accent-teal) text-(--accent-teal)"
                    : "border-(--border-shell) text-text-muted hover:text-text"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`rounded-pill shrink-0 ${dotColor}`} style={{ width: "var(--space-1)", height: "var(--space-1)" }} />
                  <span>{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {(() => {
        const TAB_META: Record<string, { empty: string; cta: string; ctaLoading: string }> = {
          audio: {
            empty: "Pas encore de variant audio. Génère un fichier audio narré à partir du texte de cet asset (ElevenLabs TTS).",
            cta: "Générer l'audio",
            ctaLoading: "Création…",
          },
          video: {
            empty: "Pas encore de variant vidéo. Génère une vidéo animée à partir de cet asset (HeyGen / Runway).",
            cta: "Générer la vidéo",
            ctaLoading: "Création…",
          },
          image: {
            empty: "Pas encore d'image générée. Génère une illustration à partir du titre ou du contenu (fal.ai).",
            cta: "Générer l'image",
            ctaLoading: "Création…",
          },
          code: {
            empty: "Pas encore de résultat d'exécution. Lance le code associé à cet asset dans un sandbox sécurisé (E2B).",
            cta: "Exécuter le code",
            ctaLoading: "Exécution…",
          },
        };

        const meta = TAB_META[activeTab];
        const variant = variantFor(activeTab);
        const isTimedOut = timedOutKinds.has(activeTab);
        // [WF5] Variant en timeout → afficher comme failed
        const effectiveVariant = isTimedOut && variant
          ? { ...variant, status: "failed" as const, error: "Timeout : génération dépassant 10 minutes" }
          : variant;

        // [WF3] Bouton Réessayer si variant failed
        const isFailed = effectiveVariant?.status === "failed";
        const isReady = effectiveVariant?.status === "ready";

        const retryButton = isFailed ? (
          <button
            type="button"
            onClick={() => retryVariant(activeTab)}
            disabled={generating === activeTab}
            className="flex items-center gap-1.5 px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:border-(--danger) hover:text-(--danger) disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span aria-hidden>↺</span>
            <span>Réessayer</span>
          </button>
        ) : null;

        // [S2-C] Bouton Modifier sur variant ready (audio/video/image/code)
        const modifyButton = isReady && effectiveVariant ? (
          <button
            type="button"
            onClick={() => openForkPanel(effectiveVariant)}
            disabled={generating === activeTab}
            className="flex items-center gap-1.5 px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:border-(--accent-teal) hover:text-(--accent-teal) disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span aria-hidden>✎</span>
            <span>Modifier</span>
          </button>
        ) : null;

        const actionRow = (retryButton || modifyButton) ? (
          <div className="flex items-center gap-2">
            {retryButton}
            {modifyButton}
          </div>
        ) : null;

        const renderer = effectiveVariant ? (
          activeTab === "audio" ? (
            <div className="flex flex-col gap-3">
              <AudioPlayer variant={effectiveVariant} />
              {actionRow}
            </div>
          ) :
          activeTab === "video" ? (
            <div className="flex flex-col gap-3">
              <VideoPlayer variant={effectiveVariant} />
              {actionRow}
            </div>
          ) :
          activeTab === "image" ? (
            <div className="flex flex-col gap-3">
              <ImageViewer variant={effectiveVariant} />
              {actionRow}
            </div>
          ) :
          activeTab === "code"  ? (
            <div className="flex flex-col gap-3">
              <CodeRunner  variant={effectiveVariant} />
              {actionRow}
            </div>
          ) :
          null
        ) : null;

        if (renderer) {
          return (
            <>
              <div>{renderer}</div>
              {forkPanel && forkPanel.parentKind === activeTab && (
                <ForkPanel
                  state={forkPanel}
                  setState={setForkPanel}
                  onSubmit={submitFork}
                  generating={generating === activeTab}
                />
              )}
            </>
          );
        }
        if (!meta) return null;

        return (
          <div className="flex flex-col items-start gap-4">
            <p className="t-13 font-light text-text-muted">{meta.empty}</p>
            {activeTab === "video" && (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-2">
                  <span className="t-11 font-medium text-(--text-l1)">
                    Fournisseur
                  </span>
                  <select
                    value={videoProvider}
                    onChange={(e) => setVideoProvider(e.target.value === "heygen" ? "heygen" : "runway")}
                    disabled={generating === "video"}
                    className="px-3 py-2 t-13 font-light text-text bg-[var(--card-flat-bg)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="runway">Runway (text-to-video)</option>
                    <option value="heygen">HeyGen (avatar)</option>
                  </select>
                </label>
                {/* [S2-F] Toggle ratio Runway */}
                {videoProvider === "runway" && (
                  <div className="flex flex-col gap-2">
                    <span className="t-11 font-medium text-(--text-l1)">Format</span>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setVideoRatio("1280:720")}
                        disabled={generating === "video"}
                        className={`px-3 py-1.5 t-11 font-light border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          videoRatio === "1280:720"
                            ? "border-(--accent-teal) text-(--accent-teal)"
                            : "border-(--border-shell) text-text-muted hover:text-text"
                        }`}
                        style={
                          videoRatio === "1280:720"
                            ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                            : undefined
                        }
                      >
                        Paysage
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoRatio("720:1280")}
                        disabled={generating === "video"}
                        className={`px-3 py-1.5 t-11 font-light border-t border-b border-r transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          videoRatio === "720:1280"
                            ? "border-(--accent-teal) text-(--accent-teal)"
                            : "border-(--border-shell) text-text-muted hover:text-text"
                        }`}
                        style={
                          videoRatio === "720:1280"
                            ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                            : undefined
                        }
                      >
                        Portrait
                      </button>
                    </div>
                  </div>
                )}
                {/* [S2-B] Toggle enrichissement automatique (Runway uniquement) */}
                {videoProvider === "runway" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enrichEnabled}
                      onChange={(e) => setEnrichEnabled(e.target.checked)}
                      disabled={generating === "video" || enrichLoading}
                      className="accent-(--accent-teal)"
                    />
                    <span className="t-11 font-light text-text-muted">
                      Enrichir automatiquement le prompt (Claude Haiku → cinématographique)
                    </span>
                  </label>
                )}
              </div>
            )}
            <Action
              variant="primary"
              tone="brand"
              onClick={
                activeTab === "video"
                  ? () => void handleVideoGenerate()
                  : () => void requestVariant(activeTab)
              }
              loading={generating === activeTab || enrichLoading}
            >
              {enrichLoading ? "Enrichissement…" : meta.cta}
            </Action>
            {error && (
              <p className="t-13 font-light text-(--danger)">{error}</p>
            )}
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
          </div>
        );
      })()}
    </div>
  );
}

// ── [S2-B] Modal enrichment preview ────────────────────────────

interface EnrichmentPreviewModalProps {
  preview: { original: string; enriched: string; diff: string[] };
  editingManually: boolean;
  manualPrompt: string;
  setManualPrompt: (v: string) => void;
  setEditingManually: (v: boolean) => void;
  onUseEnriched: () => void;
  onKeepOriginal: () => void;
  onUseManual: () => void;
  onCancel: () => void;
}

function EnrichmentPreviewModal({
  preview,
  editingManually,
  manualPrompt,
  setManualPrompt,
  setEditingManually,
  onUseEnriched,
  onKeepOriginal,
  onUseManual,
  onCancel,
}: EnrichmentPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "var(--modal-backdrop)" }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col gap-6 max-w-2xl w-full mx-4 p-6 border border-(--border-shell)"
        style={{ backgroundColor: "var(--card-flat-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <span className="t-15 font-medium text-(--text-l1)">Prompt enrichi</span>
          <span className="t-11 font-light text-text-muted">
            Claude a réécrit votre prompt en direction cinématographique. Vérifiez avant génération.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-11 font-medium text-text-muted">Original</span>
          <p className="t-13 font-light text-text-muted whitespace-pre-wrap">{preview.original}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-11 font-medium text-(--accent-teal)">Enrichi</span>
          <p className="t-13 font-light text-text whitespace-pre-wrap">
            {renderEnrichedWithDiff(preview.enriched, preview.diff)}
          </p>
        </div>

        {editingManually && (
          <div className="flex flex-col gap-2">
            <span className="t-11 font-medium text-(--text-l1)">Modification manuelle</span>
            <textarea
              value={manualPrompt}
              onChange={(e) => setManualPrompt(e.target.value)}
              rows={4}
              className="px-3 py-2 t-13 font-light text-text bg-[var(--surface-1)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-(--accent-teal) outline-none transition-colors resize-y"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:text-text"
          >
            Annuler
          </button>
          {!editingManually ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setManualPrompt(preview.enriched);
                  setEditingManually(true);
                }}
                className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:text-text"
              >
                Modifier manuellement
              </button>
              <button
                type="button"
                onClick={onKeepOriginal}
                className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text transition-colors hover:border-(--accent-teal) hover:text-(--accent-teal)"
              >
                Garder l&apos;original
              </button>
              <button
                type="button"
                onClick={onUseEnriched}
                className="px-3 py-1.5 t-11 font-medium border border-(--accent-teal) text-(--accent-teal) transition-colors"
                style={{ backgroundColor: "var(--accent-teal-bg-hover)" }}
              >
                Utiliser l&apos;enrichi
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUseManual}
              disabled={manualPrompt.trim().length === 0}
              className="px-3 py-1.5 t-11 font-medium border border-(--accent-teal) text-(--accent-teal) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent-teal-bg-hover)" }}
            >
              Utiliser ma version
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Surligne les fragments du diff dans le texte enrichi pour l'UI. */
function renderEnrichedWithDiff(enriched: string, diff: string[]): React.ReactNode {
  if (diff.length === 0) return enriched;

  // Construction d'une regex qui capture tous les fragments du diff
  // (escape des chars spéciaux). On split en gardant les matchs, et on
  // surligne ceux qui correspondent à un fragment du diff.
  const escapedFragments = diff
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((f) => f.length > 0);
  if (escapedFragments.length === 0) return enriched;

  const pattern = new RegExp(`(${escapedFragments.join("|")})`, "gi");
  const parts = enriched.split(pattern);

  return parts.map((part, idx) => {
    const isMatch = diff.some((f) => f.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <span
          key={idx}
          className="text-(--accent-teal)"
          style={{ backgroundColor: "var(--accent-teal-bg-hover)", padding: "0 var(--space-1)" }}
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

// ── [S2-C] Fork Panel ────────────────────────────────────────

interface ForkPanelState {
  parentId: string;
  parentKind: AssetVariantKind;
  prompt: string;
  duration: number;
  ratio: VideoRatio;
}

interface ForkPanelProps {
  state: ForkPanelState;
  setState: (s: ForkPanelState | null) => void;
  onSubmit: () => void;
  generating: boolean;
}

function ForkPanel({ state, setState, onSubmit, generating }: ForkPanelProps) {
  const isVideo = state.parentKind === "video";
  return (
    <div
      className="mt-4 flex flex-col gap-4 p-4 border border-(--border-shell)"
      style={{ backgroundColor: "var(--card-flat-bg)" }}
    >
      <div className="flex items-baseline justify-between">
        <span className="t-13 font-medium text-(--text-l1)">Modifier ce variant</span>
        <span className="t-11 font-light text-text-muted">
          Lineage : nouveau variant dérivé de l&apos;original
        </span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="t-11 font-medium text-(--text-l1)">Prompt</span>
        <textarea
          value={state.prompt}
          onChange={(e) => setState({ ...state, prompt: e.target.value })}
          rows={4}
          disabled={generating}
          className="px-3 py-2 t-13 font-light text-text bg-[var(--surface-1)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-(--accent-teal) outline-none transition-colors resize-y disabled:opacity-50"
        />
      </label>

      {isVideo && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="t-11 font-medium text-(--text-l1)">
              Durée (secondes) : {state.duration}
            </span>
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              value={state.duration}
              onChange={(e) => setState({ ...state, duration: Number(e.target.value) })}
              disabled={generating}
              className="accent-(--accent-teal)"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="t-11 font-medium text-(--text-l1)">Format</span>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setState({ ...state, ratio: "1280:720" })}
                disabled={generating}
                className={`px-3 py-1.5 t-11 font-light border transition-colors disabled:opacity-50 ${
                  state.ratio === "1280:720"
                    ? "border-(--accent-teal) text-(--accent-teal)"
                    : "border-(--border-shell) text-text-muted hover:text-text"
                }`}
                style={
                  state.ratio === "1280:720"
                    ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                    : undefined
                }
              >
                Paysage
              </button>
              <button
                type="button"
                onClick={() => setState({ ...state, ratio: "720:1280" })}
                disabled={generating}
                className={`px-3 py-1.5 t-11 font-light border-t border-b border-r transition-colors disabled:opacity-50 ${
                  state.ratio === "720:1280"
                    ? "border-(--accent-teal) text-(--accent-teal)"
                    : "border-(--border-shell) text-text-muted hover:text-text"
                }`}
                style={
                  state.ratio === "720:1280"
                    ? { backgroundColor: "var(--accent-teal-bg-hover)" }
                    : undefined
                }
              >
                Portrait
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setState(null)}
          disabled={generating}
          className="px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={generating || state.prompt.trim().length === 0}
          className="px-3 py-1.5 t-11 font-medium border border-(--accent-teal) text-(--accent-teal) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--accent-teal-bg-hover)" }}
        >
          {generating ? "Régénération…" : "Régénérer avec ces modifications"}
        </button>
      </div>
    </div>
  );
}
