"use client";

import type { ReactNode } from "react";

type IconButtonSize = "xs" | "sm";
type IconButtonTone = "muted" | "accent";

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  testId?: string;
  /** Quand true, expose aria-current="page" (navigation rail). */
  ariaCurrent?: boolean;
}

const SIZE_CLASS: Record<IconButtonSize, string> = {
  xs: "w-(--size-icon-xs) h-(--size-icon-xs)",
  sm: "w-(--size-icon-sm) h-(--size-icon-sm)",
};

const TONE_CLASS: Record<IconButtonTone, string> = {
  muted: "text-text-faint hover:text-(--accent-teal)",
  accent: "text-text hover:text-(--accent-teal)",
};

export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  title,
  className = "",
  size = "sm",
  tone = "muted",
  testId,
  ariaCurrent,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      {...(ariaCurrent ? { "aria-current": "page" as const } : {})}
      title={title ?? label}
      data-testid={testId}
      className={`inline-flex items-center justify-center rounded-(--radius-sm) shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover) disabled:opacity-40 ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`}
    >
      {icon}
    </button>
  );
}
