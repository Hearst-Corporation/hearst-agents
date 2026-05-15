"use client";

import type { Asset } from "@/lib/assets/types";
import { type StageAction, StageActionBar } from "../StageActionBar";

interface AssetStageHeaderProps {
  asset: Asset | null;
  assetId: string;
  variantKind?: string;
  isImageOnly: boolean;
  onBack: () => void;
  primary: StageAction;
  secondary: StageAction[];
  overflow: StageAction[];
}

/**
 * AssetStageHeader — Sélectionne le bandeau supérieur du Stage.
 *
 * Deux modes :
 *  - image-only : mini-header (back + titre tronqué). Les actions vivent
 *    dans le ContextRail droit pour un Stage plus calme.
 *  - défaut     : <StageActionBar /> avec context (asset / id / kind /
 *    variantKind), primary, secondary et overflow.
 */
export function AssetStageHeader({
  asset,
  assetId,
  variantKind,
  isImageOnly,
  onBack,
  primary,
  secondary,
  overflow,
}: AssetStageHeaderProps) {
  if (isImageOnly) {
    return (
      <div
        className="flex items-center"
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderBottom: "1px solid var(--border-shell)",
          gap: "var(--space-4)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="t-11 font-light text-text-faint hover:text-(--accent-teal) transition-colors shrink-0"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          aria-label="Retour"
        >
          ← Retour <span className="t-9 font-mono tabular-nums opacity-60">⌘⌫</span>
        </button>
        {asset?.title && (
          <span className="t-11 font-light text-text-muted truncate" title={asset.title}>
            {asset.title}
          </span>
        )}
      </div>
    );
  }

  return (
    <StageActionBar
      context={
        <>
          <span className="t-11 font-light text-text-faint">Asset</span>
          <span
            className="rounded-pill bg-[var(--text-ghost)]"
            style={{ width: "var(--space-1)", height: "var(--space-1)" }}
          />
          <span className="t-11 font-light text-text-muted">{assetId.slice(0, 8)}</span>
          {asset && (
            <>
              <span
                className="rounded-pill bg-[var(--text-ghost)]"
                style={{ width: "var(--space-1)", height: "var(--space-1)" }}
              />
              <span className="t-11 font-medium text-(--accent-teal)">{asset.kind}</span>
            </>
          )}
          {variantKind && (
            <>
              <span
                className="rounded-pill bg-[var(--text-ghost)]"
                style={{ width: "var(--space-1)", height: "var(--space-1)" }}
              />
              <span className="t-11 font-medium text-(--accent-teal)">{variantKind}</span>
            </>
          )}
        </>
      }
      primary={primary}
      secondary={secondary}
      overflow={overflow}
      onBack={onBack}
    />
  );
}
