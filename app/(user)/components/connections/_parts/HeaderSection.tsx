"use client";

/**
 * HeaderSection — composants courts header + label de section
 * du ConnectionsHub (F-11 verrouillé). Anciennement hébergés dans
 * `ConnectionsList.tsx` (barrel supprimé).
 */

// ─── Header sticky : search globale + counters inline ─────────

export function Header({
  searchQuery,
  onSearchChange,
  connectedCount,
  catalogCount,
  attentions,
  attentionFilter,
  onToggleAttentionFilter,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  connectedCount: number;
  catalogCount: number;
  attentions: number;
  attentionFilter: boolean;
  onToggleAttentionFilter: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3 mb-4">
      {/* Search globale */}
      <label
        className="flex-1 flex items-center gap-3 px-0 py-3 border-b rounded-none transition-colors"
        style={{
          background: "transparent",
          borderColor: searchQuery
            ? "var(--accent-teal)"
            : "color-mix(in srgb, var(--border-default) 40%, transparent)",
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
        }}
      >
        <span className="t-13 leading-none text-text-faint">⌕</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cherche un service…"
          className="flex-1 bg-transparent outline-none border-none t-13 text-text placeholder:text-text-faint"
        />
      </label>

      <div className="flex items-center gap-3 t-11 font-light whitespace-nowrap tabular-nums">
        <span className="flex items-center gap-2 text-text-soft">
          <span
            className="w-1 h-1 rounded-pill halo-dot"
            style={{ background: "var(--accent-teal)" }}
            aria-hidden
          />
          {connectedCount}
        </span>
        <span className="text-text-ghost">/</span>
        <span className="text-text-faint">{catalogCount}</span>
        {attentions > 0 && (
          <button
            type="button"
            onClick={onToggleAttentionFilter}
            aria-pressed={attentionFilter}
            title={
              attentionFilter
                ? "Cliquer pour réinitialiser le filtre"
                : "Filtrer le catalogue aux services qui demandent ton attention"
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded-pill border ml-1 transition-colors cursor-pointer"
            style={{
              color: attentionFilter ? "var(--bg)" : "var(--text-soft)",
              background: attentionFilter ? "var(--color-error)" : "transparent",
              borderColor: attentionFilter ? "var(--color-error)" : "var(--border-soft)",
              fontWeight: attentionFilter ? "var(--weight-semibold)" : "var(--weight-regular)",
            }}
          >
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-pill"
              style={{
                background: attentionFilter ? "var(--bg)" : "var(--color-error)",
                boxShadow: attentionFilter
                  ? undefined
                  : "0 0 6px color-mix(in srgb, var(--color-error) 50%, transparent)",
              }}
            />
            {attentions}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section label sobre ────────────────────────────────────────

export function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 pt-5 pb-3 t-13 font-light">
      <span className="text-text-soft">{label}</span>
      <span className="text-text-ghost">·</span>
      <span className="text-text-faint tabular-nums">{count}</span>
    </div>
  );
}
