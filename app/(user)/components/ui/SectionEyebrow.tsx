"use client";

import type { ReactNode } from "react";

/** Label de section uppercase (ex. « Indicateurs clés », « Workflows »). */
export function SectionEyebrow({
  children,
  id,
  className = "",
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={`t-9 font-medium uppercase text-text-ghost ${className}`}
      style={{ letterSpacing: "var(--tracking-label)", marginBottom: "var(--space-4)" }}
    >
      {children}
    </h2>
  );
}
