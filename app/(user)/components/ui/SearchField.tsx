"use client";

import type { ComponentProps } from "react";

/** Champ recherche / texte — tokens input du DS. */
export function SearchField({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-xl border border-(--border-input) bg-(--surface-1) t-13 font-light text-text placeholder:text-text-ghost outline-none focus:border-(--accent-teal-border) transition-colors ${className}`}
      style={{ padding: "var(--space-3) var(--space-4)" }}
      {...props}
    />
  );
}
