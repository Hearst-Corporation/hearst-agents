"use client";

/**
 * VariantActions — Boutons d'actions sur un variant existant.
 *
 *  - Réessayer : si statut = `failed` ([WF3])
 *  - Modifier  : si statut = `ready`  ([S2-C], ouvre ForkPanel)
 *
 * Rendue null si aucune action n'est applicable (statut en cours).
 */

import type { AssetVariant, AssetVariantKind } from "@/lib/assets/variants";

export interface VariantActionsProps {
  variant: AssetVariant;
  kind: AssetVariantKind;
  generating: boolean;
  onRetry: (kind: AssetVariantKind) => void;
  onModify: (variant: AssetVariant) => void;
}

export function VariantActions({
  variant,
  kind,
  generating,
  onRetry,
  onModify,
}: VariantActionsProps) {
  const isFailed = variant.status === "failed";
  const isReady = variant.status === "ready";

  const retryButton = isFailed ? (
    <button
      type="button"
      onClick={() => onRetry(kind)}
      disabled={generating}
      className="flex items-center gap-1.5 px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:border-(--danger) hover:text-(--danger) disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span aria-hidden>↺</span>
      <span>Réessayer</span>
    </button>
  ) : null;

  const modifyButton = isReady ? (
    <button
      type="button"
      onClick={() => onModify(variant)}
      disabled={generating}
      className="flex items-center gap-1.5 px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-muted transition-colors hover:border-(--accent-teal) hover:text-(--accent-teal) disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span aria-hidden>✎</span>
      <span>Modifier</span>
    </button>
  ) : null;

  if (!retryButton && !modifyButton) return null;

  return (
    <div className="flex items-center gap-2">
      {retryButton}
      {modifyButton}
    </div>
  );
}
