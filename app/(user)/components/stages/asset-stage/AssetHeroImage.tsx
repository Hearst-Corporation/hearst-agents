"use client";

import { Action } from "../../ui";

interface AssetHeroImageProps {
  primaryImageUrl: string | null;
  showSkeleton: boolean;
  showFailed: boolean;
  title: string;
  onRetry: () => void;
}

/**
 * AssetHeroImage — Hero image du Stage asset.
 *
 * Trois états mutuellement exclusifs :
 *  - URL ready → <a target="_blank"> ouvrant l'original plein écran
 *  - skeleton  → placeholder pulse pendant la génération
 *  - failed    → carte d'erreur + bouton "Re-générer"
 *  - sinon     → null (asset texte pur, ou pas de variant image)
 */
export function AssetHeroImage({
  primaryImageUrl,
  showSkeleton,
  showFailed,
  title,
  onRetry,
}: AssetHeroImageProps) {
  if (primaryImageUrl) {
    return (
      <a
        href={primaryImageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full mb-10"
        style={{
          border: "1px solid var(--border-shell)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          background: "var(--surface-1)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- image storage URL dynamique, pas optimizable */}
        <img
          src={primaryImageUrl}
          alt={title}
          className="w-full h-auto block"
        />
      </a>
    );
  }

  if (showSkeleton) {
    return (
      <div
        data-testid="asset-image-skeleton"
        className="block w-full mb-10 aspect-square animate-pulse"
        style={{
          border: "1px solid var(--border-shell)",
          borderRadius: "var(--radius-md)",
          background:
            "linear-gradient(135deg, var(--surface-1), var(--accent-teal-soft, var(--surface-2)))",
        }}
        aria-label="Génération de l'image en cours"
      />
    );
  }

  if (showFailed) {
    return (
      <div
        data-testid="asset-image-failed"
        className="flex flex-col items-start mb-10"
        style={{
          gap: "var(--space-4)",
          padding: "var(--space-6)",
          border: "1px solid var(--danger)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-1)",
        }}
      >
        <p className="t-11 font-medium text-(--danger)">
          Échec de la génération d&apos;image
        </p>
        <p className="t-13 font-light text-text-muted">
          La génération a échoué. Tu peux relancer une nouvelle tentative.
        </p>
        <Action variant="primary" tone="brand" size="sm" onClick={onRetry}>
          Re-générer
        </Action>
      </div>
    );
  }

  return null;
}
