"use client";

/**
 * AssetStage — Surface plein écran d'un asset persisté.
 *
 * Refonte 2026-04-29 : standalone, plus de délégation au composant
 * FocalStage embedded. Avant : AssetStage rendait son propre header +
 * mappait l'asset vers un FocalObject minimal + écrivait dans
 * useFocalStore + déléguait à <FocalStage /> qui re-fetchait l'asset
 * via useEffect. Triple rendu (header AssetStage + h1 FocalContent),
 * double fetch concurrent, contenu réel jamais affiché à cause du
 * mapping FocalObject incomplet (pas de body/summary/sections hydratés).
 *
 * Désormais : un fetch /api/v2/assets/[id], parse via les helpers
 * lib/assets/content-parser (ReportLayout JSON / HTML iframe / plain
 * text), rend directement. Pas de bridge useFocalStore.
 *
 * Refonte 2026-04-30 (Phase 4 — Lot 2) : nettoyage actions.
 *  - Re-run en primary, Exporter PDF + Partager en secondary, Supprimer
 *    en overflow danger. Plus de bouton "Éditer" au niveau Stage —
 *    l'édition vit dans <ReportLayout /> via spec/onSpecChange. Plus
 *    de stubs Duplicate/Versions.
 *  - Polling variants : tracke un imageStatus pour afficher un skeleton
 *    pendant la génération et un message d'erreur + bouton re-générer
 *    en cas d'échec.
 *  - Mode image-only : mini-header ajoute le titre tronqué à droite du
 *    bouton retour (avant : back seul, page anonyme).
 *
 * Refonte 2026-05-10 — split en sous-composants/hooks sous
 * `asset-stage/`. L'orchestrateur ne fait plus que câbler hooks +
 * sections. Aucun changement d'API publique.
 */

import { useEffect, useState } from "react";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { ConfirmModal } from "../../ConfirmModal";
import { useOfflineStatus } from "../../use-offline-status";
import { VariantCarousel } from "../../VariantCarousel";
import type { StageAction } from "../StageActionBar";
import { AssetBody } from "./AssetBody";
import { AssetHeroImage } from "./AssetHeroImage";
import { AssetMeta } from "./AssetMeta";
import { AssetStageHeader } from "./AssetStageHeader";
import { AssetStageToast } from "./AssetStageToast";
import { GenerationPromptBlock } from "./GenerationPromptBlock";
import { OfflineBanner } from "./OfflineBanner";
import { useAssetActions } from "./use-asset-actions";
import { useAssetFetch } from "./use-asset-fetch";
import { useImageVariantPoll } from "./use-image-variant-poll";

interface AssetStageProps {
  assetId: string;
  variantKind?: string;
}

export function AssetStage({ assetId, variantKind }: AssetStageProps) {
  const back = useStageStore((s) => s.back);
  const { isOnline } = useOfflineStatus();

  const { asset, loading, error } = useAssetFetch(assetId);
  const { primaryImageUrl, imageStatus } = useImageVariantPoll(assetId);

  const [promptExpanded, setPromptExpanded] = useState(false);

  const {
    actionMsg,
    confirmDelete,
    setConfirmDelete,
    deleting,
    promptCopied,
    handleRerun,
    handleExport,
    handleShare,
    handleDelete,
    handleCopyPrompt,
  } = useAssetActions({
    assetId,
    assetTitle: asset?.title,
    onAfterDelete: back,
  });

  // Sync vers stage-data pour ContextRailForAsset (titre + assetId).
  // Les variants sont écrits par AssetVariantTabs séparément — on lit la
  // valeur courante via getState() pour ne pas les écraser. Invariant
  // Stage I-9 : sous-Stage = source, stage-data = miroir.
  const setAssetSlice = useStageData((s) => s.setAsset);
  useEffect(() => {
    if (asset) {
      setAssetSlice({
        assetId,
        assetTitle: asset.title,
        assetSummary: asset.summary,
        assetCreatedAt: asset.createdAt,
        assetKind: asset.kind,
        variants: useStageData.getState().asset.variants,
      });
    }
  }, [asset, assetId, setAssetSlice]);

  const primary: StageAction = {
    id: "rerun",
    label: "Re-run",
    onClick: handleRerun,
    disabled: !asset || loading,
  };
  const secondary: StageAction[] = [
    { id: "export", label: "Exporter PDF", onClick: handleExport, disabled: !asset || loading },
    { id: "share", label: "Partager", onClick: handleShare, disabled: !asset || loading },
  ];
  const overflow: StageAction[] = [
    {
      id: "delete",
      label: "Supprimer",
      variant: "danger",
      onClick: () => setConfirmDelete(true),
    },
  ];

  // Image-only : asset placeholder (contentRef vide) + variant image ready.
  // Mode épuré : pas de header massif, pas de h1 redondant, pas de tabs.
  // Tous les détails (titre, prompt, date, dimensions, modèle, actions)
  // vivent dans le ContextRail droit. Le centre = juste l'image.
  const isImageOnly = !!primaryImageUrl && (!asset?.contentRef || asset.contentRef.length === 0);

  // Indique si on attend un variant image (skeleton à afficher dans le hero).
  const showImageSkeleton =
    imageStatus === "pending" &&
    !primaryImageUrl &&
    (!asset?.contentRef || asset.contentRef.length === 0);

  const showImageFailed =
    imageStatus === "failed" &&
    !primaryImageUrl &&
    (!asset?.contentRef || asset.contentRef.length === 0);

  const promptValue = asset?.provenance.metadata?.prompt as string | undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative" style={{ background: "var(--surface)" }}>
      {!isOnline && <OfflineBanner hasAsset={!!asset} />}

      <AssetStageHeader
        asset={asset}
        assetId={assetId}
        variantKind={variantKind}
        isImageOnly={isImageOnly}
        onBack={back}
        primary={primary}
        secondary={secondary}
        overflow={overflow}
      />

      <AssetStageToast message={actionMsg} />

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-12 py-12 min-h-full">
          {loading && (
            <div
              className="flex flex-col items-center justify-center py-24"
              style={{ rowGap: "var(--space-4)" }}
            >
              <span
                className="rounded-pill bg-(--accent-teal) animate-pulse"
                style={{ width: "var(--space-2)", height: "var(--space-2)" }}
                aria-hidden
              />
              <p className="t-11 font-light text-text-faint">{"Chargement de l'asset…"}</p>
            </div>
          )}

          {error && !loading && (
            <div className="border-l-2 border-(--danger) bg-(--danger)/5 px-4 py-3">
              <p className="t-11 font-medium text-(--danger)">Erreur · {error}</p>
            </div>
          )}

          {asset && !loading && (
            <>
              {/* Titre + meta : seulement pour les rapports texte. En mode
                  image-only, ces infos vivent dans le ContextRail droit. */}
              {!isImageOnly && (
                <>
                  <AssetMeta asset={asset} />
                  <GenerationPromptBlock
                    prompt={promptValue}
                    expanded={promptExpanded}
                    copied={promptCopied}
                    onToggleExpand={() => setPromptExpanded((v) => !v)}
                    onCopy={handleCopyPrompt}
                  />
                </>
              )}

              <AssetHeroImage
                primaryImageUrl={primaryImageUrl}
                showSkeleton={showImageSkeleton}
                showFailed={showImageFailed}
                title={asset.title}
                onRetry={handleRerun}
              />

              {/* Body texte : seulement si contentRef non vide. Les assets
                  image-only (placeholder vide) sautent ce bloc. */}
              {asset.contentRef && asset.contentRef.length > 0 ? (
                <AssetBody contentRef={asset.contentRef} title={asset.title} />
              ) : null}

              {/* Bloc prompt pour mode image-only : affiché sous l'image quand
                  le contenu est absent mais le prompt disponible. */}
              {isImageOnly && (
                <GenerationPromptBlock
                  prompt={promptValue}
                  expanded={promptExpanded}
                  copied={promptCopied}
                  onToggleExpand={() => setPromptExpanded((v) => !v)}
                  onCopy={handleCopyPrompt}
                />
              )}

              {/* VariantCarousel : carrousel visuel des variants alternatifs
                  (audio, vidéo, image, code). Remplace AssetVariantTabs (B4).
                  Affiché uniquement pour les assets texte/rapport — une image
                  pure générée par generate_image n'a pas de sens à proposer
                  "audio narration" ou "code". */}
              {asset.contentRef && asset.contentRef.length > 0 ? (
                <VariantCarousel
                  assetId={asset.id}
                  sourceText={asset.contentRef ?? asset.summary ?? asset.title}
                  defaultKind={
                    (variantKind === "audio" ||
                    variantKind === "video" ||
                    variantKind === "image" ||
                    variantKind === "code"
                      ? variantKind
                      : undefined) as "audio" | "video" | "image" | "code" | undefined
                  }
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cet asset ?"
        description={`L'asset « ${asset?.title ?? assetId.slice(0, 8)} » sera supprimé définitivement. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
