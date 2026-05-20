"use client";

/**
 * <Chip> — primitive étiquette/badge/dot unifiée du DS Hearst OS.
 *
 * Remplace les 34+ usages ad-hoc de `rounded-pill` dispersés dans l'app
 * (chips texte, pills étiquettes, status dots inline).
 *
 * Axes :
 *   variant : "solid" (défaut) | "outlined" | "dot"
 *   size    : "xs" (t-9) | "sm" (t-10, défaut) | "md" (t-11)
 *
 * variant "solid"    → chip texte plein, padding px-(--space-2) py-(--space-1)
 * variant "outlined" → idem + border border-(--border-shell)
 * variant "dot"      → pas de padding ni texte, juste size-(--space-2) rounded-pill
 *                      (status dots, séparateurs visuels)
 *
 * Union discriminée : variant="dot" interdit children (TypeScript + warning dev).
 * Auto role="status" sur dot si pas d'aria-label/labelledby/hidden/role caller.
 *
 * className passthrough pour les color tokens dynamiques (bg, text, border).
 * ForwardRef → composable dans des listes, aria-labelledby, etc.
 *
 * Tokens uniquement (CLAUDE.md §1). Magic numbers interdits.
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────

export type ChipVariant = "solid" | "outlined" | "dot";
export type ChipSize = "xs" | "sm" | "md";

type ChipBaseProps = {
  /** Élément rendu. Défaut : "span". */
  as?: "span" | "div";
  /** Taille du texte. xs → t-9, sm → t-10 (défaut), md → t-11. */
  size?: ChipSize;
  className?: string;
};

/** Dot : pas de children autorisé. */
export type ChipDotProps = ChipBaseProps & {
  variant: "dot";
  children?: never;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

/** Solid / Outlined : children optionnel. */
export type ChipTextProps = ChipBaseProps & {
  variant?: "solid" | "outlined";
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>;

export type ChipProps = ChipDotProps | ChipTextProps;

// ── Style maps ────────────────────────────────────────────────

const SIZE_TEXT: Record<ChipSize, string> = {
  xs: "t-9",
  sm: "t-10",
  md: "t-11",
};

/** Classes de base communes à solid et outlined. */
const BASE_CHIP = "inline-flex items-center px-(--space-2) py-(--space-1) rounded-pill font-medium";

/** Classes propres à chaque variant. */
const VARIANT_CLASSES: Record<ChipVariant, string> = {
  solid: BASE_CHIP,
  outlined: `${BASE_CHIP} border border-(--border-shell)`,
  dot: "rounded-pill size-(--space-2) shrink-0 inline-block",
};

// ── Composant ─────────────────────────────────────────────────

export const Chip = forwardRef<HTMLElement, ChipProps>(function Chip(
  { as = "span", size = "sm", variant = "solid", className = "", children, ...rest },
  ref,
) {
  const Tag = as as "span" | "div";
  const isDot = variant === "dot";

  const callerHasLabel = "aria-label" in rest || "aria-labelledby" in rest;
  const callerHasHidden = "aria-hidden" in rest;
  const callerHasRole = "role" in rest;

  const extraProps: Record<string, unknown> = {};

  if (isDot) {
    if (process.env.NODE_ENV === "development") {
      if (!callerHasLabel && !callerHasHidden) {
        console.warn(
          '[Chip] variant="dot" sans aria-label / aria-labelledby / aria-hidden : indicateur invisible aux lecteurs d\'écran.',
        );
      }
      if (children != null) {
        console.warn('[Chip] variant="dot" ignore children.');
      }
    }
    if (!callerHasLabel && !callerHasHidden && !callerHasRole) {
      extraProps.role = "status";
    }
  }

  const composed = [VARIANT_CLASSES[variant], isDot ? "" : SIZE_TEXT[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    // @ts-expect-error — Tag est "span" | "div", tous deux HTMLElement-compatibles
    <Tag ref={ref} className={composed} {...extraProps} {...rest}>
      {isDot ? null : children}
    </Tag>
  );
});
