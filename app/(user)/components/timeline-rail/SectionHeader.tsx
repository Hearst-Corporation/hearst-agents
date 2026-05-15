/**
 * SectionHeader / EmptyHint — primitives internes du TimelineRail.
 *
 * Voix éditoriale : pas de mono caps marquee, le label en tracking-tight
 * et couleur text-faint suffit à hiérarchiser sans cri visuel.
 */

import type { ReactNode } from "react";

export function SectionHeader({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between first:mt-0 mt-12 mb-6 px-3">
      <span
        className="t-11 font-medium"
        style={{
          color: "var(--text-faint)",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        {label}
      </span>
      <span className="flex items-center gap-2">{action}</span>
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="t-11 font-light pl-3 py-2" style={{ color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}
