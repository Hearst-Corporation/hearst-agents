"use client";

import { AppLogo } from "../AppLogo";
import { type ComposioApp, categoryLabel } from "../types";

// ─── Search globale (résultats) ────────────────────────────────

export function SearchResultsSection({
  results,
  totalCount,
  connectedSlugs,
  onSelect,
}: {
  results: ComposioApp[];
  totalCount: number;
  connectedSlugs: Set<string>;
  onSelect: (app: ComposioApp) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3 px-0">
        <p className="t-15 font-medium text-text-muted">Aucun résultat</p>
      </div>
    );
  }
  return (
    <div className="pt-8 pb-8">
      <div className="flex items-baseline gap-2 mb-4 t-13 font-medium">
        <span className="text-text">Résultats</span>
        <span className="text-text-ghost">·</span>
        <span className="text-text-faint font-light">
          {results.length} sur {totalCount}
        </span>
      </div>
      <div className="flex flex-col divide-y">
        {results.map((app) => (
          <button
            key={app.key}
            type="button"
            onClick={() => onSelect(app)}
            className="group flex items-center gap-3 py-3 text-left transition-colors rounded-none"
            style={{
              background: "transparent",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <AppLogo app={app} size={32} />
            <div className="flex-1 min-w-0">
              <div
                className="t-13 truncate"
                style={{ fontWeight: "var(--weight-semibold)", color: "var(--text)" }}
              >
                {app.name}
              </div>
              <div className="t-11 font-light mt-1 text-text-faint truncate">
                {connectedSlugs.has(app.key) ? "Connecté" : categoryLabel(app)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
