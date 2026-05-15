"use client";

/**
 * VariantTab — Un bouton-onglet du header (Audio / Vidéo / Image / Code).
 *
 * Affiche un dot statut (ready / en cours / échec / inconnu) et applique
 * le style actif via la teinte teal. Pas de halo-on-hover sur le chrome.
 */

import type { AssetVariant, AssetVariantKind } from "@/lib/assets/variants";

export interface VariantTabProps {
  kind: AssetVariantKind;
  label: string;
  isActive: boolean;
  variant: AssetVariant | undefined;
  isTimedOut: boolean;
  onSelect: (kind: AssetVariantKind) => void;
}

export function VariantTab({
  kind,
  label,
  isActive,
  variant,
  isTimedOut,
  onSelect,
}: VariantTabProps) {
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
      type="button"
      onClick={() => onSelect(kind)}
      className={`px-3 py-1.5 t-11 font-light border transition-colors duration-base ${
        isActive
          ? "border-(--accent-teal) text-(--accent-teal)"
          : "border-(--border-shell) text-text-muted hover:text-text"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`rounded-pill shrink-0 ${dotColor}`}
          style={{ width: "var(--space-1)", height: "var(--space-1)" }}
        />
        <span>{label}</span>
      </span>
    </button>
  );
}
