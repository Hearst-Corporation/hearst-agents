"use client";

/**
 * Sub-rail Stage "artifact" — sandbox E2B (Python/Node) + limites runtime.
 */

import { Section } from "./Section";

export function ContextRailForArtifact() {
  return (
    <div className="h-full overflow-y-auto">
      <Section label="Sandbox">
        <p className="t-13 font-light text-text-faint leading-relaxed">
          Environnement E2B isolé. Exécution Python ou Node selon la sélection.
        </p>
      </Section>
      <Section label="Limites">
        <ul className="flex flex-col gap-2">
          {[
            ["Timeout", "30 s"],
            ["Mémoire", "512 MB"],
            ["FS", "Éphémère"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-baseline gap-3">
              <span className="t-9 font-medium text-text-ghost">{k}</span>
              <span className="t-11 font-mono text-text-muted">{v}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
