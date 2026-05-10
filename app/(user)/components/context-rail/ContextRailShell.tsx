"use client";

/**
 * ContextRailShell — wrapper aside du rail droit.
 *
 * Invariant ADD I-6 : largeur via `var(--width-context)`, background via
 * `var(--rail)`. Aucune valeur numérique inline.
 *
 * Invariant ADD I-7 : le bouton fermeture n'apparaît que si `onClose`
 * est défini (drawer mobile). Pas de bouton fermeture en desktop.
 */

import type { ReactNode } from "react";

export function ContextRailShell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <aside
      className="h-full flex flex-col z-20 relative overflow-hidden"
      style={{
        width: "var(--width-context)",
        background: "var(--rail)",
      }}
    >
      {onClose && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: "var(--space-4)",
            boxShadow: "var(--shadow-divider-bottom-subtle)",
          }}
        >
          <p className="t-13 font-light text-text-soft">Context</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-text-faint hover:text-(--accent-teal) transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {children}
    </aside>
  );
}
