"use client";

/**
 * FormField — champs formulaire unifiés (input, textarea).
 * Tokens DS uniquement ; remplace les copies dans alerting, video-quick-launch, assets.
 */

import type { ComponentProps } from "react";

type FieldSurface = "surface" | "card-flat";

const FIELD_BASE =
  "w-full t-13 font-light text-text border border-(--border-shell) hover:border-(--accent-teal-border-hover) focus:border-(--accent-teal-border-hover) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover) transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-(--radius-sm) px-(--space-3) py-(--space-2)";

function surfaceBg(surface: FieldSurface): string {
  return surface === "card-flat" ? "bg-(--card-flat-bg)" : "bg-(--surface-1)";
}

export function FormInput({
  className = "",
  surface = "surface",
  ...props
}: ComponentProps<"input"> & { surface?: FieldSurface }) {
  return <input className={`${FIELD_BASE} ${surfaceBg(surface)} ${className}`} {...props} />;
}

export function FormTextarea({
  className = "",
  surface = "surface",
  ...props
}: ComponentProps<"textarea"> & { surface?: FieldSurface }) {
  return (
    <textarea
      className={`${FIELD_BASE} ${surfaceBg(surface)} resize-none ${className}`}
      {...props}
    />
  );
}
