"use client";

/**
 * <RailSection> — section primitive du ContextRail.
 *
 * Wrapper standard pour chaque section d'un sub-rail (asset, mission,
 * meeting, kg, voice, simulation, runs, missions, apps).
 *
 * Padding uniforme `px-5 py-5` pour rythme cohérent verticalement.
 * Headers via <SectionHeader> (label + count + action optionnels).
 */

import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

interface RailSectionProps {
  label: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Flex-grow value pour layouts instrument panel (sections proportionnelles
   * occupant toute la hauteur du rail). Quand défini, la section devient
   * `flex-col min-h-0` et le body remplit l'espace restant. Exemples :
   * `"1 1 0"`, `"3 1 0"`. Sans cette prop, hauteur intrinsèque (default).
   */
  flex?: string;
}

export function RailSection({
  label,
  count,
  action,
  children,
  className = "",
  flex,
}: RailSectionProps) {
  if (flex) {
    return (
      <section className={`px-5 py-5 flex flex-col min-h-0 ${className}`} style={{ flex }}>
        <SectionHeader label={label} count={count} action={action} />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
      </section>
    );
  }
  return (
    <section className={`px-5 py-5 ${className}`}>
      <SectionHeader label={label} count={count} action={action} />
      {children}
    </section>
  );
}
