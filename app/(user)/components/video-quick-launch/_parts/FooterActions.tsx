"use client";

import { Action } from "../../ui";
import type { SinglePhase, BatchPhase } from "../types";

interface FooterActionsProps {
  batchMode: boolean;
  // Single mode
  singlePhase: SinglePhase;
  createdAssetId: string | null;
  isSingleBusy: boolean;
  promptEmpty: boolean;
  onSubmitSingle: () => void;
  onOpenAsset: () => void;
  onResetSingle: () => void;
  // Batch mode
  batchPhase: BatchPhase;
  validBatchCount: number;
  isBatchBusy: boolean;
  onSubmitBatch: () => void;
  onOpenCompare: () => void;
  onResetBatch: () => void;
  onClose: () => void;
}

export function FooterActions({
  batchMode,
  singlePhase,
  createdAssetId,
  isSingleBusy,
  promptEmpty,
  onSubmitSingle,
  onOpenAsset,
  onResetSingle,
  batchPhase,
  validBatchCount,
  isBatchBusy,
  onSubmitBatch,
  onOpenCompare,
  onResetBatch,
  onClose,
}: FooterActionsProps) {
  if (!batchMode) {
    if (singlePhase === "done" && createdAssetId) {
      return (
        <>
          <Action variant="ghost" tone="neutral" onClick={onClose}>
            Fermer
          </Action>
          <Action variant="primary" tone="brand" onClick={onOpenAsset}>
            Ouvrir
          </Action>
        </>
      );
    }
    if (singlePhase === "error") {
      return (
        <>
          <Action variant="ghost" tone="neutral" onClick={onClose}>
            Fermer
          </Action>
          <Action variant="primary" tone="brand" onClick={onResetSingle}>
            Réessayer
          </Action>
        </>
      );
    }
    return (
      <Action
        variant="primary"
        tone="brand"
        onClick={onSubmitSingle}
        loading={isSingleBusy}
        disabled={promptEmpty}
      >
        Générer la vidéo
      </Action>
    );
  }

  // Batch mode
  if (batchPhase === "done") {
    return (
      <>
        <Action variant="ghost" tone="neutral" onClick={onClose}>
          Fermer
        </Action>
        <Action variant="primary" tone="brand" onClick={onOpenCompare}>
          Comparer les résultats
        </Action>
      </>
    );
  }
  if (batchPhase === "error") {
    return (
      <>
        <Action variant="ghost" tone="neutral" onClick={onClose}>
          Fermer
        </Action>
        <Action variant="primary" tone="brand" onClick={onResetBatch}>
          Réessayer
        </Action>
      </>
    );
  }
  return (
    <Action
      variant="primary"
      tone="brand"
      onClick={onSubmitBatch}
      loading={isBatchBusy}
      disabled={validBatchCount === 0}
    >
      {`Lancer le batch (${validBatchCount})`}
    </Action>
  );
}
