"use client";

import type { AssetDragPayload } from "../use-asset-drag";

interface AttachedAssetChipsProps {
  attachedAssets: AssetDragPayload[];
  onRemove: (assetId: string) => void;
}

/**
 * Chips assets actuellement attachés au composer.
 * Affichés au-dessus du textarea. Click sur "×" retire l'asset.
 * Le contenu n'est jamais inliné — invariant I-17, on passe par référence.
 */
export function AttachedAssetChips({ attachedAssets, onRemove }: AttachedAssetChipsProps) {
  if (attachedAssets.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center"
      style={{
        gap: "var(--space-2)",
        marginBottom: "var(--space-3)",
        paddingBottom: "var(--space-3)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {attachedAssets.map((a) => (
        <span
          key={a.assetId}
          data-testid={`chat-input-attached-asset-${a.assetId}`}
          className="flex items-center"
          style={{
            gap: "var(--space-2)",
            padding: "var(--space-1) var(--space-3)",
            background: "var(--accent-teal-surface)",
            border: "1px solid var(--accent-teal)",
            borderRadius: "var(--radius-pill)",
          }}
        >
          <span className="t-11 font-medium text-(--accent-teal)">@{a.kind}</span>
          <span
            className="t-11 font-light text-text truncate"
            style={{ maxWidth: "var(--space-32)" }}
          >
            {a.title}
          </span>
          <button
            type="button"
            onClick={() => onRemove(a.assetId)}
            aria-label={`Retirer ${a.title}`}
            className="t-11 text-text-ghost hover:text-(--danger)"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
