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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "./AudioPlayer";
import { ImageViewer } from "./ImageViewer";
import { VideoPlayer } from "./VideoPlayer";
import { CodeRunner } from "./CodeRunner";
import { useStageData } from "@/stores/stage-data";
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

export function AssetVariantTabs({ assetId, sourceText, defaultKind }: AssetVariantTabsProps) {
  const [activeTab, setActiveTab] = useState<AssetVariantKind>(defaultKind ?? "audio");
  const [variants, setVariants] = useState<AssetVariant[]>([]);
  const [generating, setGenerating] = useState<AssetVariantKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<"runway" | "heygen">("runway");
  // [S2-F] Ratio Runway
  const [videoRatio, setVideoRatio] = useState<VideoRatio>("1280:720");

  // [WF5] Timestamp de début de génération par kind
  const generationStartedAt = useRef<Partial<Record<AssetVariantKind, number>>>({});
  // [WF5] Variants en timeout local (failed côté UI uniquement)
  const [timedOutKinds, setTimedOutKinds] = useState<Set<AssetVariantKind>>(new Set());

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

  const requestVariant = useCallback(
    async (kind: AssetVariantKind) => {
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
          requestBody.provider = videoProvider;
          requestBody.scriptText = sourceText;
          requestBody.prompt = sourceText;
          // [S2-F] Ratio Runway
          if (videoProvider === "runway") {
            requestBody.ratio = videoRatio;
          }
        } else {
          requestBody.text = sourceText;
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

        const renderer = effectiveVariant ? (
          activeTab === "audio" ? <AudioPlayer variant={effectiveVariant} /> :
          activeTab === "video" ? (
            <div className="flex flex-col gap-3">
              <VideoPlayer variant={effectiveVariant} />
              {retryButton}
            </div>
          ) :
          activeTab === "image" ? (
            <div className="flex flex-col gap-3">
              <ImageViewer variant={effectiveVariant} />
              {retryButton}
            </div>
          ) :
          activeTab === "code"  ? (
            <div className="flex flex-col gap-3">
              <CodeRunner  variant={effectiveVariant} />
              {retryButton}
            </div>
          ) :
          null
        ) : null;

        // [WF3] Pour audio, injecter le retry en dessous du player
        const audioRenderer = effectiveVariant && activeTab === "audio" ? (
          <div className="flex flex-col gap-3">
            <AudioPlayer variant={effectiveVariant} />
            {retryButton}
          </div>
        ) : null;

        const finalRenderer = activeTab === "audio" ? audioRenderer : renderer;

        if (finalRenderer) return <div>{finalRenderer}</div>;
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
              </div>
            )}
            <Action
              variant="primary"
              tone="brand"
              onClick={() => void requestVariant(activeTab)}
              loading={generating === activeTab}
            >
              {meta.cta}
            </Action>
            {error && (
              <p className="t-13 font-light text-(--danger)">{error}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
