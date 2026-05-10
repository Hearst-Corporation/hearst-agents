"use client";

import type { ReactNode } from "react";

export type BadgeTone = "brand" | "gold" | "warn" | "danger" | "success" | "neutral";
export type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Pill = arrondi complet (défaut). Square = radius-xs pour labels techniques. */
  shape?: "pill" | "square";
  className?: string;
}

const toneStyles: Record<BadgeTone, string> = {
  brand:   "bg-(--accent-teal-bg-active) text-(--accent-teal) border border-(--accent-teal)/30",
  gold:    "bg-(--gold-surface) text-(--gold) border border-(--gold-border)",
  warn:    "bg-(--warn-surface) text-(--warn) border border-(--warn)/30",
  danger:  "bg-(--danger-surface) text-(--danger) border border-(--danger)/30",
  success: "bg-(--color-success-bg) text-(--color-success) border border-(--color-success-border)",
  neutral: "bg-(--surface-2) text-text-muted border border-(--border-shell)",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "t-9 font-mono px-(--space-2) py-(--space-1)",
  md: "t-11 font-medium px-(--space-3) py-(--space-1)",
};

export function Badge({
  children,
  tone = "neutral",
  size = "sm",
  shape = "pill",
  className = "",
}: BadgeProps) {
  const radius = shape === "pill" ? "rounded-pill" : "rounded-(--radius-xs)";

  return (
    <span
      className={[
        "inline-flex items-center",
        radius,
        toneStyles[tone],
        sizeStyles[size],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
