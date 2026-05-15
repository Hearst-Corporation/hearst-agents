"use client";

interface AssetStageToastProps {
  message: string | null;
}

/**
 * Toast éphémère du Stage asset (success/error des actions).
 *
 * Se positionne en haut à droite, sous la StageActionBar, sans casser
 * le scroll. Auto-dismiss géré côté hook `useAssetActions` (3s).
 */
export function AssetStageToast({ message }: AssetStageToastProps) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="asset-stage-toast"
      className="flex items-center"
      style={{
        position: "absolute",
        top: "calc(var(--space-16) + var(--space-2))",
        right: "var(--space-12)",
        zIndex: "var(--z-base)" as unknown as number,
        padding: "var(--space-2) var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--accent-teal)",
        borderRadius: "var(--radius-xs)",
        color: "var(--accent-teal)",
        gap: "var(--space-2)",
      }}
    >
      <span className="t-11 font-light">{message}</span>
    </div>
  );
}
