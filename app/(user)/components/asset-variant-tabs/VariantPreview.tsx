"use client";

/**
 * VariantPreview — Rendu d'un variant existant (audio/video/image/code)
 * accompagné des actions disponibles (Réessayer / Modifier).
 *
 * Le renderer choisit le bon player selon le `kind` du variant. Si le
 * kind n'est pas supporté (text/slides/site), retourne null.
 */

import { AudioPlayer } from "../AudioPlayer";
import { VideoPlayer } from "../VideoPlayer";
import { ImageViewer } from "../ImageViewer";
import { CodeRunner } from "../CodeRunner";
import type { AssetVariant, AssetVariantKind } from "@/lib/assets/variants";
import { VariantActions } from "./VariantActions";

export interface VariantPreviewProps {
  variant: AssetVariant;
  kind: AssetVariantKind;
  generating: boolean;
  onRetry: (kind: AssetVariantKind) => void;
  onModify: (variant: AssetVariant) => void;
}

export function VariantPreview({
  variant,
  kind,
  generating,
  onRetry,
  onModify,
}: VariantPreviewProps) {
  const player =
    kind === "audio" ? (
      <AudioPlayer variant={variant} />
    ) : kind === "video" ? (
      <VideoPlayer variant={variant} />
    ) : kind === "image" ? (
      <ImageViewer variant={variant} />
    ) : kind === "code" ? (
      <CodeRunner variant={variant} />
    ) : null;

  if (!player) return null;

  return (
    <div className="flex flex-col gap-3">
      {player}
      <VariantActions
        variant={variant}
        kind={kind}
        generating={generating}
        onRetry={onRetry}
        onModify={onModify}
      />
    </div>
  );
}
