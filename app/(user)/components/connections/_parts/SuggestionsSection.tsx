"use client";

import { AppLogo } from "../AppLogo";
import type { ComposioApp } from "../types";

// ─── Suggestions : strip horizontal compact ────────────────────

export function SuggestionsGrid({
  suggestions,
  onSelect,
}: {
  suggestions: { app: ComposioApp; hint: string }[];
  onSelect: (app: ComposioApp) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-6">
      {suggestions.map((s) => (
        <SuggestionCard key={s.app.key} app={s.app} hint={s.hint} onClick={() => onSelect(s.app)} />
      ))}
    </div>
  );
}

function SuggestionCard({
  app,
  hint,
  onClick,
}: {
  app: ComposioApp;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 text-left transition-colors"
    >
      <AppLogo app={app} size={40} />
      <div className="flex-1 min-w-0">
        <div
          className="t-13 truncate group-hover:text-(--accent-teal) transition-colors"
          style={{
            fontWeight: "var(--weight-medium)",
            color: "var(--text-soft)",
          }}
        >
          {app.name}
        </div>
        <div
          className="t-11 mt-1 text-text-faint truncate"
          style={{ lineHeight: "var(--leading-snug)" }}
        >
          {hint}
        </div>
      </div>
      <span
        className="text-text-ghost group-hover:text-[var(--accent-teal-deep)] transition-colors"
        aria-hidden
      >
        →
      </span>
    </button>
  );
}
