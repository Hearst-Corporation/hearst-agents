/**
 * TopMenuItem — entrée de navigation rapide (Home, Apps, Chat) en mode
 * expanded. Texte + icône + hotkey optionnel + badge OAuth optionnel.
 *
 * État hover/actif : couleur teal + neon glow. Pas de halo-on-hover sur
 * le chrome (uniquement sur les états actifs intentionnels — voix éditoriale).
 */

import { useState } from "react";
import type { ReactNode } from "react";

export type BadgeSeverity = "warn" | "error" | null;

export interface TopMenuItemProps {
  label: string;
  hotkey?: string;
  icon?: ReactNode;
  isActive?: boolean;
  badge?: BadgeSeverity;
  badgeTitle?: string;
  onClick?: () => void;
}

export function TopMenuItem({
  label,
  hotkey,
  icon,
  isActive = false,
  badge,
  badgeTitle,
  onClick,
}: TopMenuItemProps) {
  const [hover, setHover] = useState(false);
  const highlight = isActive || hover;
  const badgeColor =
    badge === "error"
      ? "var(--color-error)"
      : badge === "warn"
        ? "var(--warn)"
        : null;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-current={isActive ? "page" : undefined}
      className="flex items-center justify-between text-left"
      style={{ padding: "var(--space-2) 0" }}
    >
      <span
        className="flex items-center t-13 transition-all duration-emphasis ease-out-soft"
        style={{
          gap: "var(--space-3)",
          color: highlight ? "var(--accent-teal)" : "var(--text-l2)",
          fontWeight: isActive ? "var(--weight-medium)" : "var(--weight-light)",
          textShadow: highlight ? "var(--neon-accent-teal)" : "none",
        }}
      >
        {icon ? (
          <span
            className="relative inline-flex items-center justify-center shrink-0"
            style={{ width: "var(--space-4)", height: "var(--space-4)" }}
            aria-hidden
          >
            {icon}
            {badgeColor ? (
              <span
                className="absolute rounded-pill"
                style={{
                  top: "-2px",
                  right: "-2px",
                  width: "var(--space-2)",
                  height: "var(--space-2)",
                  background: badgeColor,
                  boxShadow: `0 0 0 1.5px var(--rail)`,
                }}
                title={badgeTitle}
                aria-label={badgeTitle}
              />
            ) : null}
          </span>
        ) : null}
        <span>{label}</span>
      </span>
      {hotkey ? (
        <span className="t-9 font-mono" style={{ color: "var(--text-faint)" }}>
          {hotkey}
        </span>
      ) : null}
    </button>
  );
}
