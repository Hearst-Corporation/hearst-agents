"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

type IconButtonSize = "xs" | "sm";
type IconButtonTone = "muted" | "accent" | "danger";

export interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: (ev: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Style inline additionnel (ex. padding via token CSS). */
  style?: CSSProperties;
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
  muted: "text-(--text-faint) hover:text-(--accent-teal) hover:border-(--accent-teal-border-hover)",
  accent: "text-(--text) hover:text-(--accent-teal) hover:border-(--accent-teal-border-hover)",
  danger: "text-(--danger) hover:border-(--danger)",
};

export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  title,
  className = "",
  style,
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
      style={style}
      className={`inline-flex items-center justify-center rounded-(--radius-xs) border border-transparent shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal-border-hover) disabled:opacity-40 disabled:cursor-not-allowed ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}
