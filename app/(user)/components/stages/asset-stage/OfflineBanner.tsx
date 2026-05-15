"use client";

interface OfflineBannerProps {
  hasAsset: boolean;
}

/**
 * Bannière hors ligne du Stage asset.
 *
 * Affiche un message contextuel selon qu'un asset est déjà chargé en
 * cache (mode lecture cache) ou non (impossible d'afficher sans réseau).
 */
export function OfflineBanner({ hasAsset }: OfflineBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="asset-offline-banner"
      className="flex items-center justify-center"
      style={{
        padding: "var(--space-2) var(--space-4)",
        background: "var(--accent-teal-surface)",
        borderBottom: "1px solid var(--accent-teal-border)",
        gap: "var(--space-2)",
      }}
    >
      <span
        className="rounded-pill"
        style={{
          width: "var(--space-1)",
          height: "var(--space-1)",
          background: "var(--accent-teal)",
        }}
      />
      <span className="t-11 font-medium text-(--accent-teal)">
        {hasAsset
          ? "Mode hors ligne — affichage cache"
          : "Hors ligne — connecte-toi pour voir cet asset"}
      </span>
    </div>
  );
}
