"use client";

/**
 * Section / EmptyHint — primitives stables des sub-rails du ContextRail.
 *
 * Pivot UI 2026-05-01 : labels en voix éditoriale (`t-13` medium) et
 * compteurs en typo régulière (mono caps tracking-display retiré).
 *
 * Invariant ADD I-11 : seul pattern autorisé pour les headers de section
 * du rail droit. Labels en `t-13 font-medium`, compteurs en
 * `t-11 font-mono tabular-nums`. Pas de tracking-display, pas d'uppercase.
 */

import type { ReactNode } from "react";

export function Section({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="px-5 py-5">
      <header className="flex items-baseline justify-between mb-4">
        <span
          className="t-13 font-medium"
          style={{ color: "var(--text-l1)" }}
        >
          {label}
        </span>
        {typeof count === "number" && (
          <span
            className="t-11 font-mono tabular-nums"
            style={{ color: "var(--text-faint)" }}
          >
            {count.toString().padStart(2, "0")}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}
