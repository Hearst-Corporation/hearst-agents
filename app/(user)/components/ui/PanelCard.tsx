"use client";

import type { ReactNode } from "react";

interface PanelCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "md" | "lg";
}

/** Carte surface standard — remplace bg-white/5 border-white/8. */
export function PanelCard({
  children,
  className = "",
  hover = false,
  padding = "md",
}: PanelCardProps) {
  const pad = padding === "lg" ? "var(--space-6)" : "var(--space-5)";
  return (
    <div
      className={`rounded-xl border border-(--border-shell) bg-(--surface-1) ${hover ? "hover:border-(--line-strong) transition-colors" : ""} ${className}`}
      style={{ padding: pad }}
    >
      {children}
    </div>
  );
}
