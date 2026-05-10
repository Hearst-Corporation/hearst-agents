"use client";

/**
 * Sub-rail Stage "asset_compare" — info comparaison + raccourcis clavier.
 */

import { Section } from "./Section";

export function ContextRailForAssetCompare() {
  return (
    <div className="h-full overflow-y-auto">
      <Section label="Comparaison">
        <p className="t-13 font-light text-text-faint leading-relaxed">
          Deux assets côte à côte. Le diff structurel apparaît en bas du Stage.
        </p>
      </Section>
      <Section label="Raccourcis">
        <ul className="flex flex-col gap-2">
          {[
            ["←→", "Naviguer"],
            ["D", "Basculer diff"],
            ["Esc", "Fermer"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-baseline gap-3">
              <span className="t-9 font-mono font-medium text-(--accent-teal)">{k}</span>
              <span className="t-11 font-light text-text-muted">{v}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
