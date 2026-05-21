"use client";

/**
 * RowActions — groupe d'icon-buttons compacts visibles au hover de la ligne
 * parent.
 *
 * Utilisation : poser à droite d'une ligne (mission, asset, run…) avec
 * `showOnHover` (défaut true). La ligne parent doit porter la classe
 * `group` pour que les actions apparaissent (`group-hover:opacity-100`).
 *
 * Tokens uniquement (CLAUDE.md §1).
 */

import type { ReactNode } from "react";
import { IconButton } from "@/app/(user)/components/ui/IconButton";

export interface RowAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface RowActionsProps {
  actions: RowAction[];
  /** Affiche au hover du parent `.group` uniquement. Défaut true. */
  showOnHover?: boolean;
}

export function RowActions({ actions, showOnHover = true }: RowActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div
      className={
        "flex items-center" +
        (showOnHover
          ? " opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          : " opacity-100")
      }
      style={{
        gap: "var(--space-1)",
        transition: "opacity var(--duration-base) var(--ease-standard)",
      }}
      data-testid="row-actions"
    >
      {actions.map((a) => (
        <IconButton
          key={a.id}
          icon={a.icon}
          label={a.label}
          tone={a.variant === "danger" ? "danger" : "muted"}
          disabled={a.disabled}
          testId={`row-action-${a.id}`}
          onClick={(ev) => {
            // Empêche le clic sur l'icône de déclencher le onClick du parent (la
            // ligne entière est souvent cliquable pour ouvrir le détail).
            ev.stopPropagation();
            if (!a.disabled) a.onClick();
          }}
          style={{
            padding: "var(--space-2-5)",
          }}
        />
      ))}
    </div>
  );
}
